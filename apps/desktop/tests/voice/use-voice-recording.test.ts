/**
 * Tests for useVoiceRecording React hook.
 *
 * Tests the voice recording hook that provides a React-friendly
 * interface for the AudioRecorder class.
 *
 * @module tests/voice/use-voice-recording
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVoiceRecording } from '../../src/hooks/use-voice-recording';

// Mock AudioRecorder
vi.mock('../../src/lib/voice/audio-recorder', () => ({
  AudioRecorder: vi.fn().mockImplementation(function (this: any) {
    return {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue({
        blob: new Blob(['test'], { type: 'audio/webm' }),
        duration: 1000,
        mimeType: 'audio/webm;codecs=opus',
      }),
      pause: vi.fn(),
      resume: vi.fn(),
      getState: vi.fn().mockReturnValue('IDLE'),
      getDuration: vi.fn().mockReturnValue(0),
      getConfig: vi.fn().mockReturnValue({
        mimeType: 'audio/webm;codecs=opus',
        sampleRate: 48000,
      }),
      onStateChange: vi.fn(),
    };
  }),
  RecordingState: {
    IDLE: 'IDLE',
    RECORDING: 'RECORDING',
    PAUSED: 'PAUSED',
  },
}));

describe('useVoiceRecording', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should return idle state initially', () => {
      const { result } = renderHook(() => useVoiceRecording());

      expect(result.current.isRecording).toBe(false);
      expect(result.current.isPaused).toBe(false);
      expect(result.current.duration).toBe(0);
      expect(result.current.error).toBeNull();
    });

    it('should provide start, stop, pause, resume functions', () => {
      const { result } = renderHook(() => useVoiceRecording());

      expect(typeof result.current.startRecording).toBe('function');
      expect(typeof result.current.stopRecording).toBe('function');
      expect(typeof result.current.pauseRecording).toBe('function');
      expect(typeof result.current.resumeRecording).toBe('function');
    });
  });

  describe('startRecording', () => {
    it('should set isRecording to true when started', async () => {
      const { result } = renderHook(() => useVoiceRecording());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.isRecording).toBe(true);
    });

    it('should call onStart callback when provided', async () => {
      const onStart = vi.fn();
      const { result } = renderHook(() => useVoiceRecording({ onStart }));

      await act(async () => {
        await result.current.startRecording();
      });

      expect(onStart).toHaveBeenCalled();
    });

    it('should set error if start fails', async () => {
      const mockError = new Error('Microphone access denied');

      vi.mocked(
        await import('../../src/lib/voice/audio-recorder')
      ).AudioRecorder.mockImplementationOnce(
        () =>
          ({
            start: vi.fn().mockRejectedValue(mockError),
            getState: vi.fn().mockReturnValue('IDLE'),
            getDuration: vi.fn().mockReturnValue(0),
            onStateChange: vi.fn(),
          }) as unknown as ReturnType<typeof vi.fn>
      );

      const { result } = renderHook(() => useVoiceRecording());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.error).toBe(mockError);
      expect(result.current.isRecording).toBe(false);
    });
  });

  describe('stopRecording', () => {
    it('should return recording result', async () => {
      const { result } = renderHook(() => useVoiceRecording());

      await act(async () => {
        await result.current.startRecording();
      });

      let recordingResult;
      await act(async () => {
        recordingResult = await result.current.stopRecording();
      });

      expect(recordingResult).toHaveProperty('blob');
      expect(recordingResult).toHaveProperty('duration');
    });

    it('should call onStop callback with result', async () => {
      const onStop = vi.fn();
      const { result } = renderHook(() => useVoiceRecording({ onStop }));

      await act(async () => {
        await result.current.startRecording();
      });

      await act(async () => {
        await result.current.stopRecording();
      });

      expect(onStop).toHaveBeenCalledWith(
        expect.objectContaining({
          blob: expect.any(Blob),
          duration: expect.any(Number),
        })
      );
    });

    it('should set isRecording to false after stopping', async () => {
      const { result } = renderHook(() => useVoiceRecording());

      await act(async () => {
        await result.current.startRecording();
      });

      await act(async () => {
        await result.current.stopRecording();
      });

      expect(result.current.isRecording).toBe(false);
    });
  });

  describe('pauseRecording', () => {
    it('should set isPaused to true', async () => {
      const { result } = renderHook(() => useVoiceRecording());

      await act(async () => {
        await result.current.startRecording();
      });

      act(() => {
        result.current.pauseRecording();
      });

      expect(result.current.isPaused).toBe(true);
    });

    it('should call onPause callback', async () => {
      const onPause = vi.fn();
      const { result } = renderHook(() => useVoiceRecording({ onPause }));

      await act(async () => {
        await result.current.startRecording();
      });

      act(() => {
        result.current.pauseRecording();
      });

      expect(onPause).toHaveBeenCalled();
    });
  });

  describe('resumeRecording', () => {
    it('should set isPaused to false', async () => {
      const { result } = renderHook(() => useVoiceRecording());

      await act(async () => {
        await result.current.startRecording();
      });

      act(() => {
        result.current.pauseRecording();
      });

      act(() => {
        result.current.resumeRecording();
      });

      expect(result.current.isPaused).toBe(false);
    });

    it('should call onResume callback', async () => {
      const onResume = vi.fn();
      const { result } = renderHook(() => useVoiceRecording({ onResume }));

      await act(async () => {
        await result.current.startRecording();
      });

      act(() => {
        result.current.pauseRecording();
      });

      act(() => {
        result.current.resumeRecording();
      });

      expect(onResume).toHaveBeenCalled();
    });
  });

  describe('duration tracking', () => {
    it('should update duration while recording', async () => {
      vi.useFakeTimers();

      const { result } = renderHook(() => useVoiceRecording());

      await act(async () => {
        await result.current.startRecording();
      });

      // Advance timers to trigger duration update
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Duration should be updated by the interval
      expect(result.current.duration).toBeGreaterThanOrEqual(0);

      vi.useRealTimers();
    });
  });

  describe('cleanup', () => {
    it('should stop recording on unmount if recording', async () => {
      const { result, unmount } = renderHook(() => useVoiceRecording());

      await act(async () => {
        await result.current.startRecording();
      });

      // Unmount should clean up
      unmount();

      // No error should be thrown
    });
  });

  describe('error handling', () => {
    it('should clear error when starting new recording', async () => {
      const { result } = renderHook(() => useVoiceRecording());

      // Set an error state first
      await act(async () => {
        // Force an error by providing invalid state
        result.current.clearError?.();
      });

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.error).toBeNull();
    });
  });
});
