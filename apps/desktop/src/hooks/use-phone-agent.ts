/**
 * React hook for phone agent integration.
 *
 * @module hooks/use-phone-agent
 * @example
 * ```tsx
 * function PhoneAgentButton() {
 *   const { initiateCall, isLoading, lastCall, error } = usePhoneAgent();
 *   const { startRecording, stopRecording, audioBlob } = useVoiceRecording();
 *
 *   const handleCall = async () => {
 *     if (audioBlob) {
 *       await initiateCall(audioBlob);
 *     }
 *   };
 *
 *   return (
 *     <button onClick={handleCall} disabled={isLoading}>
 *       {isLoading ? 'Wird verbunden...' : 'Anruf starten'}
 *     </button>
 *   );
 * }
 * ```
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  triggerPhoneAgent,
  triggerPhoneAgentWithText,
  getCallStatus,
  type PhoneAgentResponse,
  type CallStatus,
  type PhoneAgentConfig,
} from '../lib/phone-agent';

/**
 * State for phone agent hook.
 */
export interface PhoneAgentState {
  /** Whether a call is currently being initiated */
  isLoading: boolean;
  /** Whether the call is in progress */
  isCallInProgress: boolean;
  /** The last initiated call response */
  lastCall: PhoneAgentResponse | null;
  /** Current call status (updated via polling) */
  callStatus: CallStatus | null;
  /** Error message if call failed */
  error: string | null;
}

/**
 * Options for usePhoneAgent hook.
 */
export interface UsePhoneAgentOptions {
  /** Configuration overrides for phone agent client */
  config?: Partial<PhoneAgentConfig>;
  /** Whether to poll for call status updates (default: true) */
  pollStatus?: boolean;
  /** Polling interval in milliseconds (default: 5000) */
  pollInterval?: number;
  /** Callback when call is initiated */
  onCallInitiated?: (response: PhoneAgentResponse) => void;
  /** Callback when call status changes */
  onStatusChange?: (status: CallStatus) => void;
  /** Callback when call completes */
  onCallComplete?: (status: CallStatus) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

/**
 * Return type for usePhoneAgent hook.
 */
export interface UsePhoneAgentReturn extends PhoneAgentState {
  /** Initiate a call with audio blob */
  initiateCall: (audioBlob: Blob) => Promise<PhoneAgentResponse>;
  /** Initiate a call with text command */
  initiateCallWithText: (
    text: string,
    urgency?: 'freundlich' | 'normal' | 'dringend'
  ) => Promise<PhoneAgentResponse>;
  /** Manually refresh call status */
  refreshStatus: () => Promise<void>;
  /** Reset state */
  reset: () => void;
}

/**
 * React hook for managing phone agent calls.
 *
 * Provides state management, status polling, and callbacks for phone agent integration.
 *
 * @param options - Hook configuration options
 * @returns Phone agent state and methods
 *
 * @example
 * ```tsx
 * function CustomerReminder({ customerId }: { customerId: string }) {
 *   const {
 *     initiateCallWithText,
 *     isLoading,
 *     isCallInProgress,
 *     callStatus,
 *     error,
 *   } = usePhoneAgent({
 *     onCallComplete: (status) => {
 *       console.log('Call completed:', status.outcome);
 *     },
 *   });
 *
 *   const handleReminderCall = () => {
 *     initiateCallWithText(
 *       `Ruf Kunde ${customerId} an wegen der offenen Rechnung`,
 *       'normal'
 *     );
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleReminderCall} disabled={isLoading || isCallInProgress}>
 *         {isLoading ? 'Verbinde...' : isCallInProgress ? 'Anruf läuft...' : 'Erinnerung anrufen'}
 *       </button>
 *
 *       {callStatus && (
 *         <div>
 *           Status: {callStatus.status}
 *           {callStatus.outcome && <span> - {callStatus.outcome}</span>}
 *         </div>
 *       )}
 *
 *       {error && <div className="error">{error}</div>}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePhoneAgent(options: UsePhoneAgentOptions = {}): UsePhoneAgentReturn {
  const {
    config,
    pollStatus = true,
    pollInterval = 5000,
    onCallInitiated,
    onStatusChange,
    onCallComplete,
    onError,
  } = options;

  const [state, setState] = useState<PhoneAgentState>({
    isLoading: false,
    isCallInProgress: false,
    lastCall: null,
    callStatus: null,
    error: null,
  });

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastStatusRef = useRef<string | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Poll for status updates
  const startPolling = useCallback(
    (callId: string) => {
      if (!pollStatus) return;

      // Clear existing polling
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }

      const poll = async () => {
        try {
          const status = await getCallStatus(callId, config);

          // Only update if status changed
          if (JSON.stringify(status) !== lastStatusRef.current) {
            lastStatusRef.current = JSON.stringify(status);

            setState((prev) => ({
              ...prev,
              callStatus: status,
              isCallInProgress: status.status !== 'completed' && status.status !== 'failed',
            }));

            onStatusChange?.(status);

            // Stop polling if call completed
            if (status.status === 'completed' || status.status === 'failed') {
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
              onCallComplete?.(status);
            }
          }
        } catch (error) {
          console.error('Failed to poll call status:', error);
        }
      };

      // Initial poll
      poll();

      // Start interval
      pollIntervalRef.current = setInterval(poll, pollInterval);
    },
    [pollStatus, pollInterval, config, onStatusChange, onCallComplete]
  );

  const initiateCall = useCallback(
    async (audioBlob: Blob): Promise<PhoneAgentResponse> => {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      try {
        const response = await triggerPhoneAgent(audioBlob, config);

        setState((prev) => ({
          ...prev,
          isLoading: false,
          isCallInProgress: true,
          lastCall: response,
        }));

        onCallInitiated?.(response);
        startPolling(response.call_id);

        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Anruf fehlgeschlagen';

        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));

        onError?.(error instanceof Error ? error : new Error(errorMessage));
        throw error;
      }
    },
    [config, onCallInitiated, onError, startPolling]
  );

  const initiateCallWithText = useCallback(
    async (
      text: string,
      urgency: 'freundlich' | 'normal' | 'dringend' = 'normal'
    ): Promise<PhoneAgentResponse> => {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      try {
        const response = await triggerPhoneAgentWithText(text, urgency, config);

        setState((prev) => ({
          ...prev,
          isLoading: false,
          isCallInProgress: true,
          lastCall: response,
        }));

        onCallInitiated?.(response);
        startPolling(response.call_id);

        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Anruf fehlgeschlagen';

        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));

        onError?.(error instanceof Error ? error : new Error(errorMessage));
        throw error;
      }
    },
    [config, onCallInitiated, onError, startPolling]
  );

  const refreshStatus = useCallback(async () => {
    if (!state.lastCall?.call_id) return;

    try {
      const status = await getCallStatus(state.lastCall.call_id, config);
      setState((prev) => ({
        ...prev,
        callStatus: status,
        isCallInProgress: status.status !== 'completed' && status.status !== 'failed',
      }));
    } catch (error) {
      console.error('Failed to refresh status:', error);
    }
  }, [state.lastCall?.call_id, config]);

  const reset = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    lastStatusRef.current = null;

    setState({
      isLoading: false,
      isCallInProgress: false,
      lastCall: null,
      callStatus: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    initiateCall,
    initiateCallWithText,
    refreshStatus,
    reset,
  };
}

export default usePhoneAgent;
