/**
 * Stripe Service
 *
 * Handles Stripe payments for VoiceInvoice Enterprise licenses.
 * Implements idempotency and secure webhook handling.
 *
 * @module services/stripe-service
 */

import Stripe from 'stripe';
import { randomUUID } from 'crypto';

/**
 * License plan configuration.
 */
export interface LicensePlan {
  /** Plan identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description for checkout */
  description: string;
  /** Price in cents (EUR) */
  priceInCents: number;
  /** Monthly API quota */
  monthlyQuota: number;
  /** License validity in days */
  validityDays: number;
  /** Stripe Price ID (set after product creation) */
  stripePriceId?: string;
}

/**
 * Available license plans.
 */
export const LICENSE_PLANS: Record<string, LicensePlan> = {
  STARTER: {
    id: 'STARTER',
    name: 'VoiceInvoice Starter',
    description: 'Ideal für Einzelunternehmer und kleine Büros',
    priceInCents: 2900, // €29/month
    monthlyQuota: 100,
    validityDays: 365,
  },
  PROFESSIONAL: {
    id: 'PROFESSIONAL',
    name: 'VoiceInvoice Professional',
    description: 'Für wachsende Unternehmen mit höherem Volumen',
    priceInCents: 7900, // €79/month
    monthlyQuota: 500,
    validityDays: 365,
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    name: 'VoiceInvoice Enterprise',
    description: 'Unbegrenzte Nutzung für große Organisationen',
    priceInCents: 19900, // €199/month
    monthlyQuota: 10000,
    validityDays: 365,
  },
};

/**
 * Stripe error messages.
 */
export const STRIPE_ERRORS = {
  MISSING_SECRET_KEY: 'STRIPE_SECRET_KEY environment variable is required',
  MISSING_WEBHOOK_SECRET: 'STRIPE_WEBHOOK_SECRET environment variable is required',
  INVALID_PLAN: 'Invalid license plan',
  INVALID_SIGNATURE: 'Invalid webhook signature',
  SESSION_NOT_FOUND: 'Checkout session not found',
  PAYMENT_INCOMPLETE: 'Payment not completed',
} as const;

/**
 * Checkout session metadata.
 */
export interface CheckoutMetadata {
  /** License plan ID */
  planId: string;
  /** Company name for the license */
  companyName: string;
  /** Customer email */
  email: string;
  /** Idempotency key for this checkout */
  idempotencyKey: string;
}

/**
 * Result of creating a checkout session.
 */
export interface CheckoutSessionResult {
  /** Stripe session ID */
  sessionId: string;
  /** Checkout URL to redirect user */
  url: string;
}

/**
 * Processed payment data from webhook.
 */
export interface ProcessedPayment {
  /** Stripe session ID */
  sessionId: string;
  /** Customer email */
  email: string;
  /** Company name */
  companyName: string;
  /** Plan ID purchased */
  planId: string;
  /** Amount paid in cents */
  amountPaid: number;
  /** Currency */
  currency: string;
  /** Payment intent ID */
  paymentIntentId: string;
  /** Idempotency key */
  idempotencyKey: string;
}

/**
 * Get Stripe client instance.
 *
 * @returns Configured Stripe client
 * @throws Error if STRIPE_SECRET_KEY is not set
 */
function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(STRIPE_ERRORS.MISSING_SECRET_KEY);
  }

  return new Stripe(secretKey, {
    apiVersion: '2024-12-18.acacia',
    typescript: true,
  });
}

/**
 * Get the webhook signing secret.
 *
 * @returns Webhook secret
 * @throws Error if STRIPE_WEBHOOK_SECRET is not set
 */
function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(STRIPE_ERRORS.MISSING_WEBHOOK_SECRET);
  }
  return secret;
}

/**
 * Generate an idempotency key for Stripe operations.
 *
 * @param prefix - Optional prefix for the key
 * @returns Unique idempotency key
 */
export function generateIdempotencyKey(prefix = 'ik'): string {
  return `${prefix}_${Date.now()}_${randomUUID()}`;
}

/**
 * Create a Stripe checkout session for license purchase.
 *
 * @param planId - License plan to purchase
 * @param companyName - Company name for the license
 * @param email - Customer email
 * @param successUrl - URL to redirect on success
 * @param cancelUrl - URL to redirect on cancel
 * @returns Checkout session details
 *
 * @example
 * ```typescript
 * const session = await createCheckoutSession(
 *   'PROFESSIONAL',
 *   'Acme GmbH',
 *   'info@acme.de',
 *   'https://app.voiceinvoice.de/success',
 *   'https://app.voiceinvoice.de/cancel'
 * );
 * // Redirect user to session.url
 * ```
 */
export async function createCheckoutSession(
  planId: string,
  companyName: string,
  email: string,
  successUrl: string,
  cancelUrl: string
): Promise<CheckoutSessionResult> {
  const plan = LICENSE_PLANS[planId];
  if (!plan) {
    throw new Error(STRIPE_ERRORS.INVALID_PLAN);
  }

  const stripe = getStripeClient();
  const idempotencyKey = generateIdempotencyKey('checkout');

  // Create checkout session with idempotency key
  const session = await stripe.checkout.sessions.create(
    {
      payment_method_types: ['card', 'sepa_debit'],
      mode: 'payment',
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            unit_amount: plan.priceInCents,
            product_data: {
              name: plan.name,
              description: plan.description,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        planId: plan.id,
        companyName,
        email,
        idempotencyKey,
        monthlyQuota: plan.monthlyQuota.toString(),
        validityDays: plan.validityDays.toString(),
      } satisfies CheckoutMetadata & { monthlyQuota: string; validityDays: string },
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      locale: 'de',
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
    },
    {
      idempotencyKey,
    }
  );

  if (!session.url) {
    throw new Error('Failed to create checkout URL');
  }

  return {
    sessionId: session.id,
    url: session.url,
  };
}

/**
 * Verify and construct a Stripe webhook event.
 *
 * CRITICAL: Always verify webhook signatures to prevent spoofing.
 *
 * @param rawBody - Raw request body (must be unparsed)
 * @param signature - Stripe-Signature header value
 * @returns Verified Stripe event
 * @throws Error if signature is invalid
 *
 * @example
 * ```typescript
 * // In Fastify route handler - use raw body
 * const event = verifyWebhookSignature(
 *   request.rawBody,
 *   request.headers['stripe-signature']
 * );
 * ```
 */
export function verifyWebhookSignature(rawBody: Buffer | string, signature: string): Stripe.Event {
  const stripe = getStripeClient();
  const webhookSecret = getWebhookSecret();

  try {
    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    throw new Error(`${STRIPE_ERRORS.INVALID_SIGNATURE}: ${message}`);
  }
}

/**
 * Process a completed checkout session.
 *
 * Extracts license details from the session metadata.
 *
 * @param sessionId - Stripe checkout session ID
 * @returns Processed payment data
 *
 * @example
 * ```typescript
 * const payment = await processCompletedCheckout('cs_xxx');
 * await createLicense(payment);
 * ```
 */
export async function processCompletedCheckout(sessionId: string): Promise<ProcessedPayment> {
  const stripe = getStripeClient();

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent'],
  });

  if (!session) {
    throw new Error(STRIPE_ERRORS.SESSION_NOT_FOUND);
  }

  if (session.payment_status !== 'paid') {
    throw new Error(STRIPE_ERRORS.PAYMENT_INCOMPLETE);
  }

  const metadata = session.metadata as CheckoutMetadata & {
    monthlyQuota: string;
    validityDays: string;
  };

  const paymentIntent = session.payment_intent as Stripe.PaymentIntent;

  return {
    sessionId: session.id,
    email: metadata.email || session.customer_email || '',
    companyName: metadata.companyName || '',
    planId: metadata.planId || '',
    amountPaid: session.amount_total || 0,
    currency: session.currency || 'eur',
    paymentIntentId: paymentIntent?.id || '',
    idempotencyKey: metadata.idempotencyKey || '',
  };
}

/**
 * Get available license plans.
 *
 * @returns Array of available plans
 */
export function getAvailablePlans(): LicensePlan[] {
  return Object.values(LICENSE_PLANS);
}

/**
 * Get a specific license plan.
 *
 * @param planId - Plan identifier
 * @returns Plan details or null if not found
 */
export function getPlan(planId: string): LicensePlan | null {
  return LICENSE_PLANS[planId] || null;
}

/**
 * Format price for display.
 *
 * @param cents - Price in cents
 * @param currency - Currency code (default: EUR)
 * @returns Formatted price string
 */
export function formatPrice(cents: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}
