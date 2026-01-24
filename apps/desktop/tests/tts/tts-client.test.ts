/**
 * Tests for TTSClient - Google Cloud Text-to-Speech Client.
 *
 * Tests the TTS functionality including speech synthesis, queue management,
 * and audio playback controls.
 *
 * @module tests/tts/tts-client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  TTSClient,
  type TTSConfig,
  PlaybackState,
  VoiceResponseHelper,
} from '../../src/lib/tts/tts-client';

// Mock Audio element
class MockAudio {
  src: string = '';
  currentTime: number = 0;
  paused: boolean = true;
  volume: number = 1;
  onended: (() => void) | null = null;
  onerror: ((error: Error) => void) | null = null;
  onplay: (() => void) | null = null;
  onpause: (() => void) | null = null;

  play(): Promise<void> {
    this.paused = false;
    if (this.onplay) this.onplay();
    return Promise.resolve();
  }

  pause(): void {
    this.paused = true;
    if (this.onpause) this.onpause();
  }

  // Simulate playback ending
  simulateEnd(): void {
    this.paused = true;
    if (this.onended) this.onended();
  }

  // Simulate error
  simulateError(error: Error): void {
    if (this.onerror) this.onerror(error);
  }
}

// Mock fetch
const mockFetch = vi.fn();

describe('TTSClient', () => {
  let client: TTSClient;
  let mockAudio: MockAudio;
  let originalFetch: typeof global.fetch;
  let originalAudio: typeof Audio;

  const defaultConfig: TTSConfig = {
    apiKey: 'test-api-key',
    voice: 'de-DE-Wavenet-C',
    speakingRate: 1.0,
    pitch: 0,
  };

  beforeEach(() => {
    // Save originals
    originalFetch = global.fetch;
    originalAudio = global.Audio;

    // Mock fetch
    global.fetch = mockFetch;

    // Mock Audio constructor
    mockAudio = new MockAudio();
    global.Audio = vi.fn(() => mockAudio) as unknown as typeof Audio;

    // Default successful API response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        audioContent: 'SGVsbG8gV29ybGQ=', // Base64 "Hello World"
      }),
    });

    client = new TTSClient(defaultConfig);
  });

  afterEach(() => {
    // Restore originals
    global.fetch = originalFetch;
    global.Audio = originalAudio;
    vi.clearAllMocks();
    client.stop();
  });

  describe('constructor', () => {
    it('should create client with default voice when not specified', () => {
      const minimalClient = new TTSClient({ apiKey: 'key' });
      const config = minimalClient.getConfig();

      expect(config.voice).toBe('de-DE-Wavenet-C');
    });

    it('should accept custom configuration', () => {
      const customConfig: TTSConfig = {
        apiKey: 'custom-key',
        voice: 'de-DE-Wavenet-A',
        speakingRate: 1.5,
        pitch: 5,
      };

      const customClient = new TTSClient(customConfig);
      const config = customClient.getConfig();

      expect(config.voice).toBe('de-DE-Wavenet-A');
      expect(config.speakingRate).toBe(1.5);
      expect(config.pitch).toBe(5);
    });

    it('should clamp speakingRate to valid range', () => {
      const slowClient = new TTSClient({ apiKey: 'key', speakingRate: 0.1 });
      expect(slowClient.getConfig().speakingRate).toBe(0.5);

      const fastClient = new TTSClient({ apiKey: 'key', speakingRate: 5.0 });
      expect(fastClient.getConfig().speakingRate).toBe(2.0);
    });

    it('should clamp pitch to valid range', () => {
      const lowClient = new TTSClient({ apiKey: 'key', pitch: -30 });
      expect(lowClient.getConfig().pitch).toBe(-20);

      const highClient = new TTSClient({ apiKey: 'key', pitch: 30 });
      expect(highClient.getConfig().pitch).toBe(20);
    });
  });

  describe('speak', () => {
    it('should call Google TTS API with correct parameters', async () => {
      const speakPromise = client.speak({ text: 'Hallo Welt' });

      // Simulate audio ending
      setTimeout(() => mockAudio.simulateEnd(), 10);
      await speakPromise;

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('texttospeech.googleapis.com'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should use specified voice override', async () => {
      const speakPromise = client.speak({
        text: 'Test',
        voice: 'de-DE-Wavenet-A'
      });

      setTimeout(() => mockAudio.simulateEnd(), 10);
      await speakPromise;

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.voice.name).toBe('de-DE-Wavenet-A');
    });

    it('should set isSpeaking to true during playback', async () => {
      expect(client.isSpeaking).toBe(false);

      const speakPromise = client.speak({ text: 'Test' });

      // Wait for audio to start
      await new Promise(resolve => setTimeout(resolve, 5));
      expect(client.isSpeaking).toBe(true);

      mockAudio.simulateEnd();
      await speakPromise;

      expect(client.isSpeaking).toBe(false);
    });

    it('should call onStart callback when playback begins', async () => {
      const onStart = vi.fn();
      client.onStart = onStart;

      const speakPromise = client.speak({ text: 'Test' });

      await new Promise(resolve => setTimeout(resolve, 5));
      expect(onStart).toHaveBeenCalled();

      mockAudio.simulateEnd();
      await speakPromise;
    });

    it('should call onEnd callback when playback ends', async () => {
      const onEnd = vi.fn();
      client.onEnd = onEnd;

      const speakPromise = client.speak({ text: 'Test' });

      // Wait for audio to start, then end
      await new Promise(resolve => setTimeout(resolve, 20));
      mockAudio.simulateEnd();
      await speakPromise;

      expect(onEnd).toHaveBeenCalled();
    });

    it('should call onError callback on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const onError = vi.fn();
      client.onError = onError;

      await expect(client.speak({ text: 'Test' })).rejects.toThrow();
      expect(onError).toHaveBeenCalled();
    });

    it('should interrupt current playback when interrupt option is true', async () => {
      // Start first speech
      const firstSpeakPromise = client.speak({ text: 'First' }).catch(e => e);
      await new Promise(resolve => setTimeout(resolve, 20));

      // Interrupt with second speech
      const secondSpeakPromise = client.speak({
        text: 'Second',
        interrupt: true
      });

      // Wait and simulate end for second audio
      await new Promise(resolve => setTimeout(resolve, 20));
      mockAudio.simulateEnd();
      await secondSpeakPromise;

      // First speak should have been interrupted
      const firstResult = await firstSpeakPromise;
      expect(firstResult).toBeInstanceOf(Error);
      expect(firstResult.message).toBe('Playback interrupted');
    });
  });

  describe('speakSSML', () => {
    it('should send SSML content to API', async () => {
      const ssml = '<speak><emphasis>Wichtig!</emphasis></speak>';

      const speakPromise = client.speakSSML(ssml);
      setTimeout(() => mockAudio.simulateEnd(), 10);
      await speakPromise;

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.input.ssml).toBe(ssml);
    });
  });

  describe('stop', () => {
    it('should stop current playback', async () => {
      const speakPromise = client.speak({ text: 'Test' });
      await new Promise(resolve => setTimeout(resolve, 5));

      client.stop();

      expect(client.isSpeaking).toBe(false);
      await expect(speakPromise).rejects.toThrow('Playback stopped');
    });

    it('should clear the queue', async () => {
      client.queueText('First');
      client.queueText('Second');

      expect(client.getQueueLength()).toBe(2);

      client.stop();

      expect(client.getQueueLength()).toBe(0);
    });
  });

  describe('pause', () => {
    it('should pause current playback', async () => {
      const speakPromise = client.speak({ text: 'Test' });
      await new Promise(resolve => setTimeout(resolve, 5));

      client.pause();

      expect(client.isPaused).toBe(true);
      expect(mockAudio.paused).toBe(true);

      // Resume and complete
      client.resume();
      mockAudio.simulateEnd();
      await speakPromise;
    });

    it('should do nothing if not speaking', () => {
      expect(() => client.pause()).not.toThrow();
      expect(client.isPaused).toBe(false);
    });
  });

  describe('resume', () => {
    it('should resume paused playback', async () => {
      const speakPromise = client.speak({ text: 'Test' });
      await new Promise(resolve => setTimeout(resolve, 5));

      client.pause();
      expect(client.isPaused).toBe(true);

      client.resume();
      expect(client.isPaused).toBe(false);

      mockAudio.simulateEnd();
      await speakPromise;
    });

    it('should do nothing if not paused', () => {
      expect(() => client.resume()).not.toThrow();
    });
  });

  describe('queueText', () => {
    it('should add text to queue', () => {
      client.queueText('First');
      client.queueText('Second');

      expect(client.getQueueLength()).toBe(2);
    });

    it('should play queued items sequentially', async () => {
      const texts: string[] = [];

      // Track what gets spoken
      mockFetch.mockImplementation(async (_url: string, options: { body: string }) => {
        const body = JSON.parse(options.body);
        texts.push(body.input.text);
        return {
          ok: true,
          json: async () => ({ audioContent: 'dGVzdA==' }),
        };
      });

      client.queueText('First');
      client.queueText('Second');

      // Start processing queue in background
      const processPromise = client.processQueue();

      // Give time for first item to start
      await new Promise(resolve => setTimeout(resolve, 30));
      mockAudio.simulateEnd();

      // Give time for second item to start
      await new Promise(resolve => setTimeout(resolve, 30));
      mockAudio.simulateEnd();

      // Wait for queue to finish
      await processPromise;

      expect(texts).toContain('First');
      expect(texts).toContain('Second');
    });
  });

  describe('clearQueue', () => {
    it('should remove all items from queue', () => {
      client.queueText('First');
      client.queueText('Second');

      expect(client.getQueueLength()).toBe(2);

      client.clearQueue();

      expect(client.getQueueLength()).toBe(0);
    });

    it('should not stop current playback', async () => {
      const speakPromise = client.speak({ text: 'Current' });
      await new Promise(resolve => setTimeout(resolve, 5));

      client.queueText('Queued');
      client.clearQueue();

      // Current playback should continue
      expect(client.isSpeaking).toBe(true);

      mockAudio.simulateEnd();
      await speakPromise;
    });
  });

  describe('getState', () => {
    it('should return IDLE when not playing', () => {
      expect(client.getState()).toBe(PlaybackState.IDLE);
    });

    it('should return PLAYING when speaking', async () => {
      const speakPromise = client.speak({ text: 'Test' });
      await new Promise(resolve => setTimeout(resolve, 5));

      expect(client.getState()).toBe(PlaybackState.PLAYING);

      mockAudio.simulateEnd();
      await speakPromise;
    });

    it('should return PAUSED when paused', async () => {
      const speakPromise = client.speak({ text: 'Test' });
      await new Promise(resolve => setTimeout(resolve, 5));

      client.pause();
      expect(client.getState()).toBe(PlaybackState.PAUSED);

      client.resume();
      mockAudio.simulateEnd();
      await speakPromise;
    });
  });

  describe('API error handling', () => {
    it('should throw on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.speak({ text: 'Test' })).rejects.toThrow('Network error');
    });

    it('should throw on 401 Unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(client.speak({ text: 'Test' })).rejects.toThrow('Unauthorized');
    });

    it('should throw on 429 Rate Limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });

      await expect(client.speak({ text: 'Test' })).rejects.toThrow('Rate limit');
    });
  });
});

describe('VoiceResponseHelper', () => {
  let ttsClient: TTSClient;
  let helper: VoiceResponseHelper;
  let mockAudio: MockAudio;

  const mockInvoice = {
    id: 'INV-001',
    number: 'RE-2024-001',
    customerName: 'Max Mustermann',
    total: 1250.50,
    items: [
      { description: 'Beratung', quantity: 5, unitPrice: 200 },
      { description: 'Reisekosten', quantity: 1, unitPrice: 250.50 },
    ],
    status: 'draft' as const,
    createdAt: new Date('2024-01-15'),
  };

  beforeEach(() => {
    mockAudio = new MockAudio();
    global.Audio = vi.fn(() => mockAudio) as unknown as typeof Audio;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ audioContent: 'dGVzdA==' }),
    });

    ttsClient = new TTSClient({ apiKey: 'test-key' });
    helper = new VoiceResponseHelper(ttsClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
    ttsClient.stop();
  });

  describe('confirmInvoiceCreated', () => {
    it('should speak invoice creation confirmation in German', async () => {
      const speakPromise = helper.confirmInvoiceCreated(mockInvoice);

      setTimeout(() => mockAudio.simulateEnd(), 10);
      await speakPromise;

      const callBody = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      const text = callBody.input.text;

      expect(text).toContain('RE-2024-001');
      expect(text).toContain('Max Mustermann');
      expect(text).toContain('1250,50');
    });
  });

  describe('reportError', () => {
    it('should speak error message in German', async () => {
      const speakPromise = helper.reportError('Verbindung fehlgeschlagen');

      setTimeout(() => mockAudio.simulateEnd(), 10);
      await speakPromise;

      const callBody = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      const text = callBody.input.text;

      expect(text).toContain('Fehler');
      expect(text).toContain('Verbindung fehlgeschlagen');
    });
  });

  describe('askForConfirmation', () => {
    it('should speak confirmation question', async () => {
      const speakPromise = helper.askForConfirmation('Rechnung speichern?');

      setTimeout(() => mockAudio.simulateEnd(), 10);
      await speakPromise;

      const callBody = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      const text = callBody.input.text;

      expect(text).toContain('Rechnung speichern?');
    });
  });

  describe('readInvoiceSummary', () => {
    it('should speak invoice summary with item count and total', async () => {
      const speakPromise = helper.readInvoiceSummary(mockInvoice);

      setTimeout(() => mockAudio.simulateEnd(), 10);
      await speakPromise;

      const callBody = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      const text = callBody.input.text;

      expect(text).toContain('2'); // item count
      expect(text).toContain('1250,50'); // total
      expect(text).toContain('Positionen');
    });
  });

  describe('speakCustom', () => {
    it('should speak custom text', async () => {
      const speakPromise = helper.speakCustom('Benutzerdefinierter Text');

      setTimeout(() => mockAudio.simulateEnd(), 10);
      await speakPromise;

      const callBody = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(callBody.input.text).toBe('Benutzerdefinierter Text');
    });
  });

  describe('German number formatting', () => {
    it('should format currency with German locale', async () => {
      const invoiceWithDecimal = { ...mockInvoice, total: 1234.56 };

      const speakPromise = helper.confirmInvoiceCreated(invoiceWithDecimal);
      setTimeout(() => mockAudio.simulateEnd(), 10);
      await speakPromise;

      const callBody = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      const text = callBody.input.text;

      // Should use German decimal separator (comma)
      expect(text).toContain('1234,56');
    });
  });
});
