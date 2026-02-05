/**
 * Sync Service
 *
 * Handles data synchronization between local clients and the server.
 * Implements multi-tenant isolation and conflict handling.
 *
 * @module services/sync
 */

import { getPrismaClient } from './prisma';
import type { Prisma } from '../../generated/client';

/**
 * Entry from the client sync queue.
 */
export interface SyncQueueEntry {
  id: string;
  entityType: string;
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  data?: Prisma.InputJsonValue;
  timestamp: number;
}

/**
 * Result of a push operation.
 */
export interface PushResult {
  success: boolean;
  serverData?: Prisma.JsonValue;
  error?: string;
}

/**
 * Server change record for pull operations.
 */
export interface ServerChange {
  entityType: string;
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  data: Prisma.JsonValue;
  updatedAt: string;
}

/**
 * Result of a pull operation.
 */
export interface PullResult {
  data: ServerChange[];
  lastSyncTimestamp: number;
}

/**
 * Push a local change to the server.
 *
 * @param licenseKey - The license key of the client
 * @param entry - The sync queue entry
 * @returns Result of the push
 */
export async function pushEntity(licenseKey: string, entry: SyncQueueEntry): Promise<PushResult> {
  const prisma = getPrismaClient();

  try {
    // Get license ID (and verify existence)
    const license = await prisma.license.findUnique({
      where: { licenseKey },
      select: { id: true },
    });

    if (!license) {
      return { success: false, error: 'License not found' };
    }

    const { entityType, entityId, operation, data } = entry;

    if (operation === 'DELETE') {
      // Mark as deleted instead of removing row to support tombstone syncing
      await prisma.syncedEntity.upsert({
        where: {
          licenseId_entityType_entityId: {
            licenseId: license.id,
            entityType,
            entityId,
          },
        },
        create: {
          licenseId: license.id,
          entityType,
          entityId,
          data: {},
          deleted: true,
        },
        update: {
          deleted: true,
          data: {},
        },
      });
    } else {
      // CREATE or UPDATE
      // We store the data as-is. Merging happens on the client or business logic layer if needed.
      // Here we act as a dumb store for the synced state.
      await prisma.syncedEntity.upsert({
        where: {
          licenseId_entityType_entityId: {
            licenseId: license.id,
            entityType,
            entityId,
          },
        },
        create: {
          licenseId: license.id,
          entityType,
          entityId,
          data: data ?? {},
          deleted: false,
        },
        update: {
          data: data ?? {},
          deleted: false,
        },
      });
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Log error internally if needed
    console.error('Push error:', error);
    return { success: false, error: message };
  }
}

/**
 * Pull changes from the server.
 *
 * @param licenseKey - The license key of the client
 * @param sinceTimestamp - Timestamp to fetch changes from
 * @returns List of changes
 */
export async function pullChanges(
  licenseKey: string,
  sinceTimestamp: number | null
): Promise<PullResult> {
  const prisma = getPrismaClient();

  try {
    const license = await prisma.license.findUnique({
      where: { licenseKey },
      select: { id: true },
    });

    if (!license) {
      throw new Error('License not found');
    }

    const sinceDate = sinceTimestamp ? new Date(sinceTimestamp) : new Date(0);

    const entities = await prisma.syncedEntity.findMany({
      where: {
        licenseId: license.id,
        updatedAt: {
          gt: sinceDate,
        },
      },
      orderBy: {
        updatedAt: 'asc',
      },
    });

    const changes: ServerChange[] = entities.map((e) => ({
      entityType: e.entityType,
      entityId: e.entityId,
      operation: e.deleted ? 'DELETE' : 'UPDATE', // Use UPDATE for upserts
      data: e.data,
      updatedAt: e.updatedAt.toISOString(),
    }));

    // Calculate new timestamp (max of updatedData)
    // If no changes, keep the old timestamp (or current time if null)
    const lastTimestamp =
      entities.length > 0
        ? entities[entities.length - 1].updatedAt.getTime()
        : sinceTimestamp || Date.now();

    return {
      data: changes,
      lastSyncTimestamp: lastTimestamp,
    };
  } catch (error) {
    console.error('Pull error:', error);
    throw error;
  }
}
