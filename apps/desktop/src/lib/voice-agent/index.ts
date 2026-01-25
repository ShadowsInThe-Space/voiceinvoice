/**
 * Voice Agent module for VoiceInvoice Desktop.
 *
 * Provides integration with:
 * - Gemini 2.5 Flash Live API (native audio)
 * - ElevenLabs Conversational AI 2.0
 *
 * @module lib/voice-agent
 */

export { GeminiLiveClient, type GeminiLiveConfig, type GeminiTool, type GeminiLiveEvents } from './gemini-live-client';

export {
  ElevenLabsConversationalAgent,
  createInvoiceReminderAgent,
  createAppointmentReminderAgent,
  GERMAN_VOICES,
  type ElevenLabsAgentConfig,
  type ElevenLabsTool,
  type ElevenLabsAgentEvents,
  type ConversationSummary,
} from './elevenlabs-conversational';
