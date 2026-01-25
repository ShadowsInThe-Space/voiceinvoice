/**
 * Tests for Stripe Routes.
 *
 * Tests the Stripe API endpoints for checkout and webhook handling.
 *
 * @module tests/routes/stripe
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../../src/server';
import type { FastifyInstance } from 'fastify';

describe('Stripe Routes', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    server = await buildServer({ logger: false });
  });

  afterEach(async () => {
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
      // This test verifies that proper error handling occurs when Stripe isn't configured
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
          'stripe-signature': 'invalid_sig',
        },
        payload: { type: 'test_event' },
      });

      process.env.STRIPE_SECRET_KEY = originalKey;
      process.env.STRIPE_WEBHOOK_SECRET = originalWebhook;

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid signature');
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

      // Should return 400 because session doesn't exist
      expect(response.statusCode).toBe(400);
    });
  });
});
