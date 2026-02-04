import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';

vi.mock('../src/services/license-service', () => ({
  validateLicense: vi.fn(),
}));

import { createLicenseAuthHook } from '../src/routes/license';
import { signLicenseToken } from '../src/services/license-token';
import { validateLicense } from '../src/services/license-service';

describe('License Auth Hook', () => {
  let server: FastifyInstance;
  const originalSecret = process.env.LICENSE_JWT_SECRET;

  beforeAll(async () => {
    process.env.LICENSE_JWT_SECRET = 'test-secret';
    server = Fastify();
    server.get(
      '/protected',
      {
        preHandler: createLicenseAuthHook(),
      },
      async (request) => ({
        ok: true,
        license: (request as { license?: { licenseKey: string; tenantId: string } }).license,
      })
    );
  });

  afterAll(async () => {
    await server.close();
    process.env.LICENSE_JWT_SECRET = originalSecret;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when Authorization header is missing', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/protected',
    });

    expect(response.statusCode).toBe(401);
  });

  it('should return 401 when token is invalid', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/protected',
      headers: {
        Authorization: 'Bearer invalid-token',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should return 403 when license is invalid', async () => {
    vi.mocked(validateLicense).mockResolvedValue({
      isValid: false,
      error: 'INVALID_KEY',
    } as any);

    const token = signLicenseToken({ licenseKey: 'LIC-INVALID', tenantId: 'tenant-1' });

    const response = await server.inject({
      method: 'GET',
      url: '/protected',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('should allow request when token and license are valid', async () => {
    vi.mocked(validateLicense).mockResolvedValue({
      isValid: true,
    } as any);

    const token = signLicenseToken({ licenseKey: 'LIC-VALID', tenantId: 'tenant-1' });

    const response = await server.inject({
      method: 'GET',
      url: '/protected',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.license.licenseKey).toBe('LIC-VALID');
  });
});
