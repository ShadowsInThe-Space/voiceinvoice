/**
 * IPC handlers for environment configuration.
 *
 * Provides secure access to sensitive environment variables
 * without exposing them in the client bundle.
 *
 * @module electron/ipc/env-handlers
 */

/**
 * Gets the Google API key from environment variables.
 *
 * @returns {Promise<string|null>} The API key or null if not set
 */
export async function getGoogleApiKey(): Promise<string | null> {
  return process.env.GOOGLE_API_KEY || null;
}

/**
 * Gets the n8n chat webhook URL from environment variables.
 *
 * @returns {Promise<string|null>} The webhook URL or null if not set
 */
export async function getN8nChatWebhook(): Promise<string | null> {
  return process.env.N8N_CHAT_WEBHOOK || null;
}

/**
 * Gets the n8n ingestion webhook URL from environment variables.
 *
 * @returns {Promise<string|null>} The webhook URL or null if not set
 */
export async function getN8nIngestWebhook(): Promise<string | null> {
  return process.env.N8N_INGEST_WEBHOOK || null;
}
