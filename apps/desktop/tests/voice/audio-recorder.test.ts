/**
 * Tests for AudioRecorder class.
 *
 * Tests the audio recording functionality using MediaRecorder API.
 *
 * @module tests/voice/audio-recorder
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AudioRecorder,
  AudioRecorderConfig,
  RecordingState,
} from '../../src/lib/voice/audio-recorder';

// Mock MediaRecorder
class MockMediaRecorder {
  state: string = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((error: Error) => void) | null = null;

  private chunks: Blob[] = [];

  start(): void {
    this.state = 'recording';
  }

  stop(): void {
    this.state = 'inactive';
    // Simulate data available
    if (this.ondataavailable) {
      this.ondataavailable({ data: new Blob(['test audio data'], { type: 'audio/webm' }) });
    }
    if (this.onstop) {
      this.onstop();
    }
  }

  pause(): void {
    this.state = 'paused';
  }

  resume(): void {
    this.state = 'recording';
  }

  requestData(): void {
    // Simulate data available event with current recording data
    if (this.ondataavailable) {
      this.ondataavailable({ data: new Blob(['test audio data'], { type: 'audio/webm' }) });
    }
  }

  static isTypeSupported(mimeType: string): boolean {
    return mimeType.includes('audio/webm') || mimeType.includes('audio/ogg');
  }
}

// Mock navigator.mediaDevices
const mockGetUserMedia = vi.fn();

describe('AudioRecorder', () => {
  let recorder: AudioRecorder;
  let originalMediaRecorder: typeof MediaRecorder;
  let originalNavigator: Navigator;

  beforeEach(() => {
    // Save originals
    originalMediaRecorder = global.MediaRecorder;
    originalNavigator = global.navigator;

    // Mock MediaRecorder
    global.MediaRecorder = MockMediaRecorder as unknown as typeof MediaRecorder;

    // Mock navigator.mediaDevices
    Object.defineProperty(global, 'navigator', {
      value: {
        mediaDevices: {
          getUserMedia: mockGetUserMedia.mockResolvedValue({
            getTracks: () => [{ stop: vi.fn() }],
          }),
        },
      },
      writable: true,
    });

    recorder = new AudioRecorder();
  });

  afterEach(() => {
    // Restore originals
    global.MediaRecorder = originalMediaRecorder;
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
    });
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create recorder with default config', () => {
      const rec = new AudioRecorder();
      const config = rec.getConfig();

      expect(config.mimeType).toBe('audio/webm;codecs=opus');
      // Google recommends 16kHz for Chirp 3 transcription
      expect(config.sampleRate).toBe(16000);
    });

    it('should accept custom config', () => {
      const customConfig: Partial<AudioRecorderConfig> = {
        mimeType: 'audio/ogg;codecs=opus',
        sampleRate: 44100,
      };

      const rec = new AudioRecorder(customConfig);
      const config = rec.getConfig();

      expect(config.mimeType).toBe('audio/ogg;codecs=opus');
      expect(config.sampleRate).toBe(44100);
    });
  });

  describe('getState', () => {
    it('should return IDLE initially', () => {
      expect(recorder.getState()).toBe(RecordingState.IDLE);
    });
  });

  describe('start', () => {
    it('should request microphone access', async () => {
      await recorder.start();

      // Note: noiseSuppression is false because Chirp 3 has built-in denoiser
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        audio: expect.objectContaining({
          echoCancellation: true,
          noiseSuppression: false,
        }),
      });
    });

    it('should change state to RECORDING', async () => {
      await recorder.start();

      expect(recorder.getState()).toBe(RecordingState.RECORDING);
    });

    it('should throw error if already recording', async () => {
      await recorder.start();

      await expect(recorder.start()).rejects.toThrow('Already recording');
    });

    it('should emit onStateChange callback', async () => {
      const onStateChange = vi.fn();
      recorder.onStateChange(onStateChange);

      await recorder.start();

      expect(onStateChange).toHaveBeenCalledWith(RecordingState.RECORDING);
    });
  });

  describe('stop', () => {
    it('should return recording result', async () => {
      await recorder.start();
      const result = await recorder.stop();

      expect(result).toHaveProperty('blob');
      expect(result).toHaveProperty('duration');
      expect(result.blob).toBeInstanceOf(Blob);
    });

    it('should change state to IDLE', async () => {
      await recorder.start();
      await recorder.stop();

      expect(recorder.getState()).toBe(RecordingState.IDLE);
    });

    it('should throw error if not recording', async () => {
      await expect(recorder.stop()).rejects.toThrow('Not recording');
    });

    it('should stop all media tracks', async () => {
      const mockStop = vi.fn();
      mockGetUserMedia.mockResolvedValueOnce({
        getTracks: () => [{ stop: mockStop }],
      });

      await recorder.start();
      await recorder.stop();

      expect(mockStop).toHaveBeenCalled();
    });
  });

  describe('pause', () => {
    it('should change state to PAUSED', async () => {
      await recorder.start();
      recorder.pause();

      expect(recorder.getState()).toBe(RecordingState.PAUSED);
    });

    it('should throw error if not recording', () => {
      expect(() => recorder.pause()).toThrow('Not recording');
    });
  });

  describe('resume', () => {
    it('should change state back to RECORDING', async () => {
      await recorder.start();
      recorder.pause();
      recorder.resume();

      expect(recorder.getState()).toBe(RecordingState.RECORDING);
    });

    it('should throw error if not paused', async () => {
      await recorder.start();

      expect(() => recorder.resume()).toThrow('Not paused');
    });
  });

  describe('getDuration', () => {
    it('should return 0 when not recording', () => {
      expect(recorder.getDuration()).toBe(0);
    });

    it('should return elapsed time when recording', async () => {
      await recorder.start();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      const duration = recorder.getDuration();
      expect(duration).toBeGreaterThan(0);
    });
  });

  describe('isSupported', () => {
    it('should return true when MediaRecorder is available', () => {
      expect(AudioRecorder.isSupported()).toBe(true);
    });
  });

  describe('getSupportedMimeTypes', () => {
    it('should return array of supported mime types', () => {
      const types = AudioRecorder.getSupportedMimeTypes();

      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
    });
  });
});
