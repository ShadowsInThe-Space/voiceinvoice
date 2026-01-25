/**
 * Phone Agent Client for VoiceInvoice Desktop.
 *
 * Triggers n8n workflow to initiate AI phone calls for customer reminders.
 *
 * @module lib/phone-agent
 * @example
 * ```typescript
 * import { triggerPhoneAgent } from './phone-agent-client';
 *
 * const audioBlob = await recorder.stop();
 * const result = await triggerPhoneAgent(audioBlob);
 * console.log(`Call initiated: ${result.call_id}`);
 * ```
 */

/**
 * Request payload for phone agent webhook.
 */
export interface PhoneAgentRequest {
  /** Base64-encoded audio data */
  audioData: string;
  /** Optional: Pre-transcribed text (skips Whisper) */
  transcribedText?: string;
  /** Optional: Override urgency level */
  urgency?: 'freundlich' | 'normal' | 'dringend';
}

/**
 * Response from phone agent webhook.
 */
export interface PhoneAgentResponse {
  /** Whether the call was successfully initiated */
  success: boolean;
  /** Human-readable status message */
  message: string;
  /** VAPI call ID for tracking */
  call_id: string;
  /** Detected intent from voice command */
  intent: 'rechnung_erinnerung' | 'termin_erinnerung';
  /** Customer phone number being called */
  kunde_phone: string;
}

/**
 * Call status from VAPI callback.
 */
export interface CallStatus {
  call_id: string;
  status: 'initiated' | 'ringing' | 'in-progress' | 'completed' | 'failed';
  duration_seconds?: number;
  outcome?: 'zahlung_zugesagt' | 'termin_bestaetigt' | 'rueckruf_gewuenscht' | 'nicht_erreicht' | 'abgelehnt';
  transcript?: string;
  sentiment?: 'positiv' | 'neutral' | 'negativ';
}

/**
 * Configuration for phone agent client.
 */
export interface PhoneAgentConfig {
  /** n8n webhook URL for voice commands */
  webhookUrl: string;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
}

const DEFAULT_CONFIG: PhoneAgentConfig = {
  webhookUrl: process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/voice-command',
  timeout: 30000,
};

/**
 * Converts a Blob to Base64 string.
 *
 * @param blob - Audio blob to convert
 * @returns Base64-encoded string (without data URL prefix)
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:audio/webm;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Triggers the phone agent workflow via n8n webhook.
 *
 * @param audioBlob - Recorded audio blob containing the voice command
 * @param config - Optional configuration overrides
 * @returns Promise resolving to the phone agent response
 * @throws Error if the webhook call fails
 *
 * @example
 * ```typescript
 * // With audio blob from recorder
 * const response = await triggerPhoneAgent(audioBlob);
 *
 * // With custom config
 * const response = await triggerPhoneAgent(audioBlob, {
 *   webhookUrl: 'https://my-n8n.com/webhook/voice-command',
 *   timeout: 60000,
 * });
 * ```
 */
export async function triggerPhoneAgent(
  audioBlob: Blob,
  config: Partial<PhoneAgentConfig> = {}
): Promise<PhoneAgentResponse> {
  const { webhookUrl, timeout } = { ...DEFAULT_CONFIG, ...config };

  const base64Audio = await blobToBase64(audioBlob);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audioData: base64Audio,
      } satisfies PhoneAgentRequest),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Phone agent request failed: ${response.status} - ${errorText}`);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Phone agent request timed out after ${timeout}ms`);
    }

    throw error;
  }
}

/**
 * Triggers phone agent with pre-transcribed text (skips Whisper).
 *
 * @param text - Already transcribed voice command
 * @param urgency - Override urgency level
 * @param config - Optional configuration overrides
 * @returns Promise resolving to the phone agent response
 *
 * @example
 * ```typescript
 * const response = await triggerPhoneAgentWithText(
 *   "Ruf Müller GmbH an wegen der offenen Rechnung",
 *   "dringend"
 * );
 * ```
 */
export async function triggerPhoneAgentWithText(
  text: string,
  urgency: 'freundlich' | 'normal' | 'dringend' = 'normal',
  config: Partial<PhoneAgentConfig> = {}
): Promise<PhoneAgentResponse> {
  const { webhookUrl, timeout } = { ...DEFAULT_CONFIG, ...config };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audioData: '',
        transcribedText: text,
        urgency,
      } satisfies PhoneAgentRequest),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Phone agent request failed: ${response.status} - ${errorText}`);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Phone agent request timed out after ${timeout}ms`);
    }

    throw error;
  }
}

/**
 * Fetches the status of an ongoing or completed call.
 *
 * @param callId - VAPI call ID
 * @param config - Optional configuration overrides
 * @returns Promise resolving to the call status
 */
export async function getCallStatus(
  callId: string,
  config: Partial<PhoneAgentConfig> = {}
): Promise<CallStatus> {
  const { webhookUrl, timeout } = { ...DEFAULT_CONFIG, ...config };
  const statusUrl = webhookUrl.replace('/voice-command', '/call-status');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${statusUrl}?call_id=${encodeURIComponent(callId)}`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to get call status: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}
