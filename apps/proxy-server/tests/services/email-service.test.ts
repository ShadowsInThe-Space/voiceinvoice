/**
 * Tests for Email Service.
 *
 * Verifies license email payloads and webhook delivery behavior.
 *
 * @module tests/services/email-service
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildLicenseEmail, sendEmail } from '../../src/services/email-service';
import { LICENSE_PLANS } from '../../src/services/stripe-service';

describe('Email Service', () => {
  const licenseKey = 'VI-ABCD-1234-EF56';
  const recipient = 'test@example.com';

  beforeEach(() => {
    process.env.EMAIL_WEBHOOK_URL = 'https://example.com/email-webhook';
    process.env.EMAIL_FROM = 'VoiceInvoice <no-reply@voiceinvoice.de>';
    process.env.SUPPORT_EMAIL = 'support@voiceinvoice.de';
    process.env.EMAIL_RETRY_ATTEMPTS = '3';
    process.env.EMAIL_RETRY_BASE_DELAY_MS = '0';
  });

  afterEach(() => {
    delete process.env.EMAIL_RETRY_ATTEMPTS;
    delete process.env.EMAIL_RETRY_BASE_DELAY_MS;
    vi.unstubAllGlobals();
  });

  it('should build a license email with plain text and html content', () => {
    const payload = buildLicenseEmail(recipient, licenseKey, LICENSE_PLANS.STARTER);

    expect(payload.to).toBe(recipient);
    expect(payload.subject).toContain(LICENSE_PLANS.STARTER.name);
    expect(payload.text).toContain(licenseKey);
    expect(payload.html).toContain(licenseKey);
    expect(payload.text).toContain('support@voiceinvoice.de');
    expect(payload.messageId).toBeDefined();
  });

  it('should send email via webhook with required payload fields', async () => {
    const payload = buildLicenseEmail(recipient, licenseKey, LICENSE_PLANS.STARTER);

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    await sendEmail(payload);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(process.env.EMAIL_WEBHOOK_URL);
    expect(options?.method).toBe('POST');
    expect(options?.headers).toEqual({ 'Content-Type': 'application/json' });

    const body = JSON.parse(options?.body as string);
    expect(body.to).toBe(recipient);
    expect(body.from).toBe(process.env.EMAIL_FROM);
    expect(body.subject).toContain(LICENSE_PLANS.STARTER.name);
    expect(body.text).toContain(licenseKey);
    expect(body.html).toContain(licenseKey);
    expect(body.templateVersion).toBe('license-v1');
    expect(body.messageId).toBeDefined();
  });

  it('should retry when webhook returns non-2xx', async () => {
    const payload = buildLicenseEmail(recipient, licenseKey, LICENSE_PLANS.STARTER);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 502 })
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    await sendEmail(payload);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('should throw when EMAIL_WEBHOOK_URL is missing', async () => {
    delete process.env.EMAIL_WEBHOOK_URL;

    await expect(
      sendEmail(buildLicenseEmail(recipient, licenseKey, LICENSE_PLANS.STARTER))
    ).rejects.toThrow('EMAIL_WEBHOOK_URL');
  });
});
