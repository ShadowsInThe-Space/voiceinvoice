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

// Mock the license store
vi.mock('../src/services/license-store', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/services/license-store')>();
  return {
    ...original,
    getLicenseStore: vi.fn(),
  };
});

import { buildServer } from '../src/server';
import { extractInvoiceData } from '../src/services/gemini-service';
import { createMockLicenseStore, MockLicenseStore, getLicenseStore } from '../src/services/license-store';
import { generateLicenseToken, LicenseTokenPayload } from '../src/services/license-service';

describe('Security Leak Test', () => {
  let server: FastifyInstance;
  let mockStore: MockLicenseStore;
  let validToken: string;
  const originalEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';

    // Setup mock store
    mockStore = createMockLicenseStore();
    vi.mocked(getLicenseStore).mockReturnValue(mockStore);

    // Setup JWT secret
    vi.stubEnv('JWT_SECRET', 'test-secret-key-for-jwt-signing-32chars!');

    // Add a valid license
    mockStore.addLicense({
      id: 'sec-license-id',
      licenseKey: 'SEC-LICENSE-KEY',
      companyName: 'Security Test Co',
      status: 'ACTIVE',
      monthlyQuota: 1000,
      currentUsage: 0,
      usageResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Generate valid token
    const payload: LicenseTokenPayload = {
      licenseKey: 'SEC-LICENSE-KEY',
      companyName: 'Security Test Co',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    validToken = generateLicenseToken(payload);

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
      headers: {
        Authorization: `Bearer ${validToken}`,
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
