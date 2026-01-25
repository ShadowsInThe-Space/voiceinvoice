/**
 * Sync Routes
 *
 * Endpoints for synchronizing data between desktop client and server.
 * PROTECTED: Requires valid Bearer Token (License Token).
 *
 * @module routes/sync
 */

import { FastifyInstance } from 'fastify';
import {
  verifyLicenseToken,
  extractBearerToken,
  LICENSE_ERRORS,
} from '../services/license-service';
import { pushEntity, pullChanges, PushInput } from '../services/sync-service';

/**
 * Register sync routes on the Fastify server.
 *
 * @param server - Fastify server instance
 */
export async function registerSyncRoutes(server: FastifyInstance) {
  // Middleware to verify license token
  server.addHook('onRequest', async (request, reply) => {
    // Only apply to /api/sync/* routes
    if (!request.url.startsWith('/api/sync/')) {
      return;
    }

    const authHeader = request.headers.authorization;
    const token = extractBearerToken(authHeader);

    if (!token) {
      return reply.code(401).send({ error: LICENSE_ERRORS.NO_TOKEN });
    }

    const payload = verifyLicenseToken(token);
    if (!payload) {
      return reply.code(401).send({ error: LICENSE_ERRORS.INVALID_TOKEN });
    }

    // Attach license info to request
    (request as any).licenseKey = payload.licenseKey;
  });

  // POST /api/sync/push
  server.post<{ Body: Omit<PushInput, 'licenseKey'> }>(
    '/api/sync/push',
    {
      schema: {
        body: {
          type: 'object',
          required: ['entityType', 'entityId', 'operation', 'timestamp'],
          properties: {
            entityType: { type: 'string' },
            entityId: { type: 'string' },
            operation: { type: 'string', enum: ['CREATE', 'UPDATE', 'DELETE'] },
            data: { type: 'object', additionalProperties: true },
            timestamp: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const licenseKey = (request as any).licenseKey;
      const result = await pushEntity({
        ...request.body,
        licenseKey,
      });

      if (!result.success) {
        return reply.code(400).send({ error: result.error });
      }

      return { success: true, data: result.serverData };
    }
  );

  // GET /api/sync/pull
  server.get<{ Querystring: { since?: string; types?: string } }>(
    '/api/sync/pull',
    async (request) => {
      const licenseKey = (request as any).licenseKey;
      const { since, types } = request.query;

      const result = await pullChanges({
        licenseKey,
        since: since ? parseInt(since, 10) : null,
        types: types ? types.split(',') : undefined,
      });

      return result;
    }
  );
}
