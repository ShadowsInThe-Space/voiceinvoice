/**
 * License Routes
 *
 * Handles license validation endpoints.
 *
 * @module routes/license
 */

import { FastifyInstance, FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import { deriveTenantId } from '../services/tenant-id';
import { validateLicense, LicenseTokenPayload } from '../services/license-service';
import { signLicenseToken, verifyLicenseToken } from '../services/license-token';

/**
 * Extended FastifyRequest with license information.
 */
interface FastifyRequestWithLicense extends FastifyRequest {
  license?: LicenseTokenPayload;
}

/**
 * Creates a Fastify preHandler hook for license-based authentication.
 *
 * @returns Fastify preHandler hook
 */
export function createLicenseAuthHook(): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    const authValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;

    if (!authValue || !authValue.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'Authorization token required',
        statusCode: 401,
      });
    }

    const token = authValue.slice('Bearer '.length).trim();

    let payload: LicenseTokenPayload;
    try {
      payload = verifyLicenseToken(token);
    } catch (error) {
      return reply.status(401).send({
        error: 'Invalid or expired token',
        statusCode: 401,
      });
    }

    const validation = await validateLicense(payload.licenseKey);
    if (!validation.isValid) {
      return reply.status(403).send({
        error: `License invalid: ${validation.error}`,
        statusCode: 403,
      });
    }

    const tenantHeader = request.headers['x-tenant-id'] as string | undefined;
    if (tenantHeader && tenantHeader !== payload.tenantId) {
      return reply.status(403).send({
        error: 'Tenant mismatch',
        statusCode: 403,
      });
    }

    (request as FastifyRequestWithLicense).license = payload;
  };
}

/**
 * Request body schema for license validation.
 */
const ValidateLicenseSchema = z.object({
  /** The license key to validate */
  licenseKey: z.string().min(1, 'License key is required'),
});

type ValidateLicenseRequest = z.infer<typeof ValidateLicenseSchema>;

/**
 * License response structure.
 */
interface LicenseResponse {
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
 * Response structure for license validation.
 */
interface ValidateLicenseResponse {
  token: string;
  license: LicenseResponse;
}

/**
 * Register license routes.
 *
 * @param server - Fastify instance
 */
export async function registerLicenseRoutes(server: FastifyInstance): Promise<void> {
  const handler = async (
    request: FastifyRequest<{ Body: ValidateLicenseRequest }>,
    reply: FastifyReply
  ) => {
    const validation = ValidateLicenseSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        statusCode: 400,
        details: validation.error.issues,
      });
    }

    const { licenseKey } = validation.data;

    try {
      const result = await validateLicense(licenseKey);

      if (!result.isValid || !result.license) {
        return reply.status(403).send({
          error: result.error || 'Invalid license',
          statusCode: 403,
        });
      }

      const tenantId = deriveTenantId(licenseKey);
      const token = signLicenseToken({ licenseKey, tenantId }, result.license.expiresAt);

      const response: ValidateLicenseResponse = {
        token,
        license: {
          licenseKey: result.license.licenseKey,
          companyName: result.license.companyName,
          status: result.license.status,
          monthlyQuota: result.license.monthlyQuota,
          currentUsage: result.license.currentUsage,
          remainingQuota: Math.max(0, result.license.monthlyQuota - result.license.currentUsage),
          usageResetDate: result.license.usageResetDate.toISOString(),
          expiresAt: result.license.expiresAt.toISOString(),
        },
      };

      return reply.status(200).send(response);
    } catch (error) {
      server.log.error({ err: error }, 'License validation failed');
      return reply.status(500).send({
        error: 'Internal server error',
        statusCode: 500,
      });
    }
  };

  server.post<{
    Body: ValidateLicenseRequest;
  }>('/license/validate', handler);

  server.post<{
    Body: ValidateLicenseRequest;
  }>('/api/license/validate', handler);
}
