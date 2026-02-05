import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as Sentry from '@sentry/node';

// Mock @sentry/node before importing our module
vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

describe('Sentry Integration (proxy-server)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('initSentry', () => {
    it('should initialize Sentry in production with DSN', async () => {
      process.env.NODE_ENV = 'production';
      process.env.SENTRY_DSN = 'https://test@sentry.io/123';

      const { initSentry } = await import('../../src/lib/sentry');
      initSentry();

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://test@sentry.io/123',
          environment: 'production',
          tracesSampleRate: 0,
        })
      );
    });

    it('should not initialize Sentry in development', async () => {
      process.env.NODE_ENV = 'development';
      process.env.SENTRY_DSN = 'https://test@sentry.io/123';

      const { initSentry } = await import('../../src/lib/sentry');
      initSentry();

      expect(Sentry.init).not.toHaveBeenCalled();
    });

    it('should not initialize Sentry without DSN', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.SENTRY_DSN;

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { initSentry } = await import('../../src/lib/sentry');
      initSentry();

      expect(Sentry.init).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('No DSN configured'));

      consoleWarnSpy.mockRestore();
    });

    it('should filter PII from headers in beforeSend', async () => {
      process.env.NODE_ENV = 'production';
      process.env.SENTRY_DSN = 'https://test@sentry.io/123';

      const { initSentry } = await import('../../src/lib/sentry');
      initSentry();

      const initCall = vi.mocked(Sentry.init).mock.calls[0][0];
      const beforeSend = initCall?.beforeSend;

      expect(beforeSend).toBeDefined();

      const event = {
        request: {
          headers: {
            authorization: 'Bearer secret',
            'stripe-signature': 'sig_secret',
            'content-type': 'application/json',
          },
        },
      };

      const filtered = beforeSend!(event, {});

      expect(filtered?.request?.headers).toEqual({
        'content-type': 'application/json',
      });
      expect(filtered?.request?.headers).not.toHaveProperty('authorization');
      expect(filtered?.request?.headers).not.toHaveProperty('stripe-signature');
    });
  });

  describe('captureWebhookError', () => {
    it('should capture webhook error with context in production', async () => {
      process.env.NODE_ENV = 'production';

      const { captureWebhookError } = await import('../../src/lib/sentry');
      const error = new Error('Webhook processing failed');
      const context = {
        eventType: 'customer.subscription.updated',
        eventId: 'evt_123',
        licenseKey: 'lic_456',
      };

      captureWebhookError(error, context);

      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          tags: {
            app: 'proxy-server',
            component: 'stripe-webhook',
            eventType: 'customer.subscription.updated',
          },
          extra: {
            stripeEventId: 'evt_123',
            licenseKey: 'lic_456',
          },
        })
      );
    });

    it('should log to console in development instead of sending to Sentry', async () => {
      process.env.NODE_ENV = 'development';

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { captureWebhookError } = await import('../../src/lib/sentry');
      const error = new Error('Test error');
      const context = {
        eventType: 'test.event',
        eventId: 'evt_test',
      };

      captureWebhookError(error, context);

      expect(Sentry.captureException).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith('[Sentry Mock] Webhook Error:', error, context);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('addBreadcrumb', () => {
    it('should add breadcrumb in production', async () => {
      process.env.NODE_ENV = 'production';

      const { addBreadcrumb } = await import('../../src/lib/sentry');
      addBreadcrumb('Processing webhook', { eventType: 'test.event' });

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message: 'Processing webhook',
        data: { eventType: 'test.event' },
        level: 'info',
      });
    });

    it('should log to console in development instead of Sentry', async () => {
      process.env.NODE_ENV = 'development';

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { addBreadcrumb } = await import('../../src/lib/sentry');
      addBreadcrumb('Test breadcrumb', { key: 'value' });

      expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('[Sentry Mock] Breadcrumb:', 'Test breadcrumb', {
        key: 'value',
      });

      consoleLogSpy.mockRestore();
    });
  });
});
