/**
 * Sync Routes
 *
 * API endpoints for data synchronization including E2E encrypted sync.
 * The server never sees plaintext data - only encrypted blobs.
 *
 * @module routes/sync
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createLicenseAuthHook } from './license';
import { pushEntity, pullChanges, SyncQueueEntry } from '../services/sync-service';
import { LicenseTokenPayload } from '../services/license-service';
import {
  storeEncryptedDocument,
  pullEncryptedDocuments,
  EncryptedDocumentInput,
} from '../services/encrypted-sync-service';

/**
 * Schema for POST /api/sync/push request body.
 */
const pushSchema = z.object({
  entry: z.object({
    id: z.string(),
    entityType: z.string(),
    entityId: z.string(),
    operation: z.enum(['CREATE', 'UPDATE', 'DELETE']),
    data: z.any().optional(),
    timestamp: z.number(),
  }),
});

/**
 * Schema for GET /api/sync/pull query string.
 */
const pullSchema = z.object({
  since: z.string().optional(),
});

/**
 * Register sync-related routes.
 *
 * @param server - Fastify instance
 */
export async function registerSyncRoutes(server: FastifyInstance): Promise<void> {
  /**
   * POST /api/sync/push
   *
   * Pushes a single entity change to the server.
   */
  server.post<{
    Body: { entry: SyncQueueEntry };
  }>(
    '/api/sync/push',
    {
      preHandler: createLicenseAuthHook(),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Validate body
      const parseResult = pushSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: parseResult.error.errors[0]?.message || 'Invalid request body',
          statusCode: 400,
        });
      }

      const { entry } = parseResult.data;
      const license = (request as any).license as LicenseTokenPayload;

      const result = await pushEntity(license.licenseKey, entry);

      if (!result.success) {
        return reply.status(500).send({
          error: result.error || 'Failed to push entity',
          statusCode: 500,
        });
      }

      return reply.status(200).send(result);
    }
  );

  /**
   * GET /api/sync/pull
   *
   * Pulls changes since a given timestamp.
   */
  server.get<{
    Querystring: { since?: string };
  }>(
    '/api/sync/pull',
    {
      preHandler: createLicenseAuthHook(),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = pullSchema.safeParse(request.query);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Invalid query parameters',
          statusCode: 400,
        });
      }

      const sinceStr = parseResult.data.since;
      const since = sinceStr ? parseInt(sinceStr, 10) : null;
      const license = (request as any).license as LicenseTokenPayload;

      try {
        const result = await pullChanges(license.licenseKey, since);
        return reply.status(200).send(result);
      } catch (error) {
        return reply.status(500).send({
          error: 'Failed to pull changes',
          statusCode: 500,
        });
      }
    }
  );

  // =====================================================
  // E2E Encrypted Sync Endpoints (Zero-Knowledge Server)
  // =====================================================

  /**
   * Schema for encrypted document payload.
   * Server stores encrypted blobs without decryption.
   */
  const encryptedSyncSchema = z.object({
    document_type: z.enum([
      'invoice',
      'customer',
      'recording',
      'category',
      'bank_transaction',
      'app_settings',
    ]),
    encrypted_content: z.string().min(1),
    iv: z.string().min(1),
    embedding: z.array(z.number()).length(768).optional(),
    metadata: z.object({
      entity_id: z.string(),
      entity_type: z.string(),
      operation: z.enum(['CREATE', 'UPDATE', 'DELETE']),
      timestamp: z.number(),
    }),
    sync_version: z.number().int().positive(),
  });

  /**
   * Schema for pull query parameters.
   */
  const encryptedPullSchema = z.object({
    since: z.string().optional(),
    types: z.string().optional(),
  });

  /**
   * POST /api/sync/encrypted
   *
   * Stores an encrypted document blob. Server never decrypts the content.
   * Uses tenant_id from header for RLS isolation.
   */
  server.post(
    '/api/sync/encrypted',
    {
      preHandler: createLicenseAuthHook(),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = request.headers['x-tenant-id'] as string | undefined;

      if (!tenantId) {
        return reply.status(400).send({
          error: 'Missing x-tenant-id header',
          statusCode: 400,
        });
      }

      const parseResult = encryptedSyncSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: parseResult.error.errors[0]?.message || 'Invalid request body',
          statusCode: 400,
        });
      }

      const { document_type, encrypted_content, iv, embedding, metadata, sync_version } =
        parseResult.data;

      try {
        const documentInput: EncryptedDocumentInput = {
          tenant_id: tenantId,
          document_type,
          encrypted_content,
          iv,
          embedding,
          metadata,
          sync_version,
        };

        const result = await storeEncryptedDocument(documentInput);

        return reply.status(201).send({
          success: true,
          id: result.id,
        });
      } catch (error) {
        server.log.error({ err: error }, 'Failed to store encrypted document');
        return reply.status(500).send({
          error: 'Failed to store encrypted document',
          statusCode: 500,
        });
      }
    }
  );

  /**
   * GET /api/sync/encrypted/pull
   *
   * Pulls encrypted documents since a given timestamp.
   * Returns encrypted blobs for client-side decryption.
   */
  server.get(
    '/api/sync/encrypted/pull',
    {
      preHandler: createLicenseAuthHook(),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = request.headers['x-tenant-id'] as string | undefined;

      if (!tenantId) {
        return reply.status(400).send({
          error: 'Missing x-tenant-id header',
          statusCode: 400,
        });
      }

      const parseResult = encryptedPullSchema.safeParse(request.query);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Invalid query parameters',
          statusCode: 400,
        });
      }

      const { since, types } = parseResult.data;
      const sinceDate = since ? new Date(since) : null;
      const documentTypes = types ? types.split(',') : undefined;

      try {
        const result = await pullEncryptedDocuments(tenantId, sinceDate, documentTypes);

        return reply.status(200).send({
          documents: result.documents,
          timestamp: result.timestamp.toISOString(),
        });
      } catch (error) {
        server.log.error({ err: error }, 'Failed to pull encrypted documents');
        return reply.status(500).send({
          error: 'Failed to pull encrypted documents',
          statusCode: 500,
        });
      }
    }
  );
}
