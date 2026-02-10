/**
 * Stripe Routes
 *
 * API endpoints for Stripe payments and webhook handling.
 * Implements secure checkout flow and webhook verification.
 *
 * @module routes/stripe
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  createCheckoutSession,
  verifyWebhookSignature,
  processCompletedCheckout,
  getAvailablePlans,
  getPlan,
  formatPrice,
  createBillingPortalSession,
  STRIPE_ERRORS,
} from '../services/stripe-service';
import { getLicenseStore, License } from '../services/license-store';
import { randomBytes } from 'crypto';
import { createLicenseAuthHook } from './license';

/**
 * Schema for POST /api/stripe/checkout request body.
 */
const checkoutSchema = z.object({
  planId: z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE']),
  companyName: z.string().min(1, 'companyName is required'),
  email: z.string().email('Valid email is required'),
  successUrl: z.string().url('Valid successUrl is required'),
  cancelUrl: z.string().url('Valid cancelUrl is required'),
});

/**
 * Schema for POST /api/stripe/billing-portal request body.
 */
const billingPortalSchema = z.object({
  returnUrl: z.string().url('Valid returnUrl is required'),
});

/**
 * Error response structure.
 */
interface ErrorResponse {
  error: string;
  statusCode: number;
}

/**
 * Checkout response structure.
 */
interface CheckoutResponse {
  sessionId: string;
  url: string;
}

/**
 * Billing portal response structure.
 */
interface BillingPortalResponse {
  url: string;
}

/**
 * Plans response structure.
 */
interface PlansResponse {
  plans: Array<{
    id: string;
    name: string;
    description: string;
    price: string;
    priceInCents: number;
    monthlyQuota: number;
    validityDays: number;
  }>;
}

/**
 * Generate a unique license key.
 *
 * Format: VI-XXXX-XXXX-XXXX (VI = VoiceInvoice)
 *
 * @returns Generated license key
 */
function generateLicenseKey(): string {
  const segments: string[] = [];
  for (let i = 0; i < 3; i++) {
    segments.push(randomBytes(2).toString('hex').toUpperCase());
  }
  return `VI-${segments.join('-')}`;
}

/**
 * Register Stripe-related routes.
 *
 * @param server - Fastify instance
 *
 * @example
 * ```typescript
 * import { buildServer } from './server';
 * import { registerStripeRoutes } from './routes/stripe';
 *
 * const server = await buildServer();
 * await registerStripeRoutes(server);
 * ```
 */
export async function registerStripeRoutes(server: FastifyInstance): Promise<void> {
  /**
   * GET /api/stripe/plans
   *
   * Returns available license plans with pricing.
   */
  server.get('/api/stripe/plans', async (_request: FastifyRequest, reply: FastifyReply) => {
    const plans = getAvailablePlans();

    const response: PlansResponse = {
      plans: plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        price: formatPrice(plan.priceInCents),
        priceInCents: plan.priceInCents,
        monthlyQuota: plan.monthlyQuota,
        validityDays: plan.validityDays,
      })),
    };

    return reply.status(200).send(response);
  });

  /**
   * POST /api/stripe/checkout
   *
   * Creates a Stripe checkout session for license purchase.
   */
  server.post<{
    Body: {
      planId?: string;
      companyName?: string;
      email?: string;
      successUrl?: string;
      cancelUrl?: string;
    };
  }>('/api/stripe/checkout', async (request: FastifyRequest, reply: FastifyReply) => {
    // Validate request body
    const parseResult = checkoutSchema.safeParse(request.body);

    if (!parseResult.success) {
      const errorResponse: ErrorResponse = {
        error: parseResult.error.errors[0]?.message || 'Invalid request body',
        statusCode: 400,
      };
      return reply.status(400).send(errorResponse);
    }

    const { planId, companyName, email, successUrl, cancelUrl } = parseResult.data;

    try {
      const session = await createCheckoutSession(
        planId,
        companyName,
        email,
        successUrl,
        cancelUrl
      );

      const response: CheckoutResponse = {
        sessionId: session.sessionId,
        url: session.url,
      };

      return reply.status(200).send(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create checkout session';
      server.log.error({ err }, 'Stripe checkout error');

      const errorResponse: ErrorResponse = {
        error: message,
        statusCode: 500,
      };
      return reply.status(500).send(errorResponse);
    }
  });

  /**
   * POST /api/stripe/webhook
   *
   * Handles Stripe webhook events.
   * CRITICAL: Uses raw body for signature verification.
   */
  server.post(
    '/api/stripe/webhook',
    {
      config: {
        // Disable built-in JSON parsing for webhook - handled by custom content parser in server.ts
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const signature = request.headers['stripe-signature'] as string;

      if (!signature) {
        const errorResponse: ErrorResponse = {
          error: 'Missing stripe-signature header',
          statusCode: 400,
        };
        return reply.status(400).send(errorResponse);
      }

      // Get raw body for signature verification
      // In production, rawBody is set by the custom content parser in server.ts
      // In tests, we fall back to stringifying the parsed body
      const rawBody =
        (request as FastifyRequest & { rawBody?: Buffer }).rawBody ??
        Buffer.from(typeof request.body === 'string' ? request.body : JSON.stringify(request.body));

      try {
        // Verify webhook signature - CRITICAL for security
        const event = verifyWebhookSignature(rawBody, signature);

        server.log.info({ eventType: event.type, eventId: event.id }, 'Stripe webhook received');

        // Handle specific events
        switch (event.type) {
          case 'checkout.session.completed': {
            const session = event.data.object as { id: string; payment_status: string };

            if (session.payment_status === 'paid') {
              try {
                // Process the completed checkout
                const payment = await processCompletedCheckout(session.id);

                // Get plan details
                const plan = getPlan(payment.planId);
                if (!plan) {
                  server.log.error({ planId: payment.planId }, 'Unknown plan in webhook');
                  break;
                }

                // Generate license
                const licenseKey = generateLicenseKey();
                const now = new Date();
                const expiresAt = new Date(now.getTime() + plan.validityDays * 24 * 60 * 60 * 1000);
                const usageResetDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

                const license: License = {
                  id: randomBytes(16).toString('hex'),
                  licenseKey,
                  companyName: payment.companyName,
                  status: 'ACTIVE',
                  monthlyQuota: plan.monthlyQuota,
                  currentUsage: 0,
                  usageResetDate,
                  expiresAt,
                  stripeCustomerId: payment.stripeCustomerId,
                  createdAt: now,
                  updatedAt: now,
                };

                // Store license (in production, this would also send email)
                const store = getLicenseStore();
                if ('addLicense' in store) {
                  (store as { addLicense: (license: License) => void }).addLicense(license);
                }

                server.log.info(
                  {
                    licenseKey,
                    companyName: payment.companyName,
                    planId: payment.planId,
                    sessionId: payment.sessionId,
                  },
                  'License created from Stripe payment'
                );

                // TODO: Send license key via email to payment.email
                // await sendLicenseEmail(payment.email, licenseKey, plan);
              } catch (processErr) {
                server.log.error(
                  { err: processErr, sessionId: session.id },
                  'Failed to process checkout'
                );
              }
            }
            break;
          }

          case 'payment_intent.payment_failed': {
            const paymentIntent = event.data.object as {
              id: string;
              last_payment_error?: { message?: string };
            };
            server.log.warn(
              {
                paymentIntentId: paymentIntent.id,
                error: paymentIntent.last_payment_error?.message,
              },
              'Payment failed'
            );
            break;
          }

          default:
            server.log.debug({ eventType: event.type }, 'Unhandled webhook event type');
        }

        // Always acknowledge receipt
        return reply.status(200).send({ received: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Webhook error';
        server.log.error({ err }, 'Stripe webhook verification failed');

        // Return 400 for invalid signature (Stripe will retry)
        if (message.includes(STRIPE_ERRORS.INVALID_SIGNATURE)) {
          const errorResponse: ErrorResponse = {
            error: 'Invalid signature',
            statusCode: 400,
          };
          return reply.status(400).send(errorResponse);
        }

        // Return 500 for other errors (Stripe will retry)
        const errorResponse: ErrorResponse = {
          error: message,
          statusCode: 500,
        };
        return reply.status(500).send(errorResponse);
      }
    }
  );

  /**
   * GET /api/stripe/session/:sessionId
   *
   * Returns details of a checkout session (for success page).
   */
  server.get<{
    Params: { sessionId: string };
  }>('/api/stripe/session/:sessionId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { sessionId } = request.params as { sessionId: string };

    if (!sessionId) {
      const errorResponse: ErrorResponse = {
        error: 'sessionId is required',
        statusCode: 400,
      };
      return reply.status(400).send(errorResponse);
    }

    try {
      const payment = await processCompletedCheckout(sessionId);
      const plan = getPlan(payment.planId);

      return reply.status(200).send({
        success: true,
        email: payment.email,
        companyName: payment.companyName,
        plan: plan
          ? {
              id: plan.id,
              name: plan.name,
              price: formatPrice(plan.priceInCents),
            }
          : null,
        // Note: License key is sent via email, not returned here for security
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve session';
      server.log.error({ err, sessionId }, 'Failed to retrieve session');

      const errorResponse: ErrorResponse = {
        error: message,
        statusCode: 400,
      };
      return reply.status(400).send(errorResponse);
    }
  });

  /**
   * POST /api/stripe/billing-portal
   *
   * Creates a Stripe billing portal session for license management.
   * SECURITY: Requires valid license key in x-license-key header.
   * Customer ID is extracted from the authenticated license, NOT from client.
   * Rate limited to 5 requests per minute per license.
   */
  server.post<{
    Body: {
      returnUrl?: string;
    };
  }>(
    '/api/stripe/billing-portal',
    {
      preHandler: createLicenseAuthHook(),
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
          keyGenerator: (request) => request.headers['x-license-key'] as string,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Validate request body
      const parseResult = billingPortalSchema.safeParse(request.body);

      if (!parseResult.success) {
        const errorResponse: ErrorResponse = {
          error: parseResult.error.errors[0]?.message || 'Invalid request body',
          statusCode: 400,
        };
        return reply.status(400).send(errorResponse);
      }

      const { returnUrl } = parseResult.data;

      // Get license from header (validated by preHandler)
      const licenseKey = request.headers['x-license-key'] as string;

      try {
        const store = getLicenseStore();
        const license = await store.getLicense(licenseKey);

        if (!license) {
          const errorResponse: ErrorResponse = {
            error: 'License not found',
            statusCode: 404,
          };
          return reply.status(404).send(errorResponse);
        }

        if (!license.stripeCustomerId) {
          const errorResponse: ErrorResponse = {
            error: 'No billing information found for this license',
            statusCode: 400,
          };
          return reply.status(400).send(errorResponse);
        }

        // Create portal session with customer ID from license (SECURE)
        const session = await createBillingPortalSession(license.stripeCustomerId, returnUrl);

        const response: BillingPortalResponse = {
          url: session.url,
        };

        return reply.status(200).send(response);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create portal session';
        server.log.error({ err, licenseKey }, 'Billing portal error');

        const errorResponse: ErrorResponse = {
          error: message,
          statusCode: 500,
        };
        return reply.status(500).send(errorResponse);
      }
    }
  );
}
