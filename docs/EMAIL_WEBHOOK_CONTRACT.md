# Email Webhook Contract

This document defines the expected webhook contract for transactional email delivery.

## Purpose

The proxy-server sends transactional emails (e.g. license delivery) via a webhook provider.
The provider must accept a JSON payload and return a 2xx response on successful enqueue.

## Endpoint

Configured via environment variable:

- `EMAIL_WEBHOOK_URL`

## Request

### Headers

- `Content-Type: application/json`

### Payload (JSON)

Required fields:

- `to` (string) - recipient email address
- `from` (string) - sender email address
- `subject` (string) - email subject
- `html` (string) - HTML body
- `text` (string) - plain text body

Optional fields:

- `templateVersion` (string) - template version tag
- `tags` (string[]) - analytics tags
- `messageId` (string) - idempotency key for retries

### Example

```json
{
  "to": "buyer@example.com",
  "from": "VoiceInvoice <no-reply@voiceinvoice.de>",
  "subject": "Ihre VoiceInvoice Lizenz (VoiceInvoice Starter)",
  "html": "<div>...</div>",
  "text": "Hallo...",
  "templateVersion": "license-v1",
  "tags": ["license", "starter"],
  "messageId": "9f1b2c3d-..."
}
```

## Response

Return a `2xx` response on successful acceptance. Any non-2xx response is treated as a
failure and retried (see Retry behavior below).

## Retry Behavior

The proxy-server retries delivery using exponential backoff when the webhook returns
non-2xx or on network errors. To avoid duplicate emails, the provider should implement
idempotency based on `messageId`.

Default values:

- `EMAIL_RETRY_ATTEMPTS=3`
- `EMAIL_RETRY_BASE_DELAY_MS=200`

## Security Notes

- The webhook endpoint should authenticate requests (e.g. IP allowlist or shared secret)
- Avoid logging full email contents in production
