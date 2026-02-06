/**
 * @file Sentry Error Tracking Integration für Desktop App (Next.js)
 * @module lib/sentry
 */

import * as Sentry from '@sentry/nextjs';

/**
 * Initialisiert Sentry für Error Logging im Browser (Production-Modus).
 *
 * @description
 * - Nur im Browser aktiv (`typeof window !== 'undefined'`)
 * - Nur im Production-Modus (`NODE_ENV === 'production'`)
 * - Filtert HMR/Hot-Reload Fehler aus (Next.js Development)
 * - Performance Tracing ist deaktiviert (tracesSampleRate: 0)
 * - DSN aus `NEXT_PUBLIC_SENTRY_DSN` Environment Variable
 *
 * @example
 * ```typescript
 * // In _app.tsx beim App-Start
 * import { initSentry } from '@/lib/sentry';
 *
 * useEffect(() => {
 *   initSentry();
 * }, []);
 * ```
 */
export function initSentry(): void {
  if (
    typeof window !== 'undefined' &&
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PUBLIC_SENTRY_DSN
  ) {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0,
      beforeSend(event) {
        // Filter Next.js hot reload errors
        if (event.exception?.values?.[0]?.value?.includes('HMR')) {
          return null;
        }
        return event;
      },
    });
  }
}
