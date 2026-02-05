/**
 * Tests for Stripe Routes.
 *
 * Tests the Stripe API endpoints for checkout and webhook handling.
 *
 * @module tests/routes/stripe
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { registerStripeRoutes } from '../../src/routes/stripe';
import * as stripeService from '../../src/services/stripe-service';
import * as refundService from '../../src/services/refund-service';

vi.mock('../../src/services/license-service', () => ({
  LICENSE_ERRORS: {
    LICENSE_NOT_FOUND: 'License not found',
    QUOTA_EXCEEDED: 'Monthly quota exceeded',
    EXPIRED: 'License has expired',
    INACTIVE: 'License is inactive',
    INVALID_KEY: 'Invalid license key',
  },
}));

describe('Stripe Routes', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    server = Fastify({ logger: false });

    server.addContentTypeParser(
      'application/stripe+json',
      { parseAs: 'buffer' },
      (request, body, done) => {
        (request as FastifyRequest & { rawBody?: Buffer }).rawBody = body as Buffer;
        done(null, body);
      }
    );

    await registerStripeRoutes(server);
    await server.ready();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await server.close();
  });

  describe('GET /api/stripe/plans', () => {
    it('should return all available plans', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/stripe/plans',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.plans).toBeDefined();
      expect(body.plans).toHaveLength(3);
    });

    it('should return plan details with pricing', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/stripe/plans',
      });

      const body = JSON.parse(response.body);
      const starterPlan = body.plans.find((p: { id: string }) => p.id === 'STARTER');

      expect(starterPlan).toBeDefined();
      expect(starterPlan.name).toBe('VoiceInvoice Starter');
      expect(starterPlan.priceInCents).toBe(2900);
      expect(starterPlan.monthlyQuota).toBe(100);
      expect(starterPlan.price).toContain('29');
      expect(starterPlan.price).toContain('€');
    });

    it('should return plans in order by price', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/stripe/plans',
      });

      const body = JSON.parse(response.body);

      expect(body.plans[0].id).toBe('STARTER');
      expect(body.plans[1].id).toBe('PROFESSIONAL');
      expect(body.plans[2].id).toBe('ENTERPRISE');
    });
  });

  describe('POST /api/stripe/checkout', () => {
    it('should return 400 for missing planId', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/stripe/checkout',
        payload: {
          companyName: 'Test Company',
          email: 'test@example.com',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        },
      });

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });

    it('should return 400 for invalid planId', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/stripe/checkout',
        payload: {
          planId: 'INVALID',
          companyName: 'Test Company',
          email: 'test@example.com',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        },
      });

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });

    it('should return 400 for invalid email', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/stripe/checkout',
        payload: {
          planId: 'STARTER',
          companyName: 'Test Company',
          email: 'not-an-email',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        },
      });

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.error).toContain('email');
    });

    it('should return 400 for missing companyName', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/stripe/checkout',
        payload: {
          planId: 'STARTER',
          email: 'test@example.com',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        },
      });

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });

    it('should return 400 for invalid URLs', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/stripe/checkout',
        payload: {
          planId: 'STARTER',
          companyName: 'Test Company',
          email: 'test@example.com',
          successUrl: 'not-a-url',
          cancelUrl: 'https://example.com/cancel',
        },
      });

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.error).toContain('Url');
    });

    it('should return 500 when Stripe key is not configured', async () => {
      const originalKey = process.env.STRIPE_SECRET_KEY;
      delete process.env.STRIPE_SECRET_KEY;

      const response = await server.inject({
        method: 'POST',
        url: '/api/stripe/checkout',
        payload: {
          planId: 'STARTER',
          companyName: 'Test Company',
          email: 'test@example.com',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        },
      });

      process.env.STRIPE_SECRET_KEY = originalKey;

      expect(response.statusCode).toBe(500);

      const body = JSON.parse(response.body);
      expect(body.error).toContain('STRIPE_SECRET_KEY');
    });
  });

  describe('POST /api/stripe/webhook', () => {
    it('should return 400 for missing stripe-signature header', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/stripe/webhook',
        payload: { type: 'test_event' },
      });

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.error).toContain('stripe-signature');
    });

    it('should return 400 for invalid signature', async () => {
      const originalKey = process.env.STRIPE_SECRET_KEY;
      const originalWebhook = process.env.STRIPE_WEBHOOK_SECRET;

      process.env.STRIPE_SECRET_KEY = 'sk_test_xxx';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_xxx';

      const response = await server.inject({
        method: 'POST',
        url: '/api/stripe/webhook',
        headers: {
          'content-type': 'application/stripe+json',
          'stripe-signature': 'invalid_sig',
        },
        payload: JSON.stringify({ type: 'test_event' }),
      });

      process.env.STRIPE_SECRET_KEY = originalKey;
      process.env.STRIPE_WEBHOOK_SECRET = originalWebhook;

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid signature');
    });

    it('should handle refund.created events', async () => {
      const verifySpy = vi.spyOn(stripeService, 'verifyWebhookSignature').mockReturnValue({
        id: 'evt_refund_created',
        type: 'refund.created',
        data: {
          object: {
            id: 're_123',
            amount: 400,
            currency: 'eur',
            payment_intent: 'pi_123',
            status: 'succeeded',
          },
        },
      } as unknown as ReturnType<typeof stripeService.verifyWebhookSignature>);

      const applySpy = vi
        .spyOn(refundService, 'applyRefundEvent')
        .mockResolvedValue({ handled: true, refundedAmount: 400, licenseUpdated: false });

      const response = await server.inject({
        method: 'POST',
        url: '/api/stripe/webhook',
        headers: {
          'content-type': 'application/stripe+json',
          'stripe-signature': 'sig_test',
        },
        payload: JSON.stringify({ type: 'refund.created' }),
      });

      expect(response.statusCode).toBe(200);
      expect(verifySpy).toHaveBeenCalledTimes(1);
      expect(applySpy).toHaveBeenCalledWith({
        refundId: 're_123',
        paymentIntentId: 'pi_123',
        amount: 400,
        currency: 'eur',
        status: 'succeeded',
      });
    });

    it('should handle refund.updated events', async () => {
      const verifySpy = vi.spyOn(stripeService, 'verifyWebhookSignature').mockReturnValue({
        id: 'evt_refund_updated',
        type: 'refund.updated',
        data: {
          object: {
            id: 're_456',
            amount: 600,
            currency: 'eur',
            payment_intent: 'pi_456',
            status: 'pending',
          },
        },
      } as unknown as ReturnType<typeof stripeService.verifyWebhookSignature>);

      const applySpy = vi
        .spyOn(refundService, 'applyRefundEvent')
        .mockResolvedValue({ handled: true, refundedAmount: 0, licenseUpdated: false });

      const response = await server.inject({
        method: 'POST',
        url: '/api/stripe/webhook',
        headers: {
          'content-type': 'application/stripe+json',
          'stripe-signature': 'sig_test',
        },
        payload: JSON.stringify({ type: 'refund.updated' }),
      });

      expect(response.statusCode).toBe(200);
      expect(verifySpy).toHaveBeenCalledTimes(1);
      expect(applySpy).toHaveBeenCalledWith({
        refundId: 're_456',
        paymentIntentId: 'pi_456',
        amount: 600,
        currency: 'eur',
        status: 'pending',
      });
    });
  });

  describe('GET /api/stripe/session/:sessionId', () => {
    it('should return 400 for non-existent session', async () => {
      const originalKey = process.env.STRIPE_SECRET_KEY;
      process.env.STRIPE_SECRET_KEY = 'sk_test_xxx';

      const response = await server.inject({
        method: 'GET',
        url: '/api/stripe/session/cs_test_invalid',
      });

      process.env.STRIPE_SECRET_KEY = originalKey;

      expect(response.statusCode).toBe(400);
    });
  });
});
