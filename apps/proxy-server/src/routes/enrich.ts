/**
 * Enrich Route
 *
 * Handles invoice data extraction from transcripts using Gemini AI.
 *
 * @module routes/enrich
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { extractInvoiceData, type ExtractedInvoice } from '../services/gemini-service';

/**
 * Request body schema for enrichment.
 */
const EnrichRequestSchema = z.object({
  /** Transcript text to extract invoice data from */
  transcript: z.string().min(1, 'Transcript is required'),
});

type EnrichRequest = z.infer<typeof EnrichRequestSchema>;

/**
 * Response body for enrichment.
 */
interface EnrichResponse {
  /** Extracted invoice data */
  invoice: ExtractedInvoice;
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
 * Register enrich routes.
 *
 * @param server - Fastify instance
 */
export async function registerEnrichRoutes(server: FastifyInstance): Promise<void> {
  server.post<{
    Body: EnrichRequest;
  }>('/enrich', async (request: FastifyRequest<{ Body: EnrichRequest }>, reply: FastifyReply) => {
    // Validate request body
    const validation = EnrichRequestSchema.safeParse(request.body);

    if (!validation.success) {
      const errorResponse: ErrorResponse = {
        error: 'Invalid request body',
        statusCode: 400,
        details: validation.error.issues,
      };
      return reply.status(400).send(errorResponse);
    }

    const { transcript } = validation.data;

    try {
      // Extract invoice data from transcript
      const result = await extractInvoiceData(transcript);

      const response: EnrichResponse = {
        invoice: result.invoice,
        confidence: result.confidence,
      };

      return reply.status(200).send(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      server.log.error({ err: error }, 'Invoice extraction failed');

      // In production, don't leak internal error details
      const isProduction = process.env.NODE_ENV === 'production';
      const errorResponse: ErrorResponse = {
        error: isProduction
          ? 'Internal server error'
          : `Invoice extraction failed: ${errorMessage}`,
        statusCode: 500,
      };

      return reply.status(500).send(errorResponse);
    }
  });
}
