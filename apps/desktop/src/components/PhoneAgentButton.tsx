/**
 * Phone Agent Button component for VoiceInvoice Desktop.
 *
 * Provides a voice-activated button to trigger AI phone calls for customer reminders.
 *
 * @module components/PhoneAgentButton
 * @example
 * ```tsx
 * <PhoneAgentButton
 *   onCallComplete={(status) => console.log('Call done:', status)}
 * />
 * ```
 */

import React, { useState, useCallback } from 'react';
import { useVoiceRecording } from '../hooks/use-voice-recording';
import { usePhoneAgent, type UsePhoneAgentOptions } from '../hooks/use-phone-agent';
import type { CallStatus } from '../lib/phone-agent';

/**
 * Props for PhoneAgentButton component.
 */
export interface PhoneAgentButtonProps {
  /** Additional CSS classes */
  className?: string;
  /** Callback when call completes */
  onCallComplete?: (status: CallStatus) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Whether to show status indicator */
  showStatus?: boolean;
  /** Custom labels */
  labels?: {
    idle?: string;
    recording?: string;
    processing?: string;
    calling?: string;
  };
}

type ButtonState = 'idle' | 'recording' | 'processing' | 'calling';

const defaultLabels = {
  idle: 'Sprachbefehl starten',
  recording: 'Aufnahme läuft... (Tippen zum Stoppen)',
  processing: 'Verarbeite...',
  calling: 'Anruf läuft...',
};

const statusLabels: Record<string, string> = {
  zahlung_zugesagt: '✅ Zahlung zugesagt',
  termin_bestaetigt: '✅ Termin bestätigt',
  rueckruf_gewuenscht: '📞 Rückruf gewünscht',
  nicht_erreicht: '❌ Nicht erreicht',
  abgelehnt: '❌ Abgelehnt',
};

/**
 * Voice-activated button component for triggering phone agent calls.
 *
 * @param props - Component props
 * @returns React component
 */
export function PhoneAgentButton({
  className = '',
  onCallComplete,
  onError,
  showStatus = true,
  labels = {},
}: PhoneAgentButtonProps): React.ReactElement {
  const mergedLabels = { ...defaultLabels, ...labels };
  const [buttonState, setButtonState] = useState<ButtonState>('idle');

  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    isRecording: _isRecording,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    audioBlob: _audioBlob,
    startRecording,
    stopRecording,
    error: recordingError,
  } = useVoiceRecording({
    maxDuration: 30000, // 30 seconds max
    onError: (err) => {
      setButtonState('idle');
      onError?.(err);
    },
  });

  const phoneAgentOptions: UsePhoneAgentOptions = {
    onCallInitiated: () => {
      setButtonState('calling');
    },
    onCallComplete: (status) => {
      setButtonState('idle');
      onCallComplete?.(status);
    },
    onError: (err) => {
      setButtonState('idle');
      onError?.(err);
    },
  };

  const {
    initiateCall,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    isLoading: _isLoading,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    isCallInProgress: _isCallInProgress,
    callStatus,
    error: phoneError,
  } = usePhoneAgent(phoneAgentOptions);

  const handleClick = useCallback(async () => {
    if (buttonState === 'idle') {
      // Start recording
      await startRecording();
      setButtonState('recording');
    } else if (buttonState === 'recording') {
      // Stop recording and process
      setButtonState('processing');
      const blob = await stopRecording();

      if (blob && blob.size > 0) {
        try {
          await initiateCall(blob);
        } catch {
          setButtonState('idle');
        }
      } else {
        setButtonState('idle');
      }
    }
  }, [buttonState, startRecording, stopRecording, initiateCall]);

  const getButtonLabel = (): string => {
    switch (buttonState) {
      case 'recording':
        return mergedLabels.recording;
      case 'processing':
        return mergedLabels.processing;
      case 'calling':
        return mergedLabels.calling;
      default:
        return mergedLabels.idle;
    }
  };

  const getButtonStyle = (): string => {
    const baseStyle =
      'px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center gap-2';

    switch (buttonState) {
      case 'recording':
        return `${baseStyle} bg-red-500 hover:bg-red-600 text-white animate-pulse`;
      case 'processing':
        return `${baseStyle} bg-yellow-500 text-white cursor-wait`;
      case 'calling':
        return `${baseStyle} bg-green-500 text-white cursor-wait`;
      default:
        return `${baseStyle} bg-blue-600 hover:bg-blue-700 text-white`;
    }
  };

  const error = recordingError || phoneError;

  return (
    <div className={`phone-agent-button-container ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={buttonState === 'processing' || buttonState === 'calling'}
        className={getButtonStyle()}
        aria-label={getButtonLabel()}
      >
        {/* Microphone Icon */}
        {buttonState === 'idle' && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
              clipRule="evenodd"
            />
          </svg>
        )}

        {/* Recording Animation */}
        {buttonState === 'recording' && (
          <span className="flex gap-1">
            <span className="w-2 h-2 bg-white rounded-full animate-bounce" />
            <span
              className="w-2 h-2 bg-white rounded-full animate-bounce"
              style={{ animationDelay: '0.1s' }}
            />
            <span
              className="w-2 h-2 bg-white rounded-full animate-bounce"
              style={{ animationDelay: '0.2s' }}
            />
          </span>
        )}

        {/* Loading Spinner */}
        {(buttonState === 'processing' || buttonState === 'calling') && (
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}

        {/* Phone Icon for calling */}
        {buttonState === 'calling' && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
          </svg>
        )}

        <span>{getButtonLabel()}</span>
      </button>

      {/* Status Display */}
      {showStatus && callStatus && (
        <div className="mt-3 p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
          <div className="text-sm font-medium">
            Anruf-Status: <span className="capitalize">{callStatus.status}</span>
          </div>

          {callStatus.outcome && (
            <div className="mt-1 text-sm">
              Ergebnis: {statusLabels[callStatus.outcome] || callStatus.outcome}
            </div>
          )}

          {callStatus.duration_seconds && (
            <div className="mt-1 text-xs text-gray-500">
              Dauer: {Math.floor(callStatus.duration_seconds / 60)}:
              {String(callStatus.duration_seconds % 60).padStart(2, '0')}
            </div>
          )}

          {callStatus.sentiment && (
            <div className="mt-1 text-xs">
              Stimmung:{' '}
              <span
                className={
                  callStatus.sentiment === 'positiv'
                    ? 'text-green-600'
                    : callStatus.sentiment === 'negativ'
                      ? 'text-red-600'
                      : 'text-gray-600'
                }
              >
                {callStatus.sentiment}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-2 p-2 rounded bg-red-100 text-red-700 text-sm">{error}</div>
      )}

      {/* Usage Hint */}
      {buttonState === 'idle' && !callStatus && (
        <p className="mt-2 text-xs text-gray-500">
          Beispiel: &quot;Ruf Müller GmbH an wegen der offenen Rechnung&quot;
        </p>
      )}
    </div>
  );
}

export default PhoneAgentButton;
