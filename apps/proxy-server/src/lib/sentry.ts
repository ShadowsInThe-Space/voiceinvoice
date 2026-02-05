/**
 * @file Sentry Error Tracking Integration für Proxy-Server
 * @module lib/sentry
 */

import * as Sentry from '@sentry/node';

/**
 * Kontext für Webhook-Fehler
 */
export interface WebhookErrorContext {
  /** Stripe Event Type (z.B. "customer.subscription.updated") */
  eventType: string;
  /** Stripe Event ID */
  eventId: string;
  /** Betroffener Lizenzschlüssel (optional) */
  licenseKey?: string;
}

/**
 * Initialisiert Sentry für Error Logging im Produktionsmodus.
 *
 * @description
 * - Nur aktiv wenn `NODE_ENV === 'production'` und `SENTRY_DSN` gesetzt ist
 * - Filtert sensible Header (authorization, stripe-signature) aus Events
 * - Performance Tracing ist deaktiviert (tracesSampleRate: 0)
 *
 * @example
 * ```typescript
 * // In server.ts beim Start
 * import { initSentry } from './lib/sentry';
 * initSentry();
 * ```
 */
export function initSentry(): void {
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0, // No performance monitoring for now
      beforeSend(event) {
        // Filter out PII and sensitive data
        if (event.request?.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['stripe-signature'];
        }
        return event;
      },
    });
  } else if (!process.env.SENTRY_DSN) {
    console.warn('[Sentry] No DSN configured, errors will only be logged to console');
  }
}

/**
 * Erfasst einen Webhook-Fehler mit Kontext-Informationen.
 *
 * @param error - Der aufgetretene Fehler
 * @param context - Kontext des Webhook-Events (eventType, eventId, licenseKey)
 *
 * @description
 * Im Development-Modus wird der Fehler nur zur Console geloggt.
 * Im Production-Modus wird er an Sentry gesendet mit Tags und Extra-Daten.
 *
 * @example
 * ```typescript
 * try {
 *   await processWebhook(event);
 * } catch (error) {
 *   captureWebhookError(error as Error, {
 *     eventType: event.type,
 *     eventId: event.id,
 *     licenseKey: license?.key
 *   });
 * }
 * ```
 */
export function captureWebhookError(error: Error, context: WebhookErrorContext): void {
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(error, {
      tags: {
        app: 'proxy-server',
        component: 'stripe-webhook',
        eventType: context.eventType,
      },
      extra: {
        stripeEventId: context.eventId,
        licenseKey: context.licenseKey,
      },
    });
  } else {
    console.error('[Sentry Mock] Webhook Error:', error, context);
  }
}

/**
 * Fügt einen Breadcrumb für Webhook-Processing hinzu.
 *
 * @param message - Breadcrumb-Nachricht
 * @param data - Zusätzliche Daten (optional)
 *
 * @description
 * Breadcrumbs helfen bei der Nachverfolgung der Schritte vor einem Fehler.
 * Im Development-Modus wird zur Console geloggt.
 *
 * @example
 * ```typescript
 * addBreadcrumb('Webhook received', { eventType: event.type });
 * addBreadcrumb('License validated', { licenseKey: license.key });
 * addBreadcrumb('Subscription updated', { status: subscription.status });
 * ```
 */
export function addBreadcrumb(message: string, data?: Record<string, any>): void {
  if (process.env.NODE_ENV === 'production') {
    Sentry.addBreadcrumb({ message, data, level: 'info' });
  } else {
    console.log('[Sentry Mock] Breadcrumb:', message, data);
  }
}
