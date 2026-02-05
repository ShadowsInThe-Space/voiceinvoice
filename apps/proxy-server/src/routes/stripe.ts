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
  STRIPE_ERRORS,
} from '../services/stripe-service';
import { getLicenseStore, License } from '../services/license-store';
import { randomBytes } from 'crypto';

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
      const rawBody = (request as FastifyRequest & { rawBody?: Buffer }).rawBody;

      if (!rawBody) {
        server.log.error('Raw body not available for webhook verification');
        const errorResponse: ErrorResponse = {
          error: 'Raw body not available',
          statusCode: 500,
        };
        return reply.status(500).send(errorResponse);
      }

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
                  stripeCustomerId: payment.stripeCustomerId,
                  status: 'ACTIVE',
                  monthlyQuota: plan.monthlyQuota,
                  currentUsage: 0,
                  usageResetDate,
                  expiresAt,
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

          case 'customer.subscription.deleted': {
            // Customer canceled subscription via Stripe Portal
            const subscription = event.data.object as {
              id: string;
              customer: string;
              status: string;
            };

            server.log.info(
              {
                subscriptionId: subscription.id,
                customerId: subscription.customer,
              },
              'Subscription deleted - deactivating license'
            );

            try {
              // Find license by stripeCustomerId
              const store = getLicenseStore();
              if ('updateLicenseByStripeCustomerId' in store) {
                await (
                  store as {
                    updateLicenseByStripeCustomerId: (
                      customerId: string,
                      updates: Partial<License>
                    ) => Promise<void>;
                  }
                ).updateLicenseByStripeCustomerId(subscription.customer, {
                  status: 'EXPIRED',
                  updatedAt: new Date(),
                });

                server.log.info(
                  { customerId: subscription.customer },
                  'License deactivated after subscription cancellation'
                );
              } else {
                server.log.warn('License store does not support updateLicenseByStripeCustomerId');
              }
            } catch (err) {
              server.log.error(
                { err, subscriptionId: subscription.id },
                'Failed to deactivate license after subscription deletion'
              );
            }
            break;
          }

          case 'customer.subscription.updated': {
            // Subscription updated (e.g., plan change, payment method update)
            const subscription = event.data.object as {
              id: string;
              customer: string;
              status: string;
              cancel_at_period_end: boolean;
            };

            server.log.info(
              {
                subscriptionId: subscription.id,
                customerId: subscription.customer,
                status: subscription.status,
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
              },
              'Subscription updated'
            );

            // If subscription is set to cancel at period end, log warning
            if (subscription.cancel_at_period_end) {
              server.log.warn(
                { customerId: subscription.customer },
                'Subscription will be canceled at period end'
              );
            }

            // If subscription becomes active again (e.g., payment succeeded after failure)
            if (subscription.status === 'active') {
              try {
                const store = getLicenseStore();
                if ('updateLicenseByStripeCustomerId' in store) {
                  await (
                    store as {
                      updateLicenseByStripeCustomerId: (
                        customerId: string,
                        updates: Partial<License>
                      ) => Promise<void>;
                    }
                  ).updateLicenseByStripeCustomerId(subscription.customer, {
                    status: 'ACTIVE',
                    updatedAt: new Date(),
                  });

                  server.log.info(
                    { customerId: subscription.customer },
                    'License reactivated after subscription update'
                  );
                }
              } catch (err) {
                server.log.error(
                  { err, subscriptionId: subscription.id },
                  'Failed to update license after subscription update'
                );
              }
            }
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
}
