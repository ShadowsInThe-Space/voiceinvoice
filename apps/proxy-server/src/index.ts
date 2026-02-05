/**
 * VoiceInvoice Proxy Server entry point.
 *
 * Fastify-based API server providing:
 * - /transcribe: Audio transcription via Chirp 3 / Gemini
 * - /enrich: Invoice data extraction via Gemini 2.5 Flash
 * - /health: Health check endpoint
 *
 * Deployed on Hetzner Cloud in Frankfurt for GDPR compliance.
 *
 * @module proxy-server
 */

// Load environment variables from .env file
import 'dotenv/config';

// Initialize Sentry Error Tracking (must be first)
import { initSentry } from './lib/sentry';
initSentry();

import { buildServer } from './server';

/**
 * Server configuration options.
 *
 * Loaded from environment variables with sensible defaults.
 */
export interface ServerConfig {
  /** Server port (default: 3001) */
  port: number;

  /** Server host (default: '0.0.0.0') */
  host: string;

  /** Whether to enable request logging */
  enableLogging: boolean;

  /** Rate limit requests per minute */
  rateLimit: number;
}

/**
 * Creates the server configuration from environment.
 *
 * @returns {ServerConfig} Server configuration
 */
export function createConfig(): ServerConfig {
  return {
    port: parseInt(process.env.PORT ?? '3001', 10),
    host: process.env.HOST ?? '0.0.0.0',
    enableLogging: process.env.ENABLE_LOGGING !== 'false',
    rateLimit: parseInt(process.env.RATE_LIMIT ?? '60', 10),
  };
}

/**
 * Starts the proxy server.
 *
 * @param {Partial<ServerConfig>} config - Configuration overrides
 * @returns {Promise<void>} Resolves when server is running
 */
export async function startServer(config?: Partial<ServerConfig>): Promise<void> {
  const finalConfig = { ...createConfig(), ...config };

  const server = await buildServer({
    logger: finalConfig.enableLogging,
    rateLimit: finalConfig.rateLimit,
  });

  try {
    await server.listen({
      port: finalConfig.port,
      host: finalConfig.host,
    });

    console.log(`VoiceInvoice Proxy Server running on ${finalConfig.host}:${finalConfig.port}`);
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down server...');
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Auto-start if run directly
const isMainModule = process.argv[1]?.includes('proxy-server');
if (isMainModule && !process.env.VITEST) {
  startServer().catch(console.error);
}

/**
 * Proxy Server version for compatibility checking.
 */
export const PROXY_SERVER_VERSION = '0.1.0';
