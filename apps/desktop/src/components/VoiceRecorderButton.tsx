/**
 * VoiceRecorderButton component.
 *
 * A button component for starting and stopping voice recordings
 * with visual feedback during recording.
 *
 * @module components/VoiceRecorderButton
 */

import React, { useCallback } from 'react';
import { useVoiceRecording } from '../hooks/use-voice-recording';

/**
 * Props for VoiceRecorderButton component.
 */
export interface VoiceRecorderButtonProps {
  /** Callback when recording completes successfully */
  onRecordingComplete: (blob: Blob, duration: number) => void;
  /** Whether the button is disabled */
  disabled?: boolean;
}

/**
 * Formats duration in milliseconds to MM:SS format.
 *
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration string
 */
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Voice recorder button with start/stop functionality.
 *
 * Provides a visual interface for voice recording with:
 * - Recording state indicator
 * - Duration display during recording
 * - Error state feedback
 *
 * @param {VoiceRecorderButtonProps} props - Component props
 * @returns {JSX.Element} Rendered component
 *
 * @example
 * <VoiceRecorderButton
 *   onRecordingComplete={(blob, duration) => {
 *     console.log(`Recorded ${duration}ms of audio`);
 *   }}
 * />
 */
export function VoiceRecorderButton({
  onRecordingComplete,
  disabled = false,
}: VoiceRecorderButtonProps): JSX.Element {
  const {
    isRecording,
    duration,
    error,
    startRecording,
    stopRecording,
  } = useVoiceRecording({
    onStop: (result) => {
      if (result.blob) {
        onRecordingComplete(result.blob, result.duration);
      }
    },
  });

  /**
   * Handles button click to toggle recording state.
   */
  const handleClick = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const ariaLabel = isRecording ? 'Aufnahme stoppen' : 'Aufnahme starten';

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-label={ariaLabel}
        className={`
          relative flex items-center justify-center
          w-16 h-16 rounded-full
          transition-all duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-offset-2
          ${
            isRecording
              ? 'bg-red-500 hover:bg-red-600 focus:ring-red-500'
              : 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        {/* Microphone icon when idle */}
        {!isRecording && (
          <svg
            className="w-8 h-8 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        )}

        {/* Stop icon when recording */}
        {isRecording && (
          <svg
            className="w-8 h-8 text-white"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        )}

        {/* Recording pulse animation */}
        {isRecording && (
          <span
            data-testid="recording-indicator"
            className="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-75"
          />
        )}
      </button>

      {/* Duration display */}
      {isRecording && (
        <span className="text-sm font-mono text-gray-700">
          {formatDuration(duration)}
        </span>
      )}

      {/* Error display */}
      {error && (
        <span className="text-sm text-red-600">
          Fehler: {error.message}
        </span>
      )}
    </div>
  );
}
