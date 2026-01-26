/**
 * Google Cloud Text-to-Speech API Route
 *
 * Provides high-quality German TTS using Google Cloud TTS API.
 * Converts text to audio using WaveNet voices for natural-sounding speech.
 *
 * @module api/speech/tts
 */

import type { NextApiRequest, NextApiResponse } from 'next';

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

  // Get API key - check multiple sources with fallback
  const apiKey = process.env.GEMINI_API_KEY
    || process.env.NEXT_PUBLIC_GOOGLE_API_KEY
    || 'AIzaSyAhM6S1SWtsMoKptlsxhYr84lWNgSep8fE'; // Fallback for dev

  console.log('[TTS API] Using API Key (first 10 chars):', apiKey?.substring(0, 10));

  if (!apiKey) {
    console.error('[TTS API] No API Key found in env vars');
    res.status(500).json({ message: 'No API Key configured for TTS' });
    return;
  }

  try {
    // Select voice
    const selectedVoiceName = voiceName || getDefaultVoiceName(languageCode);

    // Use REST API directly with API key (more reliable than ADC)
    const cloudTtsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

    const response = await fetch(cloudTtsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode,
          name: selectedVoiceName,
          ssmlGender: 'NEUTRAL',
        },
        audioConfig: {
          audioEncoding: 'LINEAR16', // WAV format
          speakingRate,
          pitch: 0.0,
          sampleRateHertz: 24000,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[TTS API] Cloud TTS failed:', errorData);
      throw new Error(errorData.error?.message || `TTS API error ${response.status}`);
    }

    const data = await response.json();

    if (!data.audioContent) {
      throw new Error('No audio content in response');
    }

    res.status(200).json({
      audioContent: data.audioContent,
      mimeType: 'audio/wav',
    });
  } catch (error) {
    console.error('[TTS API] Error:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Text-to-Speech conversion failed';

    res.status(500).json({ message: errorMessage });
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
