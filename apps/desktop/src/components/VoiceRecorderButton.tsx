/**
 * VoiceRecorderButton component.
 *
 * A prominent, animated recording button for the voice-first workflow.
 * Features a glowing pulse effect during recording and clear visual feedback.
 *
 * @module components/VoiceRecorderButton
 */

import React, { useCallback } from 'react';
import { useVoiceRecording } from '../hooks/use-voice-recording';
import { useHotkey } from '../hooks/use-hotkey';
import { cn } from '../lib/utils';
import { Mic, Square, Keyboard } from 'lucide-react';

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
 * @returns {string} Formatted string
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
 * @param {VoiceRecorderButtonProps} root0 - The component props
 * @param {Function} root0.onRecordingComplete - Callback when recording finishes
 * @param {boolean} [root0.disabled] - Whether the button is disabled
 * @returns {JSX.Element} The rendered component
 */
export function VoiceRecorderButton({
  onRecordingComplete,
  disabled = false,
}: VoiceRecorderButtonProps): JSX.Element {
  const { isRecording, duration, error, startRecording, stopRecording } = useVoiceRecording({
    onStop: (result) => {
      if (result.blob) {
        onRecordingComplete(result.blob, result.duration);
      }
    },
  });

  const handleClick = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Register Alt + Space hotkey for voice recording
  useHotkey({
    key: ' ',
    modifiers: { alt: true },
    callback: handleClick,
    enabled: !disabled,
    description: 'Toggle voice recording',
  });

  const ariaLabel = isRecording ? 'Aufnahme stoppen' : 'Aufnahme starten';

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-8">
      <div className="relative group">
        {/* Pulsing Ring Background */}
        <div
          className={cn(
            'absolute inset-0 rounded-full bg-accent/30 blur-2xl transition-all duration-700',
            isRecording ? 'opacity-100 animate-pulse-glow' : 'opacity-0 scale-50'
          )}
        />

        <button
          type="button"
          onClick={handleClick}
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            'relative flex items-center justify-center w-28 h-28 rounded-full shadow-2xl transition-all duration-500 ease-out transform active:scale-90 border-8',
            isRecording
              ? 'bg-accent border-accent-foreground/20 hover:bg-accent/90'
              : 'bg-primary border-primary-foreground/10 hover:bg-primary/90 hover:scale-105',
            disabled && 'opacity-50 cursor-not-allowed saturate-0'
          )}
        >
          {isRecording ? (
            <Square className="w-12 h-12 text-white fill-current" />
          ) : (
            <Mic className="w-12 h-12 text-white" />
          )}
        </button>
      </div>

      <div className="flex flex-col items-center gap-3 min-h-24">
        {/* Status Text & Timer */}
        <div
          className={cn(
            'flex items-center gap-2 px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all duration-500 border-2',
            isRecording
              ? 'bg-accent/10 text-accent border-accent/20 animate-pulse'
              : 'bg-muted text-muted-foreground border-transparent'
          )}
        >
          {isRecording ? (
            <>
              <div
                data-testid="recording-indicator"
                className="w-2.5 h-2.5 rounded-full bg-accent animate-ping"
              />
              <span>Live Transkription...</span>
            </>
          ) : (
            <span>Bereit für Spracheingabe</span>
          )}
        </div>

        {/* Hotkey Hint */}
        {!isRecording && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground/70 transition-opacity duration-300">
            <Keyboard className="w-3.5 h-3.5" />
            <span>Alt + Leertaste zum Starten</span>
          </div>
        )}

        {/* Timer Display */}
        <div
          className={cn(
            'font-mono text-2xl font-bold tracking-wider transition-opacity duration-300',
            isRecording ? 'opacity-100 text-foreground' : 'opacity-0'
          )}
        >
          {formatDuration(duration)}
        </div>

        {/* Error Display */}
        {error && (
          <div className="absolute mt-20 text-sm font-medium text-destructive bg-destructive/10 px-3 py-1 rounded-md">
            Fehler: {error.message}
          </div>
        )}
      </div>
    </div>
  );
}
