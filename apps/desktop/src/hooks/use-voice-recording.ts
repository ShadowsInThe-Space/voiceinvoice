/**
 * React hook for voice recording.
 *
 * Provides a React-friendly interface for the AudioRecorder class
 * with automatic state management and cleanup.
 *
 * @module hooks/use-voice-recording
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  AudioRecorder,
  AudioRecorderConfig,
  RecordingState,
  RecordingResult,
} from '../lib/voice/audio-recorder';

/**
 * Options for the useVoiceRecording hook.
 */
export interface VoiceRecordingOptions {
  /** Custom AudioRecorder configuration */
  config?: Partial<AudioRecorderConfig>;

  /** Callback when recording starts */
  onStart?: () => void;

  /** Callback when recording stops */
  onStop?: (result: RecordingResult) => void;

  /** Callback when recording is paused */
  onPause?: () => void;

  /** Callback when recording is resumed */
  onResume?: () => void;

  /** Callback when an error occurs */
  onError?: (error: Error) => void;

  /** Duration update interval in ms (default: 100) */
  durationUpdateInterval?: number;
}

/**
 * Return type for the useVoiceRecording hook.
 */
export interface VoiceRecordingState {
  /** Whether currently recording */
  isRecording: boolean;

  /** Whether recording is paused */
  isPaused: boolean;

  /** Current recording duration in ms */
  duration: number;

  /** Current error, if any */
  error: Error | null;

  /** Starts recording */
  startRecording: () => Promise<void>;

  /** Stops recording and returns result */
  stopRecording: () => Promise<RecordingResult | null>;

  /** Pauses recording */
  pauseRecording: () => void;

  /** Resumes paused recording */
  resumeRecording: () => void;

  /** Clears any error state */
  clearError: () => void;
}

/**
 * React hook for voice recording functionality.
 *
 * Provides a simple API for recording voice input in React components.
 * Handles state management, cleanup, and error handling automatically.
 *
 * @param {VoiceRecordingOptions} options - Hook options
 * @returns {VoiceRecordingState} Recording state and control functions
 *
 * @example
 * function VoiceInput() {
 *   const {
 *     isRecording,
 *     duration,
 *     startRecording,
 *     stopRecording,
 *   } = useVoiceRecording({
 *     onStop: (result) => {
 *       console.log('Recorded', result.duration, 'ms');
 *     },
 *   });
 *
 *   return (
 *     <button onClick={isRecording ? stopRecording : startRecording}>
 *       {isRecording ? `Recording... ${duration}ms` : 'Start Recording'}
 *     </button>
 *   );
 * }
 */
export function useVoiceRecording(options: VoiceRecordingOptions = {}): VoiceRecordingState {
  const {
    config,
    onStart,
    onStop,
    onPause,
    onResume,
    onError,
    durationUpdateInterval = 100,
  } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize recorder
  useEffect(() => {
    recorderRef.current = new AudioRecorder(config);

    return (): void => {
      // Cleanup on unmount
      if (recorderRef.current?.getState() !== RecordingState.IDLE) {
        recorderRef.current?.stop().catch(() => {
          // Ignore errors during cleanup
        });
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [config]);

  // Start duration tracking
  const startDurationTracking = useCallback((): void => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }

    durationIntervalRef.current = setInterval(() => {
      if (recorderRef.current) {
        setDuration(recorderRef.current.getDuration());
      }
    }, durationUpdateInterval);
  }, [durationUpdateInterval]);

  // Stop duration tracking
  const stopDurationTracking = useCallback((): void => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  /**
   * Starts recording.
   */
  const startRecording = useCallback(async (): Promise<void> => {
    setError(null);

    try {
      if (!recorderRef.current) {
        recorderRef.current = new AudioRecorder(config);
      }

      await recorderRef.current.start();
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);
      startDurationTracking();

      onStart?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setIsRecording(false);
      onError?.(error);
    }
  }, [config, onStart, onError, startDurationTracking]);

  /**
   * Stops recording and returns the result.
   */
  const stopRecording = useCallback(async (): Promise<RecordingResult | null> => {
    if (!recorderRef.current || !isRecording) {
      return null;
    }

    try {
      stopDurationTracking();
      const result = await recorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);

      onStop?.(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setIsRecording(false);
      setIsPaused(false);
      onError?.(error);
      return null;
    }
  }, [isRecording, onStop, onError, stopDurationTracking]);

  /**
   * Pauses recording.
   */
  const pauseRecording = useCallback((): void => {
    if (!recorderRef.current || !isRecording || isPaused) {
      return;
    }

    try {
      recorderRef.current.pause();
      setIsPaused(true);
      stopDurationTracking();
      onPause?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    }
  }, [isRecording, isPaused, onPause, onError, stopDurationTracking]);

  /**
   * Resumes paused recording.
   */
  const resumeRecording = useCallback((): void => {
    if (!recorderRef.current || !isPaused) {
      return;
    }

    try {
      recorderRef.current.resume();
      setIsPaused(false);
      startDurationTracking();
      onResume?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    }
  }, [isPaused, onResume, onError, startDurationTracking]);

  /**
   * Clears any error state.
   */
  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  return {
    isRecording,
    isPaused,
    duration,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearError,
  };
}
