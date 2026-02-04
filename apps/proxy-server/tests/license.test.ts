import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';

// Mock services
vi.mock('../src/services/license-service', () => ({
  validateLicense: vi.fn(),
}));

vi.mock('../src/services/prisma', () => ({
  getPrismaClient: vi.fn(),
}));

// Mock other services required by buildServer
vi.mock('../src/services/speech-service', () => ({
  transcribeAudio: vi.fn(),
  checkAvailability: vi.fn().mockResolvedValue(true),
}));

vi.mock('../src/services/gemini-service', () => ({
  extractInvoiceData: vi.fn(),
  checkAvailability: vi.fn().mockResolvedValue(true),
}));

import { buildServer } from '../src/server';
import { validateLicense } from '../src/services/license-service';

describe('License Routes', () => {
  let server: FastifyInstance;
  const originalSecret = process.env.LICENSE_JWT_SECRET;

  beforeAll(async () => {
    process.env.LICENSE_JWT_SECRET = 'test-secret';
    server = await buildServer({ logger: false });
  });

  afterAll(async () => {
    await server.close();
    process.env.LICENSE_JWT_SECRET = originalSecret;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/license/validate', () => {
    it('should return token and license for active license', async () => {
      const mockResult = {
        isValid: true,
        license: {
          id: 'lic-1',
          licenseKey: 'valid-key',
          companyName: 'Test Corp',
          status: 'ACTIVE',
          monthlyQuota: 1000,
          currentUsage: 50,
          usageResetDate: new Date('2026-01-01'),
          expiresAt: new Date('2026-12-31'),
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-06-01'),
        },
      };

      vi.mocked(validateLicense).mockResolvedValue(mockResult as any);

      const response = await server.inject({
        method: 'POST',
        url: '/api/license/validate',
        payload: {
          licenseKey: 'valid-key',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.token).toBeTruthy();
      expect(body.license.companyName).toBe('Test Corp');
      expect(body.license.licenseKey).toBe('valid-key');
      expect(body.license.expiresAt).toBe(mockResult.license.expiresAt.toISOString());
    });

    it('should return 403 for invalid key', async () => {
      vi.mocked(validateLicense).mockResolvedValue({
        isValid: false,
        error: 'INVALID_KEY',
      } as any);

      const response = await server.inject({
        method: 'POST',
        url: '/api/license/validate',
        payload: {
          licenseKey: 'invalid-key',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 for expired license', async () => {
      vi.mocked(validateLicense).mockResolvedValue({
        isValid: false,
        error: 'EXPIRED',
      } as any);

      const response = await server.inject({
        method: 'POST',
        url: '/api/license/validate',
        payload: {
          licenseKey: 'expired-key',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 400 if licenseKey is missing', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/license/validate',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid request body');
    });

    it('should return 500 if service throws error', async () => {
      vi.mocked(validateLicense).mockRejectedValue(new Error('DB connection failed'));

      const response = await server.inject({
        method: 'POST',
        url: '/api/license/validate',
        payload: {
          licenseKey: 'valid-key',
        },
      });

      expect(response.statusCode).toBe(500);
    });
  });
});
