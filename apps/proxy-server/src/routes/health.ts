/**
 * Health Check Route
 *
 * Provides health status endpoint for monitoring and load balancing.
 *
 * @module routes/health
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { checkAvailability as checkSpeechAvailability } from '../services/speech-service';
import { checkAvailability as checkGeminiAvailability } from '../services/gemini-service';
import { PROXY_SERVER_VERSION } from '../index';

/**
 * Health check response structure.
 */
interface HealthResponse {
  /** Overall health status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** ISO timestamp */
  timestamp: string;
  /** Server version */
  version: string;
  /** Individual service statuses */
  services: {
    speechToText: boolean;
    gemini: boolean;
  };
}

/**
 * Register health check routes.
 *
 * @param server - Fastify instance
 */
export async function registerHealthRoutes(server: FastifyInstance): Promise<void> {
  server.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    const speechAvailable = await checkSpeechAvailability();
    const geminiAvailable = await checkGeminiAvailability();

    // Determine overall status
    let status: HealthResponse['status'] = 'healthy';
    if (!speechAvailable && !geminiAvailable) {
      status = 'unhealthy';
    } else if (!speechAvailable || !geminiAvailable) {
      status = 'degraded';
    }

    const response: HealthResponse = {
      status,
      timestamp: new Date().toISOString(),
      version: PROXY_SERVER_VERSION,
      services: {
        speechToText: speechAvailable,
        gemini: geminiAvailable,
      },
    };

    // Return 503 if unhealthy for load balancer health checks
    const statusCode = status === 'unhealthy' ? 503 : 200;

    return reply.status(statusCode).send(response);
  });
}
