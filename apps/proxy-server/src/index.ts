/**
 * VoiceInvoice Proxy Server entry point.
 *
 * Fastify-based API server providing:
 * - /transcribe: Audio transcription via Chirp 3
 * - /enrich: Invoice data extraction via Gemini 2.5 Flash
 * - License validation and rate limiting
 *
 * Deployed on Hetzner Cloud in Frankfurt for GDPR compliance.
 *
 * @module proxy-server
 */

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
 * This is a placeholder that will be replaced with the full
 * Fastify server setup in Subagent #7.
 *
 * @param {Partial<ServerConfig>} config - Configuration overrides
 * @returns {Promise<void>} Resolves when server is running
 */
export async function startServer(config?: Partial<ServerConfig>): Promise<void> {
  const finalConfig = { ...createConfig(), ...config };
  console.log(`VoiceInvoice Proxy Server starting on ${finalConfig.host}:${finalConfig.port}`);
  // Placeholder - will be implemented in Subagent #7
}

// Auto-start if run directly
if (process.argv[1]?.includes('proxy-server')) {
  startServer().catch(console.error);
}

/**
 * Proxy Server version for compatibility checking.
 */
export const PROXY_SERVER_VERSION = '0.1.0';
