import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';

// Mock the services to avoid real API calls
vi.mock('../src/services/speech-service', () => ({
  transcribeAudio: vi.fn().mockResolvedValue({
    transcript: 'Test Transcript',
    confidence: 0.99
  }),
  checkAvailability: vi.fn().mockResolvedValue(true),
}));

vi.mock('../src/services/gemini-service', () => ({
  extractInvoiceData: vi.fn().mockResolvedValue({
    invoice: {
      customerName: 'Test Customer',
      items: [],
      netAmount: 100,
      taxRate: 19,
      taxAmount: 19,
      grossAmount: 119,
      currency: 'EUR'
    },
    confidence: 0.99
  }),
  checkAvailability: vi.fn().mockResolvedValue(true),
}));

import { buildServer } from '../src/server';
import { generateLicenseToken } from '../src/services/license-service';
import { getLicenseStore, createMockLicenseStore, setLicenseStore } from '../src/services/license-store';

describe('Security Reproduction Test', () => {
  let server: FastifyInstance;
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    // Setup mock store with a valid license
    const mockStore = createMockLicenseStore();
    mockStore.addLicense({
      id: 'test-id',
      licenseKey: 'VALID-LICENSE-KEY',
      companyName: 'Test Company',
      status: 'ACTIVE',
      monthlyQuota: 1000,
      currentUsage: 0,
      usageResetDate: new Date(Date.now() + 86400000),
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    setLicenseStore(mockStore);

    server = await buildServer({ logger: false });
  });

  afterAll(async () => {
    await server.close();
    process.env.JWT_SECRET = originalJwtSecret;
    setLicenseStore(null); // Reset
  });

  it('FIXED: /transcribe should be rejected without auth (401)', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/transcribe',
      payload: {
        audio: Buffer.from('fake').toString('base64'),
        language: 'de-DE'
      }
    });

    expect(response.statusCode).toBe(401);
  });

  it('FIXED: /enrich should be rejected without auth (401)', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/enrich',
      payload: {
        transcript: 'Test transcript'
      }
    });

    expect(response.statusCode).toBe(401);
  });

  it('SUCCESS: /transcribe should be accessible with valid auth', async () => {
    const token = generateLicenseToken({
      licenseKey: 'VALID-LICENSE-KEY',
      companyName: 'Test Company',
      expiresAt: new Date(Date.now() + 86400000).toISOString()
    });

    const response = await server.inject({
      method: 'POST',
      url: '/transcribe',
      headers: {
        Authorization: `Bearer ${token}`
      },
      payload: {
        audio: Buffer.from('fake').toString('base64'),
        language: 'de-DE'
      }
    });

    expect(response.statusCode).toBe(200);
  });

   it('SUCCESS: /enrich should be accessible with valid auth', async () => {
    const token = generateLicenseToken({
      licenseKey: 'VALID-LICENSE-KEY',
      companyName: 'Test Company',
      expiresAt: new Date(Date.now() + 86400000).toISOString()
    });

    const response = await server.inject({
      method: 'POST',
      url: '/enrich',
      headers: {
        Authorization: `Bearer ${token}`
      },
      payload: {
        transcript: 'Test transcript'
      }
    });

    expect(response.statusCode).toBe(200);
  });
});
