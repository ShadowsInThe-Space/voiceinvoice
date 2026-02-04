/**
 * Transcribe Route
 *
 * Handles audio transcription requests using Google Cloud STT (Chirp 3).
 *
 * @module routes/transcribe
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { transcribeAudio } from '../services/speech-service';

/**
 * Request body schema for transcription.
 */
const TranscribeRequestSchema = z.object({
  /** Base64-encoded audio data */
  audio: z.string().min(1, 'Audio data is required'),
  /** BCP-47 language code (default: de-DE) */
  language: z.string().default('de-DE'),
  /** Audio format (default: webm) */
  format: z.string().default('webm'),
});

type TranscribeRequest = z.infer<typeof TranscribeRequestSchema>;

/**
 * Response body for transcription.
 */
interface TranscribeResponse {
  /** Transcribed text */
  transcript: string;
  /** Confidence score (0.0 - 1.0) */
  confidence: number;
}

/**
 * Error response structure.
 */
interface ErrorResponse {
  error: string;
  statusCode: number;
  details?: unknown;
}

/**
 * Register transcribe routes.
 *
 * @param server - Fastify instance
 */
export async function registerTranscribeRoutes(server: FastifyInstance): Promise<void> {
  server.post<{
    Body: TranscribeRequest;
  }>(
    '/transcribe',
    async (request: FastifyRequest<{ Body: TranscribeRequest }>, reply: FastifyReply) => {
      // Validate request body
      const validation = TranscribeRequestSchema.safeParse(request.body);

      if (!validation.success) {
        const errorResponse: ErrorResponse = {
          error: 'Invalid request body',
          statusCode: 400,
          details: validation.error.issues,
        };
        return reply.status(400).send(errorResponse);
      }

      const { audio, language, format } = validation.data;

      try {
        // Decode base64 audio
        const audioBuffer = Buffer.from(audio, 'base64');

        // Transcribe the audio
        const result = await transcribeAudio(audioBuffer, { language, format });

        const response: TranscribeResponse = {
          transcript: result.transcript,
          confidence: result.confidence,
        };

        return reply.status(200).send(response);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        server.log.error({ err: error }, 'Transcription failed');

        // In production, don't leak internal error details
        const isProduction = process.env.NODE_ENV === 'production';
        const errorResponse: ErrorResponse = {
          error: isProduction ? 'Internal server error' : `Transcription failed: ${errorMessage}`,
          statusCode: 500,
        };

        return reply.status(500).send(errorResponse);
      }
    }
  );
}
