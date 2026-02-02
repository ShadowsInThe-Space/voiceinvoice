import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';

// Mock the services before importing them
vi.mock('../src/services/speech-service', () => ({
  transcribeAudio: vi.fn(),
  checkAvailability: vi.fn().mockResolvedValue(true),
}));

vi.mock('../src/services/gemini-service', () => ({
  extractInvoiceData: vi.fn(),
  checkAvailability: vi.fn().mockResolvedValue(true),
}));

import { buildServer } from '../src/server';
import { extractInvoiceData } from '../src/services/gemini-service';
import { getLicenseStore, MockLicenseStore } from '../src/services/license-store';
import { generateLicenseToken } from '../src/services/license-service';

describe('Security Leak Test', () => {
  let server: FastifyInstance;
  const originalEnv = process.env.NODE_ENV;
  let validToken: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'test-secret';

    // Setup mock license store
    const store = getLicenseStore() as MockLicenseStore;
    store.reset();
    store.addLicense({
      id: 'test-id-1',
      licenseKey: 'TEST-KEY-VALID',
      companyName: 'Test Company',
      status: 'ACTIVE',
      monthlyQuota: 100,
      currentUsage: 0,
      usageResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    validToken = generateLicenseToken({
      licenseKey: 'TEST-KEY-VALID',
      companyName: 'Test Company',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    server = await buildServer({ logger: false });
  });

  afterAll(async () => {
    await server.close();
    process.env.NODE_ENV = originalEnv;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should NOT leak sensitive error details in production', async () => {
    const sensitiveMessage = 'SENSITIVE_API_KEY_INVALID';
    vi.mocked(extractInvoiceData).mockRejectedValue(new Error(sensitiveMessage));

    const response = await server.inject({
      method: 'POST',
      url: '/enrich',
      headers: { Authorization: `Bearer ${validToken}` },
      payload: {
        transcript: 'some text',
      },
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);

    // In production, the error message should be sanitized
    expect(body.error).toBe('Internal server error');
    expect(body.error).not.toContain(sensitiveMessage);
  });
});
