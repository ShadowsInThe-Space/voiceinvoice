/**
 * Text-to-Speech module exports.
 *
 * Provides Google Cloud TTS integration for voice output.
 *
 * @module lib/tts
 */

export {
  TTSClient,
  VoiceResponseHelper,
  PlaybackState,
  GERMAN_VOICES,
  type TTSConfig,
  type SpeakOptions,
  type Invoice,
} from './tts-client';
