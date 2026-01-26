/**
 * Speech Transcription API Route
 *
 * Transcribes audio to text using Chirp 3 (server-side).
 * Falls back to error if Chirp 3 is not available.
 *
 * POST /api/speech/transcribe
 * Body: { audio: base64, mimeType: string }
 *
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { transcribeAudio, isChirp3Available } from '@/lib/speech/chirp3-client';

interface TranscribeRequest {
  audio: string; // base64 encoded
  mimeType: string;
}

interface TranscribeResponse {
  success: boolean;
  text?: string;
  confidence?: number;
  error?: string;
  method?: 'chirp3' | 'gemini';
}

/**
 * Transcribe audio using Chirp 3
 * @param req
 * @param res
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TranscribeResponse>
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const { audio, mimeType } = req.body as TranscribeRequest;

    if (!audio) {
      res.status(400).json({ success: false, error: 'Missing audio data' });
      return;
    }

    // Check if Chirp 3 is available
    if (!isChirp3Available()) {
      res.status(503).json({
        success: false,
        error: 'Chirp 3 not configured. Set GOOGLE_CLOUD_PROJECT and CHIRP3_RECOGNIZER.',
      });
      return;
    }

    // Decode base64 audio
    const audioBuffer = Buffer.from(audio, 'base64');

    console.log('[API] Transcribing audio:', {
      size: audioBuffer.length,
      mimeType,
    });

    // Transcribe with Chirp 3
    const result = await transcribeAudio(audioBuffer);

    if (result.success) {
      res.status(200).json({
        success: true,
        text: result.text,
        confidence: result.confidence,
        method: 'chirp3',
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Transcription failed',
      });
    }
  } catch (error) {
    console.error('[API] Transcription error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Audio files can be large
    },
  },
};
