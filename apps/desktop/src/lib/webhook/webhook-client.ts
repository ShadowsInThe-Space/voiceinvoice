/**
 * Webhook Client for n8n Integration
 *
 * Sends invoice status change notifications to configured n8n webhooks.
 * Includes retry logic with exponential backoff and timeout handling.
 *
 * @module lib/webhook/webhook-client
 */

/**
 * LocalStorage keys for webhook configuration.
 */
export const WEBHOOK_STORAGE_KEYS = {
  enabled: 'voiceinvoice_webhook_enabled',
  url: 'voiceinvoice_webhook_url',
  backupUrl: 'voiceinvoice_webhook_backup_url',
} as const;

/**
 * Webhook configuration interface.
 */
export interface WebhookConfig {
  /** Whether webhook notifications are enabled */
  enabled: boolean;
  /** Primary n8n webhook URL */
  url: string;
  /** Backup webhook URL (optional) */
  backupUrl: string;
}

/**
 * Payload sent to the webhook on invoice status changes.
 */
export interface WebhookPayload {
  /** Invoice unique identifier */
  invoiceId: string;
  /** Human-readable invoice number */
  invoiceNumber: string;
  /** New invoice status */
  status: string;
  /** Previous invoice status */
  previousStatus?: string;
  /** Invoice gross amount */
  amount: number;
  /** Currency code (default: EUR) */
  currency: string;
  /** Customer or company name */
  customerName: string;
  /** ISO timestamp of when the status changed */
  changedAt: string;
}

/**
 * Retry configuration constants.
 */
const RETRY_CONFIG = {
  /** Maximum number of retries (3 retries = 4 total attempts) */
  maxRetries: 3,
  /** Base delay in milliseconds (doubles each retry: 1s, 2s, 4s) */
  baseDelayMs: 1000,
  /** Request timeout in milliseconds */
  timeoutMs: 10000,
} as const;

/**
 * Validates a webhook URL.
 *
 * Accepts HTTP and HTTPS URLs only.
 *
 * @param url - The URL to validate
 * @returns True if the URL is valid, false otherwise
 */
export function isValidWebhookUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Retrieves the webhook configuration from localStorage.
 *
 * @returns The current webhook configuration
 */
export function getWebhookConfig(): WebhookConfig {
  const enabled = localStorage.getItem(WEBHOOK_STORAGE_KEYS.enabled) === 'true';
  const url = localStorage.getItem(WEBHOOK_STORAGE_KEYS.url) ?? '';
  const backupUrl = localStorage.getItem(WEBHOOK_STORAGE_KEYS.backupUrl) ?? '';

  return {
    enabled,
    url,
    backupUrl,
  };
}

/**
 * Saves the webhook configuration to localStorage.
 *
 * @param config - The configuration to save
 */
export function saveWebhookConfig(config: WebhookConfig): void {
  localStorage.setItem(WEBHOOK_STORAGE_KEYS.enabled, String(config.enabled));
  localStorage.setItem(WEBHOOK_STORAGE_KEYS.url, config.url);
  localStorage.setItem(WEBHOOK_STORAGE_KEYS.backupUrl, config.backupUrl);
}

/**
 * Delays execution for a specified number of milliseconds.
 *
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sends a webhook request with retry logic.
 *
 * @param url - The webhook URL to send to
 * @param payload - The data to send
 * @returns True if successful, false otherwise
 */
async function sendWithRetry(url: string, payload: WebhookPayload): Promise<boolean> {
  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), RETRY_CONFIG.timeoutMs);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return true;
      }

      // HTTP error - will retry
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      // If this was the last attempt, don't delay
      if (attempt === RETRY_CONFIG.maxRetries) {
        break;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delayMs = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
      await delay(delayMs);
    }
  }

  return false;
}

/**
 * Sends a webhook notification for an invoice status change.
 *
 * This function:
 * - Checks if webhooks are enabled
 * - Sends to the primary webhook URL with retry logic
 * - Falls back to the backup URL if configured and primary fails
 * - Silently logs errors without throwing
 *
 * @param payload - The webhook payload containing invoice data
 */
export async function sendWebhookNotification(payload: WebhookPayload): Promise<void> {
  const config = getWebhookConfig();

  // Skip if webhooks are disabled
  if (!config.enabled) {
    return;
  }

  // Skip if no URL is configured
  if (!config.url || !isValidWebhookUrl(config.url)) {
    return;
  }

  try {
    // Try primary URL
    const primarySuccess = await sendWithRetry(config.url, payload);

    if (primarySuccess) {
      return;
    }

    // Try backup URL if configured
    if (config.backupUrl && isValidWebhookUrl(config.backupUrl)) {
      const backupSuccess = await sendWithRetry(config.backupUrl, payload);

      if (backupSuccess) {
        return;
      }
    }

    // All attempts failed
    console.error('[Webhook] Failed to send notification after all retries');
  } catch (error) {
    // Silently log errors
    console.error('[Webhook] Unexpected error:', error);
  }
}
