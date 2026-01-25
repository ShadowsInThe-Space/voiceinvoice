/**
 * Phone Agent module for VoiceInvoice Desktop.
 *
 * Provides integration with n8n workflow for AI-powered phone calls.
 *
 * @module lib/phone-agent
 */

export {
  triggerPhoneAgent,
  triggerPhoneAgentWithText,
  getCallStatus,
  blobToBase64,
} from './phone-agent-client';

export type {
  PhoneAgentRequest,
  PhoneAgentResponse,
  CallStatus,
  PhoneAgentConfig,
} from './phone-agent-client';
