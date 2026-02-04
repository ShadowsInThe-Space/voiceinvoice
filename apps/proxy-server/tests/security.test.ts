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

// Mock the auth middleware to bypass checks during security tests
vi.mock('../src/routes/license', () => ({
  registerLicenseRoutes: vi.fn(),
  createLicenseAuthHook: vi.fn().mockReturnValue(async () => {
    // Pass-through
  }),
  createQuotaCheckHook: vi.fn().mockReturnValue(async () => {
    // Pass-through
  }),
}));

import { buildServer } from '../src/server';
import { extractInvoiceData } from '../src/services/gemini-service';

describe('Security Leak Test', () => {
  let server: FastifyInstance;
  const originalEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
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
