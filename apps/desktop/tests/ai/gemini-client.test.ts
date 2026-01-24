/**
 * Tests for GeminiClient.
 *
 * Tests the Google AI client (Gemini 2.5 Flash + Chirp 3) for VoiceInvoice.
 *
 * @module tests/ai/gemini-client
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GeminiClient } from '../../src/lib/ai/gemini-client';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('GeminiClient', () => {
  let client: GeminiClient;
  const testApiKey = 'test-google-api-key-12345';

  beforeEach(() => {
    vi.clearAllMocks();
    // Use maxRetries: 1 for faster non-retry tests
    client = new GeminiClient({ apiKey: testApiKey, maxRetries: 1 });
  });

  describe('constructor', () => {
    it('should create client with API key', () => {
      const c = new GeminiClient({ apiKey: 'my-key' });
      expect(c).toBeInstanceOf(GeminiClient);
    });

    it('should accept custom project ID', () => {
      const c = new GeminiClient({
        apiKey: 'key',
        projectId: 'my-project',
      });
      expect(c).toBeInstanceOf(GeminiClient);
    });

    it('should accept custom location', () => {
      const c = new GeminiClient({
        apiKey: 'key',
        location: 'us-central1',
      });
      expect(c).toBeInstanceOf(GeminiClient);
    });
  });

  describe('transcribe (Chirp 3)', () => {
    it('should transcribe audio to text', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              alternatives: [
                {
                  transcript: 'Rechnung für Müller GmbH über 500 Euro',
                  confidence: 0.95,
                },
              ],
            },
          ],
        }),
      });

      const audioBase64 = Buffer.from('fake audio').toString('base64');
      const result = await client.transcribe(audioBase64, 'audio/webm');

      expect(result.success).toBe(true);
      expect(result.text).toContain('Müller');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should include language code', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ alternatives: [{ transcript: 'Transkription' }] }],
        }),
      });

      const audioBase64 = Buffer.from('audio').toString('base64');
      await client.transcribe(audioBase64, 'audio/webm', { language: 'de-DE' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('speech:recognize'),
        expect.objectContaining({
          body: expect.stringContaining('de-DE'),
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });

      const result = await client.transcribe('audio', 'audio/webm');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.transcribe('audio', 'audio/webm');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network');
    });

    it('should map webm MIME type correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });

      await client.transcribe('audio', 'audio/webm;codecs=opus');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('WEBM_OPUS'),
        })
      );
    });
  });

  describe('parseInvoice (Gemini 2.5 Flash)', () => {
    it('should extract invoice data from text', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      customerName: 'Müller GmbH',
                      items: [{ description: 'Beratung', quantity: 5, unitPrice: 100 }],
                      notes: 'Zahlbar in 14 Tagen',
                    }),
                  },
                ],
              },
            },
          ],
          usageMetadata: {
            promptTokenCount: 100,
            candidatesTokenCount: 50,
          },
        }),
      });

      const result = await client.parseInvoice(
        'Erstelle eine Rechnung für Müller GmbH, 5 Stunden Beratung zu je 100 Euro'
      );

      expect(result.success).toBe(true);
      expect(result.invoice?.customerName).toBe('Müller GmbH');
      expect(result.invoice?.items).toHaveLength(1);
      expect(result.invoice?.items[0].description).toBe('Beratung');
    });

    it('should handle partial invoice data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      customerName: 'Test AG',
                      items: [],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });

      const result = await client.parseInvoice('Rechnung für Test AG');

      expect(result.success).toBe(true);
      expect(result.invoice?.customerName).toBe('Test AG');
      expect(result.confidence).toBeLessThan(1);
    });

    it('should calculate confidence score', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      customerName: 'Complete GmbH',
                      customerEmail: 'test@complete.de',
                      items: [{ description: 'Service', quantity: 1, unitPrice: 500 }],
                      notes: 'Vielen Dank',
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });

      const result = await client.parseInvoice('Complete invoice text');

      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should handle no invoice found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'Ich konnte keine Rechnungsdaten finden.',
                  },
                ],
              },
            },
          ],
        }),
      });

      const result = await client.parseInvoice('Das Wetter ist schön heute');

      expect(result.success).toBe(false);
      expect(result.invoice).toBeUndefined();
    });

    it('should use German prompt for DE locale', async () => {
      const germanClient = new GeminiClient({
        apiKey: testApiKey,
        locale: 'de',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: '{}' }],
              },
            },
          ],
        }),
      });

      await germanClient.parseInvoice('Text');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('Rechnungsdaten'),
        })
      );
    });
  });

  describe('completeInvoice', () => {
    it('should suggest missing fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      suggestions: {
                        dueDate: '2024-02-15',
                        paymentTerms: 'Zahlbar innerhalb von 14 Tagen',
                      },
                      reason: 'Standard-Zahlungsziel für B2B',
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });

      const partialInvoice = {
        customerName: 'Test GmbH',
        items: [{ description: 'Service', quantity: 1, unitPrice: 100 }],
      };

      const result = await client.completeInvoice(partialInvoice);

      expect(result.success).toBe(true);
      expect(result.suggestions?.dueDate).toBeDefined();
    });
  });

  describe('retry logic', () => {
    it('should retry on 429 errors', async () => {
      // Use a client with maxRetries: 2 for this test
      const retryClient = new GeminiClient({ apiKey: testApiKey, maxRetries: 2 });

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [{ alternatives: [{ transcript: 'Success' }] }],
          }),
        });

      const result = await retryClient.transcribe('audio', 'audio/webm');

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    }, 15000);

    it('should respect max retries', async () => {
      // Use a client with maxRetries: 3 for this test
      const retryClient = new GeminiClient({ apiKey: testApiKey, maxRetries: 3 });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
      });

      const result = await retryClient.transcribe('audio', 'audio/webm');

      expect(result.success).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    }, 15000);

    it('should not retry on 4xx errors except 429', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      const result = await client.transcribe('audio', 'audio/webm');

      expect(result.success).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('usage tracking', () => {
    it('should track request count', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] }),
      });

      await client.transcribe('audio1', 'audio/webm');
      await client.transcribe('audio2', 'audio/webm');

      const stats = client.getUsageStats();
      expect(stats.requestCount).toBe(2);
    });

    it('should track token usage from Gemini', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{}' }] } }],
          usageMetadata: {
            promptTokenCount: 100,
            candidatesTokenCount: 50,
          },
        }),
      });

      await client.parseInvoice('test');

      const stats = client.getUsageStats();
      expect(stats.totalInputTokens).toBe(100);
      expect(stats.totalOutputTokens).toBe(50);
    });
  });
});
