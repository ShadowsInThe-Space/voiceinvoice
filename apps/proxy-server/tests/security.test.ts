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
import { generateLicenseToken } from '../src/services/license-service';
import { getLicenseStore } from '../src/services/license-store';

describe('Security Leak Test', () => {
  let server: FastifyInstance;
  let authToken: string;
  const originalEnv = process.env.NODE_ENV;
  const originalJwtSecret = process.env.JWT_SECRET;
  const TEST_LICENSE_KEY = 'SECURITY-TEST-KEY';

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'security-test-secret';

    // Setup license in store
    const store = getLicenseStore() as any;
    store.addLicense({
      id: 'security-test-id',
      licenseKey: TEST_LICENSE_KEY,
      companyName: 'Security Corp',
      status: 'ACTIVE',
      monthlyQuota: 1000,
      currentUsage: 0,
      usageResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Generate token
    authToken = generateLicenseToken({
      licenseKey: TEST_LICENSE_KEY,
      companyName: 'Security Corp',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });

    server = await buildServer({ logger: false });
  });

  afterAll(async () => {
    await server.close();
    process.env.NODE_ENV = originalEnv;
    if (originalJwtSecret) {
      process.env.JWT_SECRET = originalJwtSecret;
    } else {
      delete process.env.JWT_SECRET;
    }
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
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
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
