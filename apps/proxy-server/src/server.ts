/**
 * Fastify Server Setup
 *
 * Configures and builds the Fastify server with all routes,
 * middleware, and plugins.
 *
 * @module server
 */

import Fastify, { FastifyInstance, FastifyError } from 'fastify';
import type { FastifyLoggerOptions } from 'fastify';
import type { PinoLoggerOptions } from 'fastify/types/logger';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { registerHealthRoutes } from './routes/health';
import { registerTranscribeRoutes } from './routes/transcribe';
import { registerEnrichRoutes } from './routes/enrich';
import { registerLicenseRoutes } from './routes/license';

/**
 * Server build options.
 */
export interface BuildOptions {
  /** Enable request logging (default: true) */
  logger?: boolean;
  /** Rate limit requests per minute (default: 60) */
  rateLimit?: number;
}

/**
 * Build and configure the Fastify server.
 *
 * @param options - Server configuration options
 * @returns Configured Fastify instance (not yet listening)
 *
 * @example
 * ```typescript
 * const server = await buildServer({ logger: true });
 * await server.listen({ port: 3001 });
 * ```
 */
export async function buildServer(options: BuildOptions = {}): Promise<FastifyInstance> {
  const { logger = true, rateLimit: rateLimitMax = 60 } = options;

  // Build logger options
  let loggerOptions: boolean | (FastifyLoggerOptions & PinoLoggerOptions) = false;

  if (logger) {
    if (process.env.NODE_ENV === 'development') {
      loggerOptions = {
        level: 'info',
        transport: {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        },
      };
    } else {
      loggerOptions = {
        level: 'info',
      };
    }
  }

  // Create Fastify instance with body size limit for audio uploads
  const server = Fastify({
    logger: loggerOptions,
    bodyLimit: 10 * 1024 * 1024, // 10MB for audio files
  });

  // Register security middleware
  await server.register(helmet, {
    // Allow cross-origin requests from Electron app
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  // Register CORS for Electron app requests
  // In production, restrict to known origins; in dev, allow all
  const corsOrigin =
    process.env.CORS_ORIGIN || process.env.NODE_ENV === 'production'
      ? (process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000', 'http://localhost:3002'])
      : true;

  await server.register(cors, {
    origin: corsOrigin,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Register rate limiting
  await server.register(rateLimit, {
    max: rateLimitMax,
    timeWindow: '1 minute',
    errorResponseBuilder: (_request, context) => ({
      error: 'Rate limit exceeded',
      statusCode: 429,
      retryAfter: context.after,
    }),
  });

  // Register routes
  await registerHealthRoutes(server);
  await registerTranscribeRoutes(server);
  await registerEnrichRoutes(server);
  await registerLicenseRoutes(server);

  // Global error handler
  server.setErrorHandler((error: FastifyError, _request, reply) => {
    server.log.error({ err: error }, 'Unhandled error');

    // Don't expose internal errors in production
    const statusCode = error.statusCode ?? 500;
    const message =
      process.env.NODE_ENV === 'production' && statusCode >= 500
        ? 'Internal server error'
        : error.message;

    return reply.status(statusCode).send({
      error: message,
      statusCode,
    });
  });

  // 404 handler
  server.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({
      error: 'Route not found',
      statusCode: 404,
    });
  });

  return server;
}
