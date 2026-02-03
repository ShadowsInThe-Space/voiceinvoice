import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';

// Mock the services before importing them
vi.mock('../src/services/speech-service', () => ({
  transcribeAudio: vi.fn().mockResolvedValue({
    transcript: 'mock transcript',
    confidence: 0.99
  }),
  checkAvailability: vi.fn().mockResolvedValue(true),
}));

vi.mock('../src/services/gemini-service', () => ({
  extractInvoiceData: vi.fn().mockResolvedValue({
    invoice: { some: 'data' },
    confidence: 0.99
  }),
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

describe('Auth Security Enforcement', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer({ logger: false });
  });

  afterAll(async () => {
    await server.close();
  });

  // Currently, the application is VULNERABLE.
  // These tests assert that the endpoints return 401 Unauthorized when no token is provided.
  // BEFORE FIX: These tests will FAIL (because they return 200).
  // AFTER FIX: These tests will PASS.

  it('should deny access to /transcribe without authentication', async () => {
     // Create a mock audio blob (base64 encoded)
     const audioBase64 = Buffer.from('fake-audio-data').toString('base64');

     const response = await server.inject({
        method: 'POST',
        url: '/transcribe',
        payload: {
          audio: audioBase64,
          language: 'de-DE',
          format: 'webm',
        },
      });

      // Expecting 401 for security.
      // If it returns 200, it means it's vulnerable.
      expect(response.statusCode).toBe(401);
  });

  it('should deny access to /enrich without authentication', async () => {
     const response = await server.inject({
        method: 'POST',
        url: '/enrich',
        payload: {
          transcript: 'test transcript',
        },
      });

      // Expecting 401 for security.
      expect(response.statusCode).toBe(401);
  });
});
