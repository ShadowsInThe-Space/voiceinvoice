/**
 * Voice Agent module for VoiceInvoice Desktop.
 *
 * Provides integration with:
 * - Gemini 2.5 Flash Live API (native audio)
 * - ElevenLabs Conversational AI 2.0
 * - OpenAI Realtime API (GPT-4o native audio)
 * - OpenAI Pipeline (Whisper → GPT-4 → TTS)
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

export {
  OpenAIRealtimeClient,
  type OpenAIRealtimeConfig,
  type OpenAITool,
  type OpenAIRealtimeEvents,
} from './openai-realtime-client';

export {
  OpenAIPipelineClient,
  type OpenAIPipelineConfig,
  type OpenAIPipelineEvents,
} from './openai-pipeline-client';

export {
  VoiceAgentFactory,
  type VoiceAgentProvider,
  type UnifiedVoiceAgentConfig,
  type UnifiedVoiceAgent,
} from './voice-agent-factory';
