
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';

// Mock the services before importing them
vi.mock('../src/services/speech-service', () => ({
  transcribeAudio: vi.fn().mockResolvedValue({ transcript: 'test', confidence: 0.9 }),
  checkAvailability: vi.fn().mockResolvedValue(true),
}));

vi.mock('../src/services/gemini-service', () => ({
  extractInvoiceData: vi.fn().mockResolvedValue({ invoice: {}, confidence: 0.9 }),
  checkAvailability: vi.fn().mockResolvedValue(true),
}));

import { buildServer } from '../src/server';

describe('Security Reproduction', () => {
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

  it('should be protected: /transcribe requires auth', async () => {
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

    expect(response.statusCode).toBe(401);
  });

  it('should be protected: /enrich requires auth', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/enrich',
      payload: {
        transcript: 'some text',
      },
    });

    expect(response.statusCode).toBe(401);
  });
});
