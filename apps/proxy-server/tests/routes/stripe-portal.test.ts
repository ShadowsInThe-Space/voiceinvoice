/**
 * Tests for Stripe Portal Routes.
 *
 * Tests the Stripe Billing Portal endpoints for customer subscription management.
 *
 * @module tests/routes/stripe-portal
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../../src/server';
import type { FastifyInstance } from 'fastify';

describe('Stripe Portal Routes', () => {
  let server: FastifyInstance;
  let prisma: PrismaClient;

  beforeEach(async () => {
    server = await buildServer({ logger: false });
    prisma = new PrismaClient();
  });

  afterEach(async () => {
    await prisma.$disconnect();
    await server.close();
  });

  describe('License Model - stripeCustomerId support', () => {
    it('should allow creating license with stripeCustomerId', async () => {
      // Create tenant first
      const tenant = await prisma.tenant.create({
        data: {
          name: 'Test Company GmbH',
        },
      });

      // Create license with stripeCustomerId
      const license = await prisma.license.create({
        data: {
          licenseKey: 'VI-TEST-CUST-ID01',
          status: 'ACTIVE',
          tenantId: tenant.id,
          monthlyQuota: 500,
          currentUsage: 0,
          usageResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          stripeCustomerId: 'cus_test123',
          companyName: 'Test Company GmbH',
        },
      });

      expect(license.stripeCustomerId).toBe('cus_test123');
      expect(license.companyName).toBe('Test Company GmbH');

      // Cleanup
      await prisma.license.delete({ where: { id: license.id } });
      await prisma.tenant.delete({ where: { id: tenant.id } });
    });

    it('should allow stripeCustomerId to be null', async () => {
      // Create tenant first
      const tenant = await prisma.tenant.create({
        data: {
          name: 'Test Company GmbH',
        },
      });

      // Create license without stripeCustomerId (trial license)
      const license = await prisma.license.create({
        data: {
          licenseKey: 'VI-TEST-NULL-ID01',
          status: 'TRIAL',
          tenantId: tenant.id,
          monthlyQuota: 100,
          currentUsage: 0,
          usageResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          stripeCustomerId: null,
          companyName: 'Test Company GmbH',
        },
      });

      expect(license.stripeCustomerId).toBeNull();

      // Cleanup
      await prisma.license.delete({ where: { id: license.id } });
      await prisma.tenant.delete({ where: { id: tenant.id } });
    });

    it('should enforce unique stripeCustomerId', async () => {
      // Create first tenant and license
      const tenant1 = await prisma.tenant.create({
        data: { name: 'Company A' },
      });

      const license1 = await prisma.license.create({
        data: {
          licenseKey: 'VI-TEST-UNIQ-01',
          status: 'ACTIVE',
          tenantId: tenant1.id,
          monthlyQuota: 500,
          currentUsage: 0,
          usageResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          stripeCustomerId: 'cus_duplicate_test',
          companyName: 'Company A',
        },
      });

      // Try to create second tenant with same stripeCustomerId
      const tenant2 = await prisma.tenant.create({
        data: { name: 'Company B' },
      });

      await expect(
        prisma.license.create({
          data: {
            licenseKey: 'VI-TEST-UNIQ-02',
            status: 'ACTIVE',
            tenantId: tenant2.id,
            monthlyQuota: 500,
            currentUsage: 0,
            usageResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            stripeCustomerId: 'cus_duplicate_test', // Duplicate!
            companyName: 'Company B',
          },
        })
      ).rejects.toThrow();

      // Cleanup
      await prisma.license.delete({ where: { id: license1.id } });
      await prisma.tenant.delete({ where: { id: tenant1.id } });
      await prisma.tenant.delete({ where: { id: tenant2.id } });
    });
  });

  describe('POST /api/stripe/portal/config', () => {
    it('should return portal configuration status', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/stripe/portal/config',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('configured');
    });
  });
});
