/**
 * License Routes
 *
 * Handles license validation endpoints.
 *
 * @module routes/license
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { validateLicense, LicenseTokenPayload } from '../services/license-service';

/**
 * Request body schema for license validation.
 */
const ValidateLicenseSchema = z.object({
  /** The license key to validate */
  licenseKey: z.string().min(1, 'License key is required'),
});

type ValidateLicenseRequest = z.infer<typeof ValidateLicenseSchema>;

/**
 * Response structure for license validation.
 */
interface ValidateLicenseResponse {
  isValid: boolean;
  error?: string | undefined;
  details?: {
    companyName: string;
    expiresAt: string; // ISO string
    monthlyQuota: number;
    currentUsage: number;
  } | undefined;
}

/**
 * Register license routes.
 *
 * @param server - Fastify instance
 */
export async function registerLicenseRoutes(server: FastifyInstance): Promise<void> {
  server.post<{
    Body: ValidateLicenseRequest;
  }>(
    '/license/validate',
    async (request: FastifyRequest<{ Body: ValidateLicenseRequest }>, reply: FastifyReply) => {
      // Validate request body
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

        const response: ValidateLicenseResponse = {
          isValid: result.isValid,
          error: result.error,
          details: result.details
            ? {
                ...result.details,
                expiresAt: result.details.expiresAt.toISOString(),
              }
            : undefined,
        };

        // Return 200 even if invalid, as the check itself succeeded.
        // The isValid flag indicates the status.
        return reply.status(200).send(response);
      } catch (error) {
        server.log.error({ err: error }, 'License validation failed');
        return reply.status(500).send({
          error: 'Internal server error',
          statusCode: 500,
        });
      }
    }
  );
}

/**
 * Creates a preHandler hook that validates the license key in headers.
 *
 * @returns Fastify preHandler hook
 */
export function createLicenseAuthHook(): (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<unknown> {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const licenseKey = request.headers['x-license-key'] as string;

    if (!licenseKey) {
      return reply.status(401).send({
        error: 'Missing license key',
        statusCode: 401,
      });
    }

    try {
      const result = await validateLicense(licenseKey);

      if (!result.isValid) {
        return reply.status(403).send({
          error: result.error || 'Invalid license',
          statusCode: 403,
        });
      }

      // Attach license details to request
      const licensePayload: LicenseTokenPayload = {
        licenseKey,
        ...result.details!,
      };

      Object.assign(request, { license: licensePayload });
    } catch (error) {
      request.log.error({ err: error }, 'License auth failed');
      return reply.status(500).send({
        error: 'Internal authentication error',
        statusCode: 500,
      });
    }
  };
}
