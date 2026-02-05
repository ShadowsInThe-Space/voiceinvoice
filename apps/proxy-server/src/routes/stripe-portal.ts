/**
 * Stripe Billing Portal Routes
 *
 * Provides endpoints for Stripe Customer Portal integration.
 * Allows customers to manage their subscription, payment methods,
 * and view invoices through Stripe's hosted portal.
 *
 * @module routes/stripe-portal
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import Stripe from 'stripe';

/**
 * Request schema for creating portal session.
 */
const CreatePortalSessionSchema = z.object({
  /** Return URL after customer completes portal actions */
  returnUrl: z.string().url('Valid return URL required'),
});

type CreatePortalSessionRequest = z.infer<typeof CreatePortalSessionSchema>;

/**
 * Response structure for portal session creation.
 */
interface CreatePortalSessionResponse {
  /** Stripe portal session ID */
  sessionId: string;
  /** URL to redirect customer to portal */
  url: string;
}

/**
 * Registers Stripe Billing Portal routes.
 *
 * @param server - Fastify instance
 */
export async function registerStripePortalRoutes(server: FastifyInstance): Promise<void> {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    server.log.warn('STRIPE_SECRET_KEY not configured - portal routes disabled');
    return;
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2024-12-18.acacia',
  });

  /**
   * POST /api/stripe/portal
   *
   * Creates a Stripe Billing Portal session for a customer.
   * The customer must have an active license with a Stripe customer ID.
   *
   * @param request.body.returnUrl - URL to return to after portal actions
   * @returns Portal session ID and URL
   */
  server.post<{
    Body: CreatePortalSessionRequest;
  }>(
    '/api/stripe/portal',
    async (request: FastifyRequest<{ Body: CreatePortalSessionRequest }>, reply: FastifyReply) => {
      try {
        // Validate request body
        const validation = CreatePortalSessionSchema.safeParse(request.body);

        if (!validation.success) {
          return reply.status(400).send({
            error: 'Invalid request body',
            statusCode: 400,
            details: validation.error.issues,
          });
        }

        const { returnUrl } = validation.data;

        // Get customer ID from authenticated license
        // TODO: Extract from JWT token or session
        // For now, we'll require it in the request
        const customerId = (request.body as { customerId?: string }).customerId;

        if (!customerId) {
          return reply.status(400).send({
            error: 'Customer ID required',
            statusCode: 400,
          });
        }

        server.log.info({ customerId, returnUrl }, 'Creating portal session');

        // Create Stripe portal session
        const session = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: returnUrl,
        });

        const response: CreatePortalSessionResponse = {
          sessionId: session.id,
          url: session.url,
        };

        server.log.info({ sessionId: session.id }, 'Portal session created');

        return reply.status(200).send(response);
      } catch (error) {
        server.log.error({ err: error }, 'Failed to create portal session');

        if (error instanceof Stripe.errors.StripeError) {
          return reply.status(400).send({
            error: `Stripe error: ${error.message}`,
            statusCode: 400,
          });
        }

        return reply.status(500).send({
          error: 'Internal server error',
          statusCode: 500,
        });
      }
    }
  );

  /**
   * GET /api/stripe/portal/config
   *
   * Returns the portal configuration status.
   * This endpoint can be used to check if the portal is properly configured.
   */
  server.get('/api/stripe/portal/config', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Check if portal is configured by attempting to retrieve configurations
      const configurations = await stripe.billingPortal.configurations.list({ limit: 1 });

      return reply.status(200).send({
        configured: configurations.data.length > 0,
        defaultConfiguration: configurations.data[0]?.id || null,
      });
    } catch (error) {
      server.log.error({ err: error }, 'Failed to check portal config');

      return reply.status(500).send({
        error: 'Failed to check portal configuration',
        statusCode: 500,
      });
    }
  });
}
