/**
 * Email Service.
 *
 * Sends transactional emails via a configurable webhook provider.
 *
 * @module services/email-service
 */

import type { LicensePlan } from './stripe-service';

/**
 * Email payload shape for webhook delivery.
 */
export interface EmailPayload {
  /** Recipient email address */
  to: string;
  /** Sender email address */
  from: string;
  /** Email subject */
  subject: string;
  /** HTML email body */
  html: string;
  /** Plain-text email body */
  text: string;
  /** Optional template version for tracking */
  templateVersion?: string;
  /** Optional tags for analytics */
  tags?: string[];
}

/**
 * Get the configured email webhook URL.
 *
 * @returns Webhook URL for transactional email delivery
 * @throws {Error} When EMAIL_WEBHOOK_URL is missing
 */
function getEmailWebhookUrl(): string {
  const webhookUrl = process.env.EMAIL_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error('EMAIL_WEBHOOK_URL environment variable is required');
  }
  return webhookUrl;
}

/**
 * Get the configured email sender address.
 *
 * @returns Sender email
 */
function getEmailFrom(): string {
  return process.env.EMAIL_FROM || 'VoiceInvoice <no-reply@voiceinvoice.de>';
}

/**
 * Get the support email address.
 *
 * @returns Support email
 */
function getSupportEmail(): string {
  return process.env.SUPPORT_EMAIL || 'support@voiceinvoice.de';
}

/**
 * Build the license delivery email payload.
 *
 * @param to - Recipient email address
 * @param licenseKey - License key to deliver
 * @param plan - License plan details
 * @returns Email payload for webhook delivery
 */
export function buildLicenseEmail(to: string, licenseKey: string, plan: LicensePlan): EmailPayload {
  const supportEmail = getSupportEmail();
  const subject = `Ihre VoiceInvoice Lizenz (${plan.name})`;

  const text =
    `Hallo,\n\n` +
    `vielen Dank fuer Ihren Kauf. Hier ist Ihr Lizenzschluessel:\n\n` +
    `${licenseKey}\n\n` +
    `Plan: ${plan.name}\n` +
    `Monatliches Kontingent: ${plan.monthlyQuota} Vorgange\n\n` +
    `Bewahren Sie diesen Schluessel sicher auf.\n\n` +
    `Bei Fragen helfen wir gerne: ${supportEmail}\n\n` +
    `Viele Gruesse\n` +
    `Ihr VoiceInvoice Team`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
      <p>Hallo,</p>
      <p>vielen Dank fuer Ihren Kauf. Hier ist Ihr Lizenzschluessel:</p>
      <p style="font-size: 18px; font-weight: bold; letter-spacing: 1px;">${licenseKey}</p>
      <p>
        <strong>Plan:</strong> ${plan.name}<br />
        <strong>Monatliches Kontingent:</strong> ${plan.monthlyQuota} Vorgange
      </p>
      <p>Bewahren Sie diesen Schluessel sicher auf.</p>
      <p>Bei Fragen helfen wir gerne: <a href="mailto:${supportEmail}">${supportEmail}</a></p>
      <p>Viele Gruesse<br />Ihr VoiceInvoice Team</p>
    </div>
  `;

  return {
    to,
    from: getEmailFrom(),
    subject,
    html: html.trim(),
    text,
    templateVersion: 'license-v1',
    tags: ['license', plan.id.toLowerCase()],
  };
}

/**
 * Send an email via webhook.
 *
 * @param payload - Email payload
 * @returns Promise that resolves when email is accepted by the webhook
 * @throws {Error} When webhook returns a non-2xx response
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  const webhookUrl = getEmailWebhookUrl();

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Email webhook failed with status ${response.status}`);
  }
}

/**
 * Send a license email to the customer.
 *
 * @param to - Recipient email address
 * @param licenseKey - License key to deliver
 * @param plan - License plan details
 * @returns Promise that resolves when email is accepted by the webhook
 */
export async function sendLicenseEmail(
  to: string,
  licenseKey: string,
  plan: LicensePlan
): Promise<void> {
  const payload = buildLicenseEmail(to, licenseKey, plan);
  await sendEmail(payload);
}
