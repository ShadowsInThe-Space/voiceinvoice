/**
 * Tests for Stripe Portal Session Endpoint.
 *
 * Tests the portal session creation endpoint with authentication.
 *
 * @module tests/routes/stripe-portal-endpoint
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../../src/server';
import type { FastifyInstance } from 'fastify';

describe('POST /api/stripe/portal', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    server = await buildServer({ logger: false });
  });

  afterEach(async () => {
    await server.close();
  });

  it('should return 400 for missing returnUrl', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/stripe/portal',
      payload: {},
    });

    expect(response.statusCode).toBe(400);

    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
  });

  it('should return 400 for invalid returnUrl', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/stripe/portal',
      payload: {
        returnUrl: 'not-a-valid-url',
      },
    });

    expect(response.statusCode).toBe(400);

    const body = JSON.parse(response.body);
    expect(body.error).toContain('Invalid request body');
  });

  it('should return 400 when customer ID is missing', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/stripe/portal',
      payload: {
        returnUrl: 'https://app.voiceinvoice.de/settings/license',
      },
    });

    expect(response.statusCode).toBe(400);

    const body = JSON.parse(response.body);
    expect(body.error).toBe('Customer ID required');
  });

  it('should accept valid request with returnUrl and customerId', async () => {
    // Note: This will fail without actual Stripe configuration
    // This test verifies request validation, not Stripe integration
    const response = await server.inject({
      method: 'POST',
      url: '/api/stripe/portal',
      payload: {
        returnUrl: 'https://app.voiceinvoice.de/settings/license',
        customerId: 'cus_test123',
      },
    });

    // Should either succeed (200) or fail with Stripe error (400/500)
    // Not a validation error (400 with "Invalid request body")
    expect([200, 400, 500]).toContain(response.statusCode);

    if (response.statusCode !== 200) {
      const body = JSON.parse(response.body);
      // Should be Stripe error, not validation error
      expect(body.error).not.toBe('Invalid request body');
      expect(body.error).not.toBe('Customer ID required');
    }
  });
});

describe('GET /api/stripe/portal/config', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    server = await buildServer({ logger: false });
  });

  afterEach(async () => {
    await server.close();
  });

  it('should return portal configuration status', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/stripe/portal/config',
    });

    // Should return 200 or 500 depending on Stripe config
    expect([200, 500]).toContain(response.statusCode);

    const body = JSON.parse(response.body);

    if (response.statusCode === 200) {
      expect(body).toHaveProperty('configured');
    } else {
      expect(body).toHaveProperty('error');
    }
  });
});
