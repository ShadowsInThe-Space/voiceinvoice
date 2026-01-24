/**
 * Integration Tests: TTS Pipeline
 *
 * Tests the complete flow from Invoice to Voice Response:
 * 1. Invoice -> Voice Response Generation
 * 2. Tests Queue Management
 * 3. Mocks Audio Playback (no actual audio output in tests)
 *
 * @module tests/integration/tts
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import {
  TTSClient,
  TTSConfig,
  VoiceResponseHelper,
  PlaybackState,
  Invoice,
} from '../../src/lib/tts/tts-client';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Store created audio instances for test control
let audioInstances: MockAudio[] = [];

// Mock Audio class
class MockAudio {
  src: string = '';
  onplay: (() => void) | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _paused: boolean = true;

  constructor(src?: string) {
    if (src) this.src = src;
    // Register instance immediately on creation
    audioInstances.push(this);
  }

  async play(): Promise<void> {
    this._paused = false;
    // Simulate async playback start
    setTimeout(() => {
      if (this.onplay) this.onplay();
    }, 10);
    return Promise.resolve();
  }

  pause(): void {
    this._paused = true;
  }

  get paused(): boolean {
    return this._paused;
  }

  // Simulate playback completion
  simulateEnd(): void {
    if (this.onended) this.onended();
  }

  // Simulate playback error
  simulateError(): void {
    if (this.onerror) this.onerror();
  }
}

// Replace global Audio
(global as unknown as { Audio: typeof MockAudio }).Audio = MockAudio;
const originalAudio = MockAudio;

describe('TTS Pipeline Integration', () => {
  const TEST_CONFIG: TTSConfig = {
    apiKey: 'test-api-key',
    voice: 'de-DE-Wavenet-C',
    speakingRate: 1.0,
    pitch: 0,
  };

  // Mock TTS API response
  const MOCK_TTS_RESPONSE = {
    audioContent: 'SGVsbG8gV29ybGQ=', // "Hello World" in base64
  };

  let ttsClient: TTSClient;
  let voiceHelper: VoiceResponseHelper;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    audioInstances = [];

    // Restore Audio mock
    (global as unknown as { Audio: typeof MockAudio }).Audio = MockAudio;

    // Mock successful TTS API response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => MOCK_TTS_RESPONSE,
    });

    // Initialize clients
    ttsClient = new TTSClient(TEST_CONFIG);
    voiceHelper = new VoiceResponseHelper(ttsClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (global as unknown as { Audio: typeof MockAudio }).Audio = originalAudio;
  });

  describe('TTSClient Basic Operations', () => {
    it('should initialize with correct configuration', () => {
      // Act
      const config = ttsClient.getConfig();

      // Assert
      expect(config.apiKey).toBe('test-api-key');
      expect(config.voice).toBe('de-DE-Wavenet-C');
      expect(config.speakingRate).toBe(1.0);
      expect(config.pitch).toBe(0);
    });

    it('should start in IDLE state', () => {
      // Assert
      expect(ttsClient.getState()).toBe(PlaybackState.IDLE);
      expect(ttsClient.isSpeaking).toBe(false);
      expect(ttsClient.isPaused).toBe(false);
    });

    it('should clamp speaking rate to valid range', () => {
      // Arrange
      const clientWithHighRate = new TTSClient({
        apiKey: 'test',
        speakingRate: 5.0, // Above max
      });

      const clientWithLowRate = new TTSClient({
        apiKey: 'test',
        speakingRate: 0.1, // Below min
      });

      // Assert
      expect(clientWithHighRate.getConfig().speakingRate).toBe(2.0);
      expect(clientWithLowRate.getConfig().speakingRate).toBe(0.5);
    });

    it('should clamp pitch to valid range', () => {
      // Arrange
      const clientWithHighPitch = new TTSClient({
        apiKey: 'test',
        pitch: 30, // Above max
      });

      const clientWithLowPitch = new TTSClient({
        apiKey: 'test',
        pitch: -30, // Below min
      });

      // Assert
      expect(clientWithHighPitch.getConfig().pitch).toBe(20);
      expect(clientWithLowPitch.getConfig().pitch).toBe(-20);
    });
  });

  describe('TTSClient Speak Operations', () => {
    it('should call TTS API with correct parameters', async () => {
      // Arrange & Act
      const speakPromise = ttsClient.speak({ text: 'Hallo Welt' });

      // Wait for audio instance to be created and simulate completion
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(audioInstances.length).toBeGreaterThan(0);
      audioInstances[audioInstances.length - 1].simulateEnd();

      await speakPromise;

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('texttospeech.googleapis.com'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Hallo Welt'),
        })
      );
    });

    it('should include voice configuration in API request', async () => {
      // Arrange & Act
      const speakPromise = ttsClient.speak({ text: 'Test' });

      await new Promise((resolve) => setTimeout(resolve, 50));
      audioInstances[audioInstances.length - 1].simulateEnd();
      await speakPromise;

      // Assert
      const callBody = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body);
      expect(callBody.voice.name).toBe('de-DE-Wavenet-C');
      expect(callBody.voice.languageCode).toBe('de-DE');
      expect(callBody.audioConfig.speakingRate).toBe(1.0);
      expect(callBody.audioConfig.pitch).toBe(0);
    });

    it('should trigger onStart callback when playback begins', async () => {
      // Arrange
      const onStartMock = vi.fn();
      ttsClient.onStart = onStartMock;

      const speakPromise = ttsClient.speak({ text: 'Test' });

      await new Promise((resolve) => setTimeout(resolve, 50));
      audioInstances[audioInstances.length - 1].simulateEnd();
      await speakPromise;

      // Assert
      expect(onStartMock).toHaveBeenCalled();
    });

    it('should trigger onEnd callback when playback completes', async () => {
      // Arrange
      const onEndMock = vi.fn();
      ttsClient.onEnd = onEndMock;

      const speakPromise = ttsClient.speak({ text: 'Test' });

      await new Promise((resolve) => setTimeout(resolve, 50));
      audioInstances[audioInstances.length - 1].simulateEnd();
      await speakPromise;

      // Assert
      expect(onEndMock).toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const onErrorMock = vi.fn();
      ttsClient.onError = onErrorMock;

      // Act & Assert
      await expect(ttsClient.speak({ text: 'Test' })).rejects.toThrow(
        'Unauthorized: Invalid API key'
      );
      expect(onErrorMock).toHaveBeenCalled();
    });

    it('should handle rate limit errors', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });

      // Act & Assert
      await expect(ttsClient.speak({ text: 'Test' })).rejects.toThrow('Rate limit exceeded');
    });

    it('should allow voice override for specific speak calls', async () => {
      // Arrange & Act
      const speakPromise = ttsClient.speak({
        text: 'Test',
        voice: 'de-DE-Wavenet-A',
      });

      await new Promise((resolve) => setTimeout(resolve, 50));
      audioInstances[audioInstances.length - 1].simulateEnd();
      await speakPromise;

      // Assert
      const callBody = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body);
      expect(callBody.voice.name).toBe('de-DE-Wavenet-A');
    });
  });

  describe('TTSClient Stop/Pause/Resume', () => {
    it('should stop playback and clear queue', async () => {
      // Arrange
      ttsClient.queueText('First');
      ttsClient.queueText('Second');
      expect(ttsClient.getQueueLength()).toBe(2);

      // Act
      ttsClient.stop();

      // Assert
      expect(ttsClient.getQueueLength()).toBe(0);
      expect(ttsClient.getState()).toBe(PlaybackState.IDLE);
    });

    it('should pause and resume playback', async () => {
      // This test simulates the pause/resume flow
      // Arrange - Start playback
      const speakPromise = ttsClient.speak({ text: 'Long text' });

      await new Promise((resolve) => setTimeout(resolve, 50));
      const audioInstance = audioInstances[audioInstances.length - 1];

      // Manually trigger onplay to set state to PLAYING
      if (audioInstance.onplay) {
        audioInstance.onplay();
      }

      expect(ttsClient.getState()).toBe(PlaybackState.PLAYING);

      // Act - Pause
      ttsClient.pause();
      expect(ttsClient.getState()).toBe(PlaybackState.PAUSED);
      expect(ttsClient.isPaused).toBe(true);

      // Act - Resume
      ttsClient.resume();
      expect(ttsClient.getState()).toBe(PlaybackState.PLAYING);

      // Cleanup
      audioInstance.simulateEnd();
      await speakPromise;
    });

    it('should not pause when not playing', () => {
      // Arrange - In IDLE state
      expect(ttsClient.getState()).toBe(PlaybackState.IDLE);

      // Act
      ttsClient.pause();

      // Assert - State unchanged
      expect(ttsClient.getState()).toBe(PlaybackState.IDLE);
    });

    it('should not resume when not paused', () => {
      // Arrange - In IDLE state
      expect(ttsClient.getState()).toBe(PlaybackState.IDLE);

      // Act
      ttsClient.resume();

      // Assert - State unchanged
      expect(ttsClient.getState()).toBe(PlaybackState.IDLE);
    });
  });

  describe('TTSClient Queue Management', () => {
    it('should add items to queue', () => {
      // Act
      ttsClient.queueText('First');
      ttsClient.queueText('Second');
      ttsClient.queueText('Third', 'de-DE-Wavenet-B');

      // Assert
      expect(ttsClient.getQueueLength()).toBe(3);
    });

    it('should clear queue without stopping current playback', () => {
      // Arrange
      ttsClient.queueText('First');
      ttsClient.queueText('Second');

      // Act
      ttsClient.clearQueue();

      // Assert
      expect(ttsClient.getQueueLength()).toBe(0);
    });

    it('should process queue sequentially', async () => {
      // Arrange
      ttsClient.queueText('First');
      ttsClient.queueText('Second');

      // Act - Start processing
      const processPromise = ttsClient.processQueue();

      // Simulate first audio completion
      await new Promise((resolve) => setTimeout(resolve, 50));
      audioInstances[audioInstances.length - 1].simulateEnd();

      // Simulate second audio completion
      await new Promise((resolve) => setTimeout(resolve, 50));
      audioInstances[audioInstances.length - 1].simulateEnd();

      await processPromise;

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(ttsClient.getQueueLength()).toBe(0);
    });

    it('should not process queue if already processing', async () => {
      // Arrange
      ttsClient.queueText('First');

      // Act - Start two process calls
      const promise1 = ttsClient.processQueue();
      const promise2 = ttsClient.processQueue();

      await new Promise((resolve) => setTimeout(resolve, 50));
      audioInstances[audioInstances.length - 1].simulateEnd();

      await Promise.all([promise1, promise2]);

      // Assert - Should only process once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('VoiceResponseHelper Integration', () => {
    it('should confirm invoice creation with correct text', async () => {
      // Arrange
      const invoice: Invoice = {
        id: 'inv-1',
        number: 'INV-000001',
        customerName: 'Test GmbH',
        total: 1234.56,
        items: [{ description: 'Service', quantity: 1, unitPrice: 1234.56 }],
        status: 'draft',
        createdAt: new Date(),
      };

      const speakSpy = vi.spyOn(ttsClient, 'speak');

      // Act
      const confirmPromise = voiceHelper.confirmInvoiceCreated(invoice);

      await new Promise((resolve) => setTimeout(resolve, 50));
      audioInstances[audioInstances.length - 1].simulateEnd();
      await confirmPromise;

      // Assert
      expect(speakSpy).toHaveBeenCalledWith({
        text: expect.stringContaining('INV-000001'),
      });
      expect(speakSpy).toHaveBeenCalledWith({
        text: expect.stringContaining('Test GmbH'),
      });
      expect(speakSpy).toHaveBeenCalledWith({
        text: expect.stringContaining('1234,56'),
      });
    });

    it('should report error with correct text', async () => {
      // Arrange
      const speakSpy = vi.spyOn(ttsClient, 'speak');

      // Act
      const errorPromise = voiceHelper.reportError('Datenbank nicht erreichbar');

      await new Promise((resolve) => setTimeout(resolve, 50));
      audioInstances[audioInstances.length - 1].simulateEnd();
      await errorPromise;

      // Assert
      expect(speakSpy).toHaveBeenCalledWith({
        text: expect.stringContaining('Fehler aufgetreten'),
      });
      expect(speakSpy).toHaveBeenCalledWith({
        text: expect.stringContaining('Datenbank nicht erreichbar'),
      });
    });

    it('should ask for confirmation', async () => {
      // Arrange
      const speakSpy = vi.spyOn(ttsClient, 'speak');
      const question = 'Soll ich die Rechnung senden?';

      // Act
      const confirmPromise = voiceHelper.askForConfirmation(question);

      await new Promise((resolve) => setTimeout(resolve, 50));
      audioInstances[audioInstances.length - 1].simulateEnd();
      await confirmPromise;

      // Assert
      expect(speakSpy).toHaveBeenCalledWith({ text: question });
    });

    it('should read invoice summary', async () => {
      // Arrange
      const invoice: Invoice = {
        id: 'inv-2',
        number: 'INV-000002',
        customerName: 'Muster AG',
        total: 500,
        items: [
          { description: 'Item 1', quantity: 2, unitPrice: 150 },
          { description: 'Item 2', quantity: 1, unitPrice: 200 },
        ],
        status: 'sent',
        createdAt: new Date(),
      };

      const speakSpy = vi.spyOn(ttsClient, 'speak');

      // Act
      const summaryPromise = voiceHelper.readInvoiceSummary(invoice);

      await new Promise((resolve) => setTimeout(resolve, 50));
      audioInstances[audioInstances.length - 1].simulateEnd();
      await summaryPromise;

      // Assert
      expect(speakSpy).toHaveBeenCalledWith({
        text: expect.stringContaining('2 Positionen'),
      });
      expect(speakSpy).toHaveBeenCalledWith({
        text: expect.stringContaining('500,00'),
      });
    });

    it('should speak custom text', async () => {
      // Arrange
      const speakSpy = vi.spyOn(ttsClient, 'speak');
      const customText = 'Dies ist ein benutzerdefinierter Text.';

      // Act
      const customPromise = voiceHelper.speakCustom(customText);

      await new Promise((resolve) => setTimeout(resolve, 50));
      audioInstances[audioInstances.length - 1].simulateEnd();
      await customPromise;

      // Assert
      expect(speakSpy).toHaveBeenCalledWith({ text: customText });
    });
  });

  describe('SSML Support', () => {
    it('should support SSML input', async () => {
      // Arrange
      const ssml = '<speak>Hallo <break time="500ms"/> Welt</speak>';

      // Act
      const ssmlPromise = ttsClient.speakSSML(ssml);

      await new Promise((resolve) => setTimeout(resolve, 50));
      audioInstances[audioInstances.length - 1].simulateEnd();
      await ssmlPromise;

      // Assert
      const callBody = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body);
      expect(callBody.input.ssml).toBe(ssml);
      expect(callBody.input.text).toBeUndefined();
    });
  });

  describe('Interrupt Behavior', () => {
    it('should interrupt current playback when interrupt option is true', async () => {
      // Arrange - Start first speak
      const speak1Promise = ttsClient.speak({ text: 'First' });

      await new Promise((resolve) => setTimeout(resolve, 50));
      const firstAudio = audioInstances[audioInstances.length - 1];

      // Manually trigger onplay
      if (firstAudio.onplay) {
        firstAudio.onplay();
      }

      expect(ttsClient.getState()).toBe(PlaybackState.PLAYING);

      // Act - Interrupt with second speak
      const speak2Promise = ttsClient.speak({ text: 'Second', interrupt: true });

      // First promise should reject
      await expect(speak1Promise).rejects.toThrow('Playback interrupted');

      // Complete second speak
      await new Promise((resolve) => setTimeout(resolve, 50));
      audioInstances[audioInstances.length - 1].simulateEnd();
      await speak2Promise;

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Audio Playback Error Handling', () => {
    it('should handle audio playback errors', async () => {
      // Arrange
      const onErrorMock = vi.fn();
      ttsClient.onError = onErrorMock;

      // Act
      const speakPromise = ttsClient.speak({ text: 'Test' });

      await new Promise((resolve) => setTimeout(resolve, 50));
      audioInstances[audioInstances.length - 1].simulateError();

      // Assert
      await expect(speakPromise).rejects.toThrow('Audio playback error');
      expect(onErrorMock).toHaveBeenCalled();
      expect(ttsClient.getState()).toBe(PlaybackState.IDLE);
    });
  });
});
