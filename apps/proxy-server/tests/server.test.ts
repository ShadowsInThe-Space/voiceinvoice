/**
 * Proxy Server Integration Tests
 *
 * Tests for Fastify endpoints using TDD approach.
 * These tests mock external services (Google STT, Gemini) to ensure
 * reliable, fast, and isolated testing.
 */

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
import { transcribeAudio } from '../src/services/speech-service';
import { extractInvoiceData } from '../src/services/gemini-service';
import { getLicenseStore, MockLicenseStore } from '../src/services/license-store';
import { generateLicenseToken } from '../src/services/license-service';

describe('Proxy Server', () => {
  let server: FastifyInstance;
  let validToken: string;
  let depletedToken: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';

    // Setup mock license store
    const store = getLicenseStore() as MockLicenseStore;
    store.reset();

    // Add valid license
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

    // Add depleted license
    store.addLicense({
      id: 'test-id-2',
      licenseKey: 'TEST-KEY-DEPLETED',
      companyName: 'Depleted Company',
      status: 'ACTIVE',
      monthlyQuota: 10,
      currentUsage: 10,
      usageResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Generate tokens
    validToken = generateLicenseToken({
      licenseKey: 'TEST-KEY-VALID',
      companyName: 'Test Company',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    depletedToken = generateLicenseToken({
      licenseKey: 'TEST-KEY-DEPLETED',
      companyName: 'Depleted Company',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    server = await buildServer({ logger: false });
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return health status with 200', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status', 'healthy');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('version');
    });

    it('should include service availability in health check', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('services');
      expect(body.services).toHaveProperty('speechToText');
      expect(body.services).toHaveProperty('gemini');
    });
  });

  describe('POST /transcribe', () => {
    it('should transcribe audio and return transcript with confidence', async () => {
      const mockTranscript = {
        transcript: 'Rechnung an Firma Mustermann, zweihundert Euro netto',
        confidence: 0.95,
      };

      vi.mocked(transcribeAudio).mockResolvedValue(mockTranscript);

      // Create a mock audio blob (base64 encoded)
      const audioBase64 = Buffer.from('fake-audio-data').toString('base64');

      const response = await server.inject({
        method: 'POST',
        url: '/transcribe',
        headers: { Authorization: `Bearer ${validToken}` },
        payload: {
          audio: audioBase64,
          language: 'de-DE',
          format: 'webm',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('transcript', mockTranscript.transcript);
      expect(body).toHaveProperty('confidence', mockTranscript.confidence);
    });

    it('should return 400 when audio is missing', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/transcribe',
        headers: { Authorization: `Bearer ${validToken}` },
        payload: {
          language: 'de-DE',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
    });

    it('should use default language de-DE when not specified', async () => {
      const mockTranscript = {
        transcript: 'Test transcript',
        confidence: 0.9,
      };

      vi.mocked(transcribeAudio).mockResolvedValue(mockTranscript);

      const audioBase64 = Buffer.from('fake-audio-data').toString('base64');

      const response = await server.inject({
        method: 'POST',
        url: '/transcribe',
        headers: { Authorization: `Bearer ${validToken}` },
        payload: {
          audio: audioBase64,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(transcribeAudio).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({ language: 'de-DE' })
      );
    });

    it('should return 500 when transcription service fails', async () => {
      vi.mocked(transcribeAudio).mockRejectedValue(new Error('Service unavailable'));

      const audioBase64 = Buffer.from('fake-audio-data').toString('base64');

      const response = await server.inject({
        method: 'POST',
        url: '/transcribe',
        headers: { Authorization: `Bearer ${validToken}` },
        payload: {
          audio: audioBase64,
          language: 'de-DE',
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
    });

    it('should return 401 when token is missing', async () => {
      const audioBase64 = Buffer.from('fake-audio-data').toString('base64');

      const response = await server.inject({
        method: 'POST',
        url: '/transcribe',
        payload: {
          audio: audioBase64,
          language: 'de-DE',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 429 when quota is exceeded', async () => {
      const audioBase64 = Buffer.from('fake-audio-data').toString('base64');

      const response = await server.inject({
        method: 'POST',
        url: '/transcribe',
        headers: { Authorization: `Bearer ${depletedToken}` },
        payload: {
          audio: audioBase64,
          language: 'de-DE',
        },
      });

      expect(response.statusCode).toBe(429);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('quota exceeded');
    });
  });

  describe('POST /enrich', () => {
    it('should extract invoice data from transcript', async () => {
      const mockInvoiceData = {
        invoice: {
          customerName: 'Firma Mustermann GmbH',
          items: [{ description: 'Beratungsleistung', quantity: 1, unitPrice: 200, total: 200 }],
          netAmount: 200,
          taxRate: 19,
          taxAmount: 38,
          grossAmount: 238,
          currency: 'EUR',
        },
        confidence: 0.92,
      };

      vi.mocked(extractInvoiceData).mockResolvedValue(mockInvoiceData);

      const response = await server.inject({
        method: 'POST',
        url: '/enrich',
        headers: { Authorization: `Bearer ${validToken}` },
        payload: {
          transcript:
            'Rechnung an Firma Mustermann GmbH, zweihundert Euro netto für Beratungsleistung',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('invoice');
      expect(body.invoice).toHaveProperty('customerName', 'Firma Mustermann GmbH');
      expect(body.invoice).toHaveProperty('netAmount', 200);
      expect(body.invoice).toHaveProperty('taxRate', 19);
      expect(body).toHaveProperty('confidence', 0.92);
    });

    it('should return 400 when transcript is missing', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/enrich',
        headers: { Authorization: `Bearer ${validToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
    });

    it('should return 400 when transcript is empty', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/enrich',
        headers: { Authorization: `Bearer ${validToken}` },
        payload: {
          transcript: '',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
    });

    it('should return 500 when Gemini service fails', async () => {
      vi.mocked(extractInvoiceData).mockRejectedValue(new Error('API error'));

      const response = await server.inject({
        method: 'POST',
        url: '/enrich',
        headers: { Authorization: `Bearer ${validToken}` },
        payload: {
          transcript: 'Some transcript text',
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
    });

    it('should handle partial extraction with lower confidence', async () => {
      const partialData = {
        invoice: {
          customerName: 'Unknown Customer',
          items: [],
          netAmount: 0,
          taxRate: 19,
          taxAmount: 0,
          grossAmount: 0,
          currency: 'EUR',
        },
        confidence: 0.3,
      };

      vi.mocked(extractInvoiceData).mockResolvedValue(partialData);

      const response = await server.inject({
        method: 'POST',
        url: '/enrich',
        headers: { Authorization: `Bearer ${validToken}` },
        payload: {
          transcript: 'Unclear audio recording',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.confidence).toBeLessThan(0.5);
    });

    it('should return 401 when token is missing', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/enrich',
        payload: {
          transcript: 'test',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 429 when quota is exceeded', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/enrich',
        headers: { Authorization: `Bearer ${depletedToken}` },
        payload: {
          transcript: 'test',
        },
      });

      expect(response.statusCode).toBe(429);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/unknown-route',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return proper error format', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/unknown-route',
      });

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('statusCode', 404);
    });
  });

  describe('CORS', () => {
    it('should include CORS headers', async () => {
      const response = await server.inject({
        method: 'OPTIONS',
        url: '/health',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'GET',
        },
      });

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });
});

describe('Services Unit Tests', () => {
  describe('Speech Service', () => {
    it('should export transcribeAudio function', async () => {
      // Unmock to test the real export
      const speechService = await vi.importActual<typeof import('../src/services/speech-service')>(
        '../src/services/speech-service'
      );
      expect(speechService.transcribeAudio).toBeDefined();
      expect(typeof speechService.transcribeAudio).toBe('function');
    });
  });

  describe('Gemini Service', () => {
    it('should export extractInvoiceData function', async () => {
      const geminiService = await vi.importActual<typeof import('../src/services/gemini-service')>(
        '../src/services/gemini-service'
      );
      expect(geminiService.extractInvoiceData).toBeDefined();
      expect(typeof geminiService.extractInvoiceData).toBe('function');
    });
  });
});

describe('Server Configuration', () => {
  it('should return default configuration', async () => {
    const { createConfig } = await import('../src/index');
    const config = createConfig();

    expect(config.port).toBe(3001);
    expect(config.host).toBe('0.0.0.0');
    expect(config.enableLogging).toBe(true);
    expect(config.rateLimit).toBe(60);
  });

  it('should export version constant', async () => {
    const { PROXY_SERVER_VERSION } = await import('../src/index');
    expect(PROXY_SERVER_VERSION).toBe('0.1.0');
  });
});
