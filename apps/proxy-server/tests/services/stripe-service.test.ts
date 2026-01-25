/**
 * Tests for Stripe Service.
 *
 * Tests the Stripe payment integration including checkout sessions,
 * webhook verification, and license plan management.
 *
 * @module tests/services/stripe-service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LICENSE_PLANS,
  STRIPE_ERRORS,
  generateIdempotencyKey,
  getAvailablePlans,
  getPlan,
  formatPrice,
} from '../../src/services/stripe-service';

describe('Stripe Service', () => {
  describe('LICENSE_PLANS', () => {
    it('should define STARTER plan with correct values', () => {
      const plan = LICENSE_PLANS.STARTER;

      expect(plan).toBeDefined();
      expect(plan.id).toBe('STARTER');
      expect(plan.name).toBe('VoiceInvoice Starter');
      expect(plan.priceInCents).toBe(2900);
      expect(plan.monthlyQuota).toBe(100);
      expect(plan.validityDays).toBe(365);
    });

    it('should define PROFESSIONAL plan with correct values', () => {
      const plan = LICENSE_PLANS.PROFESSIONAL;

      expect(plan).toBeDefined();
      expect(plan.id).toBe('PROFESSIONAL');
      expect(plan.name).toBe('VoiceInvoice Professional');
      expect(plan.priceInCents).toBe(7900);
      expect(plan.monthlyQuota).toBe(500);
      expect(plan.validityDays).toBe(365);
    });

    it('should define ENTERPRISE plan with correct values', () => {
      const plan = LICENSE_PLANS.ENTERPRISE;

      expect(plan).toBeDefined();
      expect(plan.id).toBe('ENTERPRISE');
      expect(plan.name).toBe('VoiceInvoice Enterprise');
      expect(plan.priceInCents).toBe(19900);
      expect(plan.monthlyQuota).toBe(10000);
      expect(plan.validityDays).toBe(365);
    });
  });

  describe('STRIPE_ERRORS', () => {
    it('should define all error messages', () => {
      expect(STRIPE_ERRORS.MISSING_SECRET_KEY).toBe(
        'STRIPE_SECRET_KEY environment variable is required'
      );
      expect(STRIPE_ERRORS.MISSING_WEBHOOK_SECRET).toBe(
        'STRIPE_WEBHOOK_SECRET environment variable is required'
      );
      expect(STRIPE_ERRORS.INVALID_PLAN).toBe('Invalid license plan');
      expect(STRIPE_ERRORS.INVALID_SIGNATURE).toBe('Invalid webhook signature');
      expect(STRIPE_ERRORS.SESSION_NOT_FOUND).toBe('Checkout session not found');
      expect(STRIPE_ERRORS.PAYMENT_INCOMPLETE).toBe('Payment not completed');
    });
  });

  describe('generateIdempotencyKey', () => {
    it('should generate unique keys', () => {
      const key1 = generateIdempotencyKey();
      const key2 = generateIdempotencyKey();

      expect(key1).not.toBe(key2);
    });

    it('should use default prefix', () => {
      const key = generateIdempotencyKey();

      expect(key).toMatch(/^ik_\d+_[a-f0-9-]+$/);
    });

    it('should use custom prefix', () => {
      const key = generateIdempotencyKey('checkout');

      expect(key).toMatch(/^checkout_\d+_[a-f0-9-]+$/);
    });

    it('should include timestamp', () => {
      const before = Date.now();
      const key = generateIdempotencyKey();
      const after = Date.now();

      const timestampMatch = key.match(/^ik_(\d+)_/);
      expect(timestampMatch).not.toBeNull();

      const timestamp = parseInt(timestampMatch![1], 10);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('getAvailablePlans', () => {
    it('should return all plans', () => {
      const plans = getAvailablePlans();

      expect(plans).toHaveLength(3);
      expect(plans.map((p) => p.id)).toEqual(['STARTER', 'PROFESSIONAL', 'ENTERPRISE']);
    });

    it('should return plans in correct order', () => {
      const plans = getAvailablePlans();

      // Prices should be in ascending order
      expect(plans[0].priceInCents).toBeLessThan(plans[1].priceInCents);
      expect(plans[1].priceInCents).toBeLessThan(plans[2].priceInCents);
    });
  });

  describe('getPlan', () => {
    it('should return plan by ID', () => {
      const plan = getPlan('PROFESSIONAL');

      expect(plan).not.toBeNull();
      expect(plan!.id).toBe('PROFESSIONAL');
      expect(plan!.priceInCents).toBe(7900);
    });

    it('should return null for unknown plan', () => {
      const plan = getPlan('UNKNOWN');

      expect(plan).toBeNull();
    });

    it('should return null for empty string', () => {
      const plan = getPlan('');

      expect(plan).toBeNull();
    });
  });

  describe('formatPrice', () => {
    it('should format EUR price correctly', () => {
      const formatted = formatPrice(2900);

      // German locale formats as "29,00 €"
      expect(formatted).toContain('29');
      expect(formatted).toContain('€');
    });

    it('should format large price correctly', () => {
      const formatted = formatPrice(19900);

      expect(formatted).toContain('199');
      expect(formatted).toContain('€');
    });

    it('should handle zero price', () => {
      const formatted = formatPrice(0);

      expect(formatted).toContain('0');
      expect(formatted).toContain('€');
    });

    it('should use custom currency', () => {
      const formatted = formatPrice(1000, 'USD');

      expect(formatted).toContain('10');
      expect(formatted).toContain('$');
    });
  });

  describe('createCheckoutSession', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should throw error when STRIPE_SECRET_KEY is not set', async () => {
      delete process.env.STRIPE_SECRET_KEY;

      const { createCheckoutSession } = await import('../../src/services/stripe-service');

      await expect(
        createCheckoutSession(
          'STARTER',
          'Test Company',
          'test@example.com',
          'https://example.com/success',
          'https://example.com/cancel'
        )
      ).rejects.toThrow(STRIPE_ERRORS.MISSING_SECRET_KEY);
    });

    it('should throw error for invalid plan ID', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_xxx';

      const { createCheckoutSession } = await import('../../src/services/stripe-service');

      await expect(
        createCheckoutSession(
          'INVALID_PLAN',
          'Test Company',
          'test@example.com',
          'https://example.com/success',
          'https://example.com/cancel'
        )
      ).rejects.toThrow(STRIPE_ERRORS.INVALID_PLAN);
    });
  });

  describe('verifyWebhookSignature', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should throw error when STRIPE_SECRET_KEY is not set', async () => {
      delete process.env.STRIPE_SECRET_KEY;

      const { verifyWebhookSignature } = await import('../../src/services/stripe-service');

      expect(() => verifyWebhookSignature(Buffer.from('{}'), 'sig_xxx')).toThrow(
        STRIPE_ERRORS.MISSING_SECRET_KEY
      );
    });

    it('should throw error when STRIPE_WEBHOOK_SECRET is not set', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_xxx';
      delete process.env.STRIPE_WEBHOOK_SECRET;

      const { verifyWebhookSignature } = await import('../../src/services/stripe-service');

      expect(() => verifyWebhookSignature(Buffer.from('{}'), 'sig_xxx')).toThrow(
        STRIPE_ERRORS.MISSING_WEBHOOK_SECRET
      );
    });

    it('should throw error for invalid signature', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_xxx';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_xxx';

      const { verifyWebhookSignature } = await import('../../src/services/stripe-service');

      expect(() => verifyWebhookSignature(Buffer.from('{}'), 'invalid_signature')).toThrow(
        STRIPE_ERRORS.INVALID_SIGNATURE
      );
    });
  });
});
