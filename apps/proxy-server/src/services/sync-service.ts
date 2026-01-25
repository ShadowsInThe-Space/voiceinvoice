/**
 * Sync Service
 *
 * Handles server-side synchronization logic for offline-first clients.
 * Manages push/pull operations and data persistence in SyncedEntity.
 *
 * @module services/sync-service
 */

import { PrismaClient, Prisma } from '../../generated/client';

// Use a shared Prisma instance from license-store or create a new one if not available globally
const prisma = new PrismaClient();

/**
 * Supported sync operations.
 */
export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';

/**
 * Input for pushing data.
 */
export interface PushInput {
  licenseKey: string;
  entityType: string;
  entityId: string;
  operation: SyncOperation;
  data: any; // JSON payload
  timestamp: number;
}

/**
 * Input for pulling data.
 */
export interface PullInput {
  licenseKey: string;
  since: number | null; // Timestamp (ms)
  types?: string[] | undefined;
}

/**
 * Result of a push operation.
 */
export interface PushResult {
  success: boolean;
  serverData?: any;
  error?: string;
}

/**
 * Result of a pull operation.
 */
export interface PullResult {
  changes: Array<{
    entityType: string;
    entityId: string;
    operation: SyncOperation;
    data: any;
    updatedAt: number;
    version: number;
  }>;
  timestamp: number;
}

/**
 * Pushes a change from a client to the server.
 *
 * @param input - Push operation details
 * @returns Result of operation
 */
export async function pushEntity(input: PushInput): Promise<PushResult> {
  const { licenseKey, entityType, entityId, operation, data } = input;

  try {
    // 1. Find the license ID
    const license = await prisma.license.findUnique({
      where: { licenseKey },
    });

    if (!license) {
      return { success: false, error: 'License not found' };
    }

    if (operation === 'DELETE') {
      // Soft delete
      await prisma.syncedEntity.upsert({
        where: {
          licenseId_entityType_entityId: {
            licenseId: license.id,
            entityType,
            entityId,
          },
        },
        update: {
          deletedAt: new Date(),
          version: { increment: 1 },
          data: data ?? {}, // Keep last known data or empty
        },
        create: {
          licenseId: license.id,
          entityType,
          entityId,
          data: data ?? {},
          deletedAt: new Date(),
        },
      });
    } else {
      // Create or Update
      await prisma.syncedEntity.upsert({
        where: {
          licenseId_entityType_entityId: {
            licenseId: license.id,
            entityType,
            entityId,
          },
        },
        update: {
          data,
          deletedAt: null, // Revive if previously deleted
          version: { increment: 1 },
        },
        create: {
          licenseId: license.id,
          entityType,
          entityId,
          data,
        },
      });
    }

    return { success: true, serverData: data };
  } catch (error) {
    console.error('Push error:', error);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Pulls changes from the server for a client.
 *
 * @param input - Pull request parameters
 * @returns Changed entities since timestamp
 */
export async function pullChanges(input: PullInput): Promise<PullResult> {
  const { licenseKey, since, types } = input;
  const currentTimestamp = Date.now();

  try {
    const license = await prisma.license.findUnique({
      where: { licenseKey },
    });

    if (!license) {
      throw new Error('License not found');
    }

    const whereClause: Prisma.SyncedEntityWhereInput = {
      licenseId: license.id,
    };

    if (since) {
      whereClause.updatedAt = {
        gt: new Date(since),
      };
    }

    if (types && types.length > 0) {
      whereClause.entityType = {
        in: types,
      };
    }

    const entities = await prisma.syncedEntity.findMany({
      where: whereClause,
      orderBy: { updatedAt: 'asc' },
    });

    const changes = entities.map((entity) => ({
      entityType: entity.entityType,
      entityId: entity.entityId,
      operation: (entity.deletedAt ? 'DELETE' : 'UPDATE') as SyncOperation, // Treat creation as update for sync
      data: entity.data,
      updatedAt: entity.updatedAt.getTime(),
      version: entity.version,
    }));

    return {
      changes,
      timestamp: currentTimestamp,
    };
  } catch (error) {
    console.error('Pull error:', error);
    // Return empty changes on error for robustness, or throw
    return { changes: [], timestamp: currentTimestamp };
  }
}
