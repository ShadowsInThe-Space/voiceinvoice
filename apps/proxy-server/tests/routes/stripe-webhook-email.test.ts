/**
 * Tests for Stripe webhook email delivery.
 *
 * Ensures license emails are sent after successful checkout completion.
 *
 * @module tests/routes/stripe-webhook-email
 */

import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/email-service', () => ({
  sendLicenseEmail: vi.fn(),
}));

vi.mock('../../src/services/license-store', () => ({
  getLicenseStore: () => ({ addLicense: vi.fn() }),
}));

vi.mock('../../src/services/stripe-service', async () => {
  const actual = await vi.importActual<typeof import('../../src/services/stripe-service')>(
    '../../src/services/stripe-service'
  );

  return {
    ...actual,
    verifyWebhookSignature: vi.fn(),
    processCompletedCheckout: vi.fn(),
    getPlan: vi.fn(),
  };
});

import { sendLicenseEmail } from '../../src/services/email-service';
import {
  getPlan,
  processCompletedCheckout,
  verifyWebhookSignature,
  LICENSE_PLANS,
} from '../../src/services/stripe-service';

const paymentData = {
  sessionId: 'cs_test_123',
  email: 'buyer@example.com',
  companyName: 'Acme GmbH',
  planId: 'STARTER',
  amountPaid: 2900,
  currency: 'eur',
  paymentIntentId: 'pi_123',
  idempotencyKey: 'ik_123',
};

describe('Stripe Webhook Email', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    server = Fastify({ logger: false });

    server.addContentTypeParser('*', { parseAs: 'buffer' }, (request, body, done) => {
      (request as { rawBody?: Buffer }).rawBody = body as Buffer;
      done(null, body);
    });

    server.addHook('preHandler', (request, _reply, done) => {
      const current = request as { rawBody?: Buffer; body?: unknown };
      if (!current.rawBody) {
        const body = current.body ?? '';
        current.rawBody = Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
      }
      done();
    });

    const { registerStripeRoutes } = await import('../../src/routes/stripe');
    await registerStripeRoutes(server);
  });

  afterEach(async () => {
    await server.close();
    vi.clearAllMocks();
  });

  it('should send a license email on paid checkout session', async () => {
    vi.mocked(verifyWebhookSignature).mockReturnValue({
      id: 'evt_test_123',
      type: 'checkout.session.completed',
      data: {
        object: { id: 'cs_test_123', payment_status: 'paid' },
      },
    } as unknown as ReturnType<typeof verifyWebhookSignature>);

    vi.mocked(processCompletedCheckout).mockResolvedValue(paymentData);
    vi.mocked(getPlan).mockReturnValue(LICENSE_PLANS.STARTER);

    const response = await server.inject({
      method: 'POST',
      url: '/api/stripe/webhook',
      headers: { 'stripe-signature': 'sig_test' },
      payload: { id: 'evt_test_123' },
    });

    expect(response.statusCode).toBe(200);
    expect(sendLicenseEmail).toHaveBeenCalledTimes(1);

    const [email, licenseKey, plan] = vi.mocked(sendLicenseEmail).mock.calls[0];
    expect(email).toBe(paymentData.email);
    expect(plan).toBe(LICENSE_PLANS.STARTER);
    expect(licenseKey).toMatch(/^VI-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });
});
