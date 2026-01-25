/**
 * License Routes
 *
 * API endpoints for license validation and status checking.
 * Implements JWT-based authentication and rate limiting per license.
 *
 * @module routes/license
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  generateLicenseToken,
  verifyLicenseToken,
  extractBearerToken,
  LICENSE_ERRORS,
  LicenseTokenPayload,
} from '../services/license-service';
import { getLicenseStore, License } from '../services/license-store';

/**
 * Schema for POST /api/license/validate request body.
 */
const validateLicenseSchema = z.object({
  licenseKey: z.string().min(1, 'licenseKey is required'),
});

/**
 * Response for POST /api/license/validate.
 */
interface ValidateLicenseResponse {
  token: string;
  license: {
    licenseKey: string;
    companyName: string;
    status: string;
    monthlyQuota: number;
    currentUsage: number;
    expiresAt: string;
  };
}

/**
 * Response for GET /api/license/status.
 */
interface LicenseStatusResponse {
  licenseKey: string;
  companyName: string;
  status: string;
  monthlyQuota: number;
  currentUsage: number;
  remainingQuota: number;
  usageResetDate: string;
  expiresAt: string;
}

/**
 * Error response structure.
 */
interface ErrorResponse {
  error: string;
  statusCode: number;
}

/**
 * Add rate limit headers to response.
 *
 * @param reply - Fastify reply object
 * @param license - License data
 */
function addRateLimitHeaders(reply: FastifyReply, license: License): void {
  reply.header('X-RateLimit-Limit', license.monthlyQuota.toString());
  reply.header(
    'X-RateLimit-Remaining',
    Math.max(0, license.monthlyQuota - license.currentUsage).toString()
  );
  reply.header('X-RateLimit-Reset', license.usageResetDate.toISOString());
}

/**
 * Register license-related routes.
 *
 * @param server - Fastify instance
 *
 * @example
 * ```typescript
 * import { buildServer } from './server';
 * import { registerLicenseRoutes } from './routes/license';
 *
 * const server = await buildServer();
 * await registerLicenseRoutes(server);
 * ```
 */
export async function registerLicenseRoutes(server: FastifyInstance): Promise<void> {
  /**
   * POST /api/license/validate
   *
   * Validates a license key and returns a JWT token for API authentication.
   */
  server.post<{
    Body: { licenseKey?: string };
  }>('/api/license/validate', async (request: FastifyRequest, reply: FastifyReply) => {
    // Parse and validate request body
    const parseResult = validateLicenseSchema.safeParse(request.body);

    if (!parseResult.success) {
      const errorResponse: ErrorResponse = {
        error: parseResult.error.errors[0]?.message || 'Invalid request body',
        statusCode: 400,
      };
      return reply.status(400).send(errorResponse);
    }

    const { licenseKey } = parseResult.data;
    const store = getLicenseStore();

    // Look up license in database
    const license = await store.getLicense(licenseKey);

    if (!license) {
      const errorResponse: ErrorResponse = {
        error: LICENSE_ERRORS.LICENSE_NOT_FOUND,
        statusCode: 404,
      };
      return reply.status(404).send(errorResponse);
    }

    // Check if license is expired
    if (license.expiresAt < new Date()) {
      const errorResponse: ErrorResponse = {
        error: LICENSE_ERRORS.LICENSE_EXPIRED,
        statusCode: 403,
      };
      return reply.status(403).send(errorResponse);
    }

    // Check if license is suspended or revoked
    if (license.status === 'SUSPENDED') {
      const errorResponse: ErrorResponse = {
        error: LICENSE_ERRORS.LICENSE_SUSPENDED,
        statusCode: 403,
      };
      return reply.status(403).send(errorResponse);
    }

    if (license.status === 'REVOKED') {
      const errorResponse: ErrorResponse = {
        error: LICENSE_ERRORS.LICENSE_SUSPENDED,
        statusCode: 403,
      };
      return reply.status(403).send(errorResponse);
    }

    // Generate JWT token
    const tokenPayload: LicenseTokenPayload = {
      licenseKey: license.licenseKey,
      companyName: license.companyName,
      expiresAt: license.expiresAt.toISOString(),
    };

    const token = generateLicenseToken(tokenPayload);

    // Add rate limit headers
    addRateLimitHeaders(reply, license);

    const response: ValidateLicenseResponse = {
      token,
      license: {
        licenseKey: license.licenseKey,
        companyName: license.companyName,
        status: license.status,
        monthlyQuota: license.monthlyQuota,
        currentUsage: license.currentUsage,
        expiresAt: license.expiresAt.toISOString(),
      },
    };

    return reply.status(200).send(response);
  });

  /**
   * GET /api/license/status
   *
   * Returns the current status of the authenticated license.
   * Requires a valid Bearer token in the Authorization header.
   */
  server.get('/api/license/status', async (request: FastifyRequest, reply: FastifyReply) => {
    // Extract token from Authorization header
    const authHeader = request.headers.authorization;
    const token = extractBearerToken(authHeader);

    if (!token) {
      const errorResponse: ErrorResponse = {
        error: LICENSE_ERRORS.NO_TOKEN,
        statusCode: 401,
      };
      return reply.status(401).send(errorResponse);
    }

    // Verify token
    const payload = verifyLicenseToken(token);

    if (!payload) {
      const errorResponse: ErrorResponse = {
        error: LICENSE_ERRORS.INVALID_TOKEN,
        statusCode: 401,
      };
      return reply.status(401).send(errorResponse);
    }

    // Get current license status from database
    const store = getLicenseStore();
    const license = await store.getLicense(payload.licenseKey);

    if (!license) {
      const errorResponse: ErrorResponse = {
        error: LICENSE_ERRORS.LICENSE_NOT_FOUND,
        statusCode: 404,
      };
      return reply.status(404).send(errorResponse);
    }

    // Add rate limit headers
    addRateLimitHeaders(reply, license);

    const response: LicenseStatusResponse = {
      licenseKey: license.licenseKey,
      companyName: license.companyName,
      status: license.status,
      monthlyQuota: license.monthlyQuota,
      currentUsage: license.currentUsage,
      remainingQuota: Math.max(0, license.monthlyQuota - license.currentUsage),
      usageResetDate: license.usageResetDate.toISOString(),
      expiresAt: license.expiresAt.toISOString(),
    };

    return reply.status(200).send(response);
  });
}

/**
 * Create a license authentication middleware hook.
 *
 * Use this to protect routes that require a valid license.
 *
 * @returns Fastify preHandler hook function
 *
 * @example
 * ```typescript
 * server.addHook('preHandler', createLicenseAuthHook());
 * ```
 */
export function createLicenseAuthHook() {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const authHeader = request.headers.authorization;
    const token = extractBearerToken(authHeader);

    if (!token) {
      return reply.status(401).send({
        error: LICENSE_ERRORS.NO_TOKEN,
        statusCode: 401,
      });
    }

    const payload = verifyLicenseToken(token);

    if (!payload) {
      return reply.status(401).send({
        error: LICENSE_ERRORS.INVALID_TOKEN,
        statusCode: 401,
      });
    }

    // Attach license info to request for downstream use
    (request as FastifyRequest & { license?: LicenseTokenPayload }).license = payload;
  };
}

/**
 * Create a rate limiting middleware that checks license quota.
 *
 * Increments usage counter and rejects if quota is exceeded.
 *
 * @returns Fastify preHandler hook function
 *
 * @example
 * ```typescript
 * // Apply to specific routes
 * server.post('/transcribe', {
 *   preHandler: [createLicenseAuthHook(), createQuotaCheckHook()],
 * }, handler);
 * ```
 */
export function createQuotaCheckHook() {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const licenseRequest = request as FastifyRequest & { license?: LicenseTokenPayload };
    const payload = licenseRequest.license;

    if (!payload) {
      return reply.status(401).send({
        error: LICENSE_ERRORS.NO_TOKEN,
        statusCode: 401,
      });
    }

    const store = getLicenseStore();
    const result = await store.incrementUsage(payload.licenseKey);

    if (!result.success) {
      if (result.error === LICENSE_ERRORS.QUOTA_EXCEEDED) {
        // Get license for headers
        const license = await store.getLicense(payload.licenseKey);
        if (license) {
          addRateLimitHeaders(reply, license);
        }

        return reply.status(429).send({
          error: LICENSE_ERRORS.QUOTA_EXCEEDED,
          statusCode: 429,
        });
      }

      return reply.status(500).send({
        error: result.error || 'Failed to track usage',
        statusCode: 500,
      });
    }
  };
}
