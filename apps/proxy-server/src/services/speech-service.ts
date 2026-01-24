/**
 * Google Cloud Speech-to-Text Service (Chirp 3)
 *
 * Handles audio transcription using Google's Chirp 3 model
 * via the Google AI API (Gemini multimodal endpoint).
 *
 * @module speech-service
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Options for audio transcription.
 */
export interface TranscribeOptions {
  /** BCP-47 language code (default: 'de-DE') */
  language?: string;
  /** Audio format (default: 'webm') */
  format?: string;
}

/**
 * Result of audio transcription.
 */
export interface TranscribeResult {
  /** Transcribed text */
  transcript: string;
  /** Confidence score (0.0 - 1.0) */
  confidence: number;
}

/**
 * Get the Gemini API client.
 * Uses GOOGLE_API_KEY environment variable.
 */
function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY environment variable is not set');
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Map audio format to MIME type.
 * @param format
 */
function getMimeType(format: string): string {
  const mimeTypes: Record<string, string> = {
    webm: 'audio/webm',
    wav: 'audio/wav',
    mp3: 'audio/mp3',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    m4a: 'audio/m4a',
  };
  return mimeTypes[format.toLowerCase()] || 'audio/webm';
}

/**
 * Transcribe audio using Google's Gemini model with audio understanding.
 *
 * This uses Gemini 2.0 Flash which has native audio understanding capabilities,
 * effectively replacing the need for a separate STT API call.
 *
 * @param audioBuffer - Raw audio data as Buffer
 * @param options - Transcription options
 * @returns Promise with transcript and confidence
 *
 * @example
 * ```typescript
 * const result = await transcribeAudio(audioBuffer, { language: 'de-DE' });
 * console.log(result.transcript); // "Rechnung an Firma Mustermann..."
 * ```
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  options: TranscribeOptions = {}
): Promise<TranscribeResult> {
  const { language = 'de-DE', format = 'webm' } = options;

  const client = getClient();

  // Use Gemini 2.0 Flash for audio transcription (it has native audio support)
  const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const languageName = getLanguageName(language);
  const prompt = `Transcribe this audio recording accurately. The audio is in ${languageName}.
Provide ONLY the transcription text, nothing else. No explanations, no prefixes like "Transcription:" - just the spoken words.
If you cannot understand parts of the audio, indicate with [unclear].
If the audio is silent or empty, respond with [no speech detected].`;

  try {
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: getMimeType(format),
          data: audioBuffer.toString('base64'),
        },
      },
    ]);

    const response = result.response;
    const transcript = response.text().trim();

    // Calculate confidence based on response quality
    const confidence = calculateConfidence(transcript);

    return {
      transcript,
      confidence,
    };
  } catch (error) {
    // Wrap error with more context
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Transcription failed: ${errorMessage}`);
  }
}

/**
 * Get human-readable language name from BCP-47 code.
 * @param languageCode
 */
function getLanguageName(languageCode: string): string {
  const languages: Record<string, string> = {
    'de-DE': 'German',
    'de-AT': 'Austrian German',
    'de-CH': 'Swiss German',
    'en-US': 'English (US)',
    'en-GB': 'English (UK)',
    'fr-FR': 'French',
    'es-ES': 'Spanish',
    'it-IT': 'Italian',
    'nl-NL': 'Dutch',
  };
  return languages[languageCode] || 'German';
}

/**
 * Calculate confidence score based on transcript quality indicators.
 * @param transcript
 */
function calculateConfidence(transcript: string): number {
  if (!transcript || transcript === '[no speech detected]') {
    return 0.0;
  }

  let confidence = 0.9; // Base confidence

  // Reduce confidence for unclear markers
  const unclearCount = (transcript.match(/\[unclear\]/gi) || []).length;
  confidence -= unclearCount * 0.1;

  // Reduce confidence for very short transcripts
  if (transcript.length < 10) {
    confidence -= 0.2;
  }

  // Ensure confidence is within bounds
  return Math.max(0.1, Math.min(1.0, confidence));
}

/**
 * Check if the speech service is available.
 * Used for health checks.
 */
export async function checkAvailability(): Promise<boolean> {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    return !!apiKey;
  } catch {
    return false;
  }
}
