/**
 * Sync Routes
 *
 * API endpoints for data synchronization.
 *
 * @module routes/sync
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createLicenseAuthHook } from './license';
import { pushEntity, pullChanges, SyncQueueEntry } from '../services/sync-service';
import { LicenseTokenPayload } from '../services/license-service';

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
}
