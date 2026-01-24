/**
 * Webhook module for n8n integration.
 *
 * @module lib/webhook
 */

export {
  isValidWebhookUrl,
  getWebhookConfig,
  saveWebhookConfig,
  sendWebhookNotification,
  WEBHOOK_STORAGE_KEYS,
  type WebhookConfig,
  type WebhookPayload,
} from './webhook-client';
