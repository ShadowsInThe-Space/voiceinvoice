
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server';
import { generateLicenseToken } from '../src/services/license-service';
import { getLicenseStore, createMockLicenseStore } from '../src/services/license-store';

// Mock services
vi.mock('../src/services/speech-service', () => ({
  transcribeAudio: vi.fn().mockResolvedValue({ transcript: 'test', confidence: 0.9 }),
  checkAvailability: vi.fn().mockResolvedValue(true),
}));

vi.mock('../src/services/gemini-service', () => ({
  extractInvoiceData: vi.fn().mockResolvedValue({ invoice: {}, confidence: 0.9 }),
  checkAvailability: vi.fn().mockResolvedValue(true),
}));

describe('Endpoint Protection', () => {
  let server: FastifyInstance;
  const originalJwtSecret = process.env.JWT_SECRET;
  const TEST_LICENSE_KEY = 'TEST-LICENSE-KEY';
  const TEST_JWT_SECRET = 'test-secret-123';

  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    server = await buildServer({ logger: false });

    // Setup license store
    const store = getLicenseStore() as any; // Cast to access addLicense
    store.addLicense({
      id: 'test-id',
      licenseKey: TEST_LICENSE_KEY,
      companyName: 'Test Corp',
      status: 'ACTIVE',
      monthlyQuota: 100,
      currentUsage: 0,
      usageResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterAll(async () => {
    await server.close();
    if (originalJwtSecret) {
      process.env.JWT_SECRET = originalJwtSecret;
    } else {
      delete process.env.JWT_SECRET;
    }
  });

  const getValidToken = () => {
    return generateLicenseToken({
      licenseKey: TEST_LICENSE_KEY,
      companyName: 'Test Corp',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
  };

  describe('POST /transcribe protection', () => {
    it('should return 401 when no token is provided', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/transcribe',
        payload: {
          audio: Buffer.from('test').toString('base64'),
        },
      });
      expect(response.statusCode).toBe(401);
    });

    it('should return 200 when valid token is provided', async () => {
      const token = getValidToken();
      const response = await server.inject({
        method: 'POST',
        url: '/transcribe',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        payload: {
          audio: Buffer.from('test').toString('base64'),
        },
      });
      expect(response.statusCode).toBe(200);
    });
  });

  describe('POST /enrich protection', () => {
    it('should return 401 when no token is provided', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/enrich',
        payload: {
          transcript: 'test transcript',
        },
      });
      expect(response.statusCode).toBe(401);
    });

    it('should return 200 when valid token is provided', async () => {
      const token = getValidToken();
      const response = await server.inject({
        method: 'POST',
        url: '/enrich',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        payload: {
          transcript: 'test transcript',
        },
      });
      expect(response.statusCode).toBe(200);
    });
  });
});
