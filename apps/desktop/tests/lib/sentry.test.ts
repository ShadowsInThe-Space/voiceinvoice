import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as Sentry from '@sentry/nextjs';

// Mock @sentry/nextjs
vi.mock('@sentry/nextjs', () => ({
  init: vi.fn(),
}));

describe('Sentry Integration (desktop)', () => {
  const originalEnv = process.env;
  const originalWindow = global.window;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    // Mock window object for browser environment
    global.window = {} as Window & typeof globalThis;
  });

  afterEach(() => {
    process.env = originalEnv;
    global.window = originalWindow;
  });

  describe('initSentry', () => {
    it('should initialize Sentry in production with DSN in browser', async () => {
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/456';

      const { initSentry } = await import('../../src/lib/sentry');
      initSentry();

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://test@sentry.io/456',
          environment: 'production',
          tracesSampleRate: 0,
        })
      );
    });

    it('should not initialize Sentry in development', async () => {
      process.env.NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/456';

      const { initSentry } = await import('../../src/lib/sentry');
      initSentry();

      expect(Sentry.init).not.toHaveBeenCalled();
    });

    it('should not initialize Sentry without DSN', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;

      const { initSentry } = await import('../../src/lib/sentry');
      initSentry();

      expect(Sentry.init).not.toHaveBeenCalled();
    });

    it('should not initialize Sentry on server-side (no window)', async () => {
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/456';
      // @ts-expect-error - Testing server-side behavior
      delete global.window;

      const { initSentry } = await import('../../src/lib/sentry');
      initSentry();

      expect(Sentry.init).not.toHaveBeenCalled();
    });

    it('should filter HMR errors in beforeSend', async () => {
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/456';

      const { initSentry } = await import('../../src/lib/sentry');
      initSentry();

      const initCall = vi.mocked(Sentry.init).mock.calls[0][0];
      const beforeSend = initCall?.beforeSend;

      expect(beforeSend).toBeDefined();

      // Test HMR error filtering
      const hmrEvent = {
        exception: {
          values: [{ value: 'Error in HMR update' }],
        },
      };

      const filteredHmr = beforeSend!(hmrEvent, {});
      expect(filteredHmr).toBeNull();

      // Test normal error passes through
      const normalEvent = {
        exception: {
          values: [{ value: 'Normal error' }],
        },
      };

      const filteredNormal = beforeSend!(normalEvent, {});
      expect(filteredNormal).toEqual(normalEvent);
    });
  });
});
