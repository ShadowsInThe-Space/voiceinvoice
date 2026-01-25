/**
 * Google Cloud Text-to-Speech API Route
 *
 * Provides high-quality German TTS using Google Cloud TTS API.
 * Converts text to audio using WaveNet voices for natural-sounding speech.
 *
 * @module api/speech/tts
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

/**
 * Request body for TTS endpoint.
 */
interface TTSRequest {
  /** Text to convert to speech */
  text: string;
  /** Language code (default: de-DE) */
  languageCode?: string;
  /** Speaking rate 0.5-2.0 (default: 1.0) */
  speakingRate?: number;
  /** Voice name (optional, uses default if not specified) */
  voiceName?: string;
}

/**
 * Response from TTS endpoint.
 */
interface TTSResponse {
  /** Base64 encoded audio content */
  audioContent: string;
  /** MIME type of the audio */
  mimeType: string;
}

/**
 * Error response from TTS endpoint.
 */
interface TTSErrorResponse {
  /** Error message */
  message: string;
}

/**
 * Google Cloud TTS API endpoint.
 *
 * POST /api/speech/tts
 * Body: { text, languageCode?, speakingRate?, voiceName? }
 * Returns: { audioContent, mimeType }
 *
 * @param {NextApiRequest} req - Next.js API request
 * @param {NextApiResponse<TTSResponse | TTSErrorResponse>} res - Next.js API response
 * @returns {Promise<void>} Response with audio data or error
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TTSResponse | TTSErrorResponse>
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const { text, languageCode = 'de-DE', speakingRate = 1.0, voiceName }: TTSRequest = req.body;

  // Validate input
  if (!text || typeof text !== 'string') {
    res.status(400).json({ message: 'Invalid text parameter' });
    return;
  }

  if (text.length > 5000) {
    res.status(400).json({ message: 'Text too long (max 5000 characters)' });
    return;
  }

  if (speakingRate < 0.5 || speakingRate > 2.0) {
    res.status(400).json({ message: 'Speaking rate must be between 0.5 and 2.0' });
    return;
  }

  try {
    // Initialize Google Cloud TTS client
    // Uses GOOGLE_APPLICATION_CREDENTIALS or Application Default Credentials
    const client = new TextToSpeechClient();

    // Select voice based on language
    // WaveNet voices provide the most natural-sounding speech
    const voice = {
      languageCode,
      name: voiceName || getDefaultVoiceName(languageCode),
      ssmlGender: 'NEUTRAL' as const,
    };

    // Configure audio output
    const audioConfig = {
      audioEncoding: 'LINEAR16' as const, // WAV format
      speakingRate,
      pitch: 0.0, // Default pitch
      sampleRateHertz: 24000, // High quality 24kHz
    };

    // Perform TTS request
    const [response] = await client.synthesizeSpeech({
      input: { text },
      voice,
      audioConfig,
    });

    if (!response.audioContent) {
      throw new Error('No audio content received from Google TTS');
    }

    // Convert Buffer to base64 string
    const audioBase64 = Buffer.from(response.audioContent as Uint8Array).toString('base64');

    res.status(200).json({
      audioContent: audioBase64,
      mimeType: 'audio/wav',
    });
  } catch (error) {
    console.error('[TTS API] Error:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Text-to-Speech conversion failed';

    // Don't expose internal error details in production
    const sanitizedMessage =
      process.env.NODE_ENV === 'production' ? 'TTS service temporarily unavailable' : errorMessage;

    res.status(500).json({ message: sanitizedMessage });
  }
}

/**
 * Get default WaveNet voice name for a language.
 *
 * @param {string} languageCode - Language code (e.g., 'de-DE')
 * @returns {string} Default voice name
 */
function getDefaultVoiceName(languageCode: string): string {
  // Map of language codes to high-quality WaveNet voices
  const defaultVoices: Record<string, string> = {
    'de-DE': 'de-DE-Wavenet-F', // Female German voice (most natural)
    'en-US': 'en-US-Wavenet-D', // Male US English voice
    'en-GB': 'en-GB-Wavenet-A', // Female UK English voice
  };

  return defaultVoices[languageCode] || `${languageCode}-Wavenet-A`;
}
