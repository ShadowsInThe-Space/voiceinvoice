import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';

// Mock services
vi.mock('../src/services/license-service', () => ({
  validateLicense: vi.fn(),
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

  beforeAll(async () => {
    server = await buildServer({ logger: false });
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /license/validate', () => {
    it('should return valid=true for active license', async () => {
      const mockResult = {
        isValid: true,
        details: {
          companyName: 'Test Corp',
          expiresAt: new Date('2025-12-31'),
          monthlyQuota: 1000,
          currentUsage: 50,
        },
      };

      vi.mocked(validateLicense).mockResolvedValue(mockResult);

      const response = await server.inject({
        method: 'POST',
        url: '/license/validate',
        payload: {
          licenseKey: 'valid-key',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.isValid).toBe(true);
      expect(body.details.companyName).toBe('Test Corp');
      expect(body.details.expiresAt).toBe(mockResult.details.expiresAt.toISOString());
    });

    it('should return valid=false for invalid key', async () => {
      const mockResult = {
        isValid: false,
        error: 'INVALID_KEY',
      };

      vi.mocked(validateLicense).mockResolvedValue(mockResult as any);

      const response = await server.inject({
        method: 'POST',
        url: '/license/validate',
        payload: {
          licenseKey: 'invalid-key',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.isValid).toBe(false);
      expect(body.error).toBe('INVALID_KEY');
    });

    it('should return valid=false for expired license', async () => {
        const mockResult = {
          isValid: false,
          error: 'EXPIRED',
        };

        vi.mocked(validateLicense).mockResolvedValue(mockResult as any);

        const response = await server.inject({
          method: 'POST',
          url: '/license/validate',
          payload: {
            licenseKey: 'expired-key',
          },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.isValid).toBe(false);
        expect(body.error).toBe('EXPIRED');
      });

    it('should return 400 if licenseKey is missing', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/license/validate',
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
        url: '/license/validate',
        payload: {
          licenseKey: 'valid-key',
        },
      });

      expect(response.statusCode).toBe(500);
    });
  });
});
