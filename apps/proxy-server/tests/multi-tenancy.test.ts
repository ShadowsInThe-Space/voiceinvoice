import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
// Mock services before import
vi.mock('../src/services/speech-service', () => ({
  transcribeAudio: vi.fn(),
  checkAvailability: vi.fn().mockResolvedValue(true),
}));

vi.mock('../src/services/gemini-service', () => ({
  extractInvoiceData: vi.fn(),
  checkAvailability: vi.fn().mockResolvedValue(true),
}));

import { buildServer } from '../src/server';
import { generateLicenseToken } from '../src/services/license-service';
import { PrismaClient } from '../generated/client';

describe('Multi-Tenancy Integration Tests', () => {
  let server: FastifyInstance;
  let prisma: PrismaClient;
  const originalEnv = process.env.NODE_ENV;

  // Test Tokens
  const tenantA = {
    licenseKey: 'LICENSE-KEY-A',
    companyName: 'Tenant A Corp',
    token: '',
  };

  const tenantB = {
    licenseKey: 'LICENSE-KEY-B',
    companyName: 'Tenant B Inc',
    token: '',
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    // Ensure JWT Secret is set
    process.env.JWT_SECRET = 'test-secret-key-123456789';

    // Connect to actual DB
    prisma = new PrismaClient();
    await prisma.$connect();

    // Setup Test Tenants in DB
    await prisma.syncedEntity.deleteMany(); // Clean start
    await prisma.license.deleteMany();

    const licenseA = await prisma.license.create({
      data: {
        licenseKey: tenantA.licenseKey,
        companyName: tenantA.companyName,
        expiresAt: new Date(Date.now() + 10000000),
        usageResetDate: new Date(),
      },
    });

    const licenseB = await prisma.license.create({
      data: {
        licenseKey: tenantB.licenseKey,
        companyName: tenantB.companyName,
        expiresAt: new Date(Date.now() + 10000000),
        usageResetDate: new Date(),
      },
    });

    // Generate Tokens
    tenantA.token = generateLicenseToken({
      licenseKey: tenantA.licenseKey,
      companyName: tenantA.companyName,
      expiresAt: licenseA.expiresAt.toISOString(),
    });

    tenantB.token = generateLicenseToken({
      licenseKey: tenantB.licenseKey,
      companyName: tenantB.companyName,
      expiresAt: licenseB.expiresAt.toISOString(),
    });

    server = await buildServer({ logger: false });
  });

  afterAll(async () => {
    await server.close();
    await prisma.$disconnect();
    process.env.NODE_ENV = originalEnv;
  });

  beforeEach(async () => {
    // Optional: Clean synced entities between tests if needed
    await prisma.syncedEntity.deleteMany();
  });

  it('should isolate data between tenants (Tenant A cannot read Tenant B data)', async () => {
    // 1. Tenant A pushes an invoice
    const invoiceId = 'inv-a-1';
    await server.inject({
      method: 'POST',
      url: '/api/sync/push',
      headers: { Authorization: `Bearer ${tenantA.token}` },
      payload: {
        entityType: 'invoice',
        entityId: invoiceId,
        operation: 'CREATE',
        data: { amount: 100, customer: 'Client A' },
        timestamp: Date.now(),
      },
    });

    // 2. Tenant B pushes their own invoice
    const invoiceIdB = 'inv-b-1';
    await server.inject({
      method: 'POST',
      url: '/api/sync/push',
      headers: { Authorization: `Bearer ${tenantB.token}` },
      payload: {
        entityType: 'invoice',
        entityId: invoiceIdB,
        operation: 'CREATE',
        data: { amount: 500, customer: 'Client B' },
        timestamp: Date.now(),
      },
    });

    // 3. Tenant A pulls changes
    const responseA = await server.inject({
      method: 'GET',
      url: '/api/sync/pull',
      headers: { Authorization: `Bearer ${tenantA.token}` },
    });

    const bodyA = JSON.parse(responseA.body);

    // Should see own invoice
    expect(bodyA.changes).toEqual(
      expect.arrayContaining([expect.objectContaining({ entityId: invoiceId })])
    );

    // Should NOT see Tenant B invoice
    expect(bodyA.changes).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ entityId: invoiceIdB })])
    );
  });

  it('should prevent cross-tenant updates (Tenant B cannot update Tenant A entity)', async () => {
    // 1. Tenant A creates an entity
    const entityId = 'shared-id-attempt';
    await server.inject({
      method: 'POST',
      url: '/api/sync/push',
      headers: { Authorization: `Bearer ${tenantA.token}` },
      payload: {
        entityType: 'customer',
        entityId: entityId,
        operation: 'CREATE',
        data: { name: 'Original Name' },
        timestamp: Date.now(),
      },
    });

    // 2. Tenant B tries to update SAME entity ID (which is valid logic, but should be a DIFFERENT record internally)
    await server.inject({
      method: 'POST',
      url: '/api/sync/push',
      headers: { Authorization: `Bearer ${tenantB.token}` },
      payload: {
        entityType: 'customer',
        entityId: entityId, // Same ID, different tenant
        operation: 'UPDATE',
        data: { name: 'Hacked Name' },
        timestamp: Date.now(),
      },
    });

    // 3. Verify Tenant A's data is unchanged
    const responseA = await server.inject({
      method: 'GET',
      url: '/api/sync/pull',
      headers: { Authorization: `Bearer ${tenantA.token}` },
    });
    const bodyA = JSON.parse(responseA.body);
    const entityA = bodyA.changes.find((c: any) => c.entityId === entityId);
    expect(entityA.data.name).toBe('Original Name');

    // 4. Verify Tenant B has their OWN version
    const responseB = await server.inject({
      method: 'GET',
      url: '/api/sync/pull',
      headers: { Authorization: `Bearer ${tenantB.token}` },
    });
    const bodyB = JSON.parse(responseB.body);
    const entityB = bodyB.changes.find((c: any) => c.entityId === entityId);
    expect(entityB.data.name).toBe('Hacked Name');
  });

  it('should enforce usage quotas separately', async () => {
    // Only Tenant A makes requests
    // This test assumes usage tracking middleware is active on other routes,
    // but for now we verify that standard operations don't cross-contaminate counters if implemented.
    // Since specific quota logic acts on /transcribe, we'll verify checking license status via DB directly

    const licenseA = await prisma.license.findUnique({ where: { licenseKey: tenantA.licenseKey } });
    const licenseB = await prisma.license.findUnique({ where: { licenseKey: tenantB.licenseKey } });

    expect(licenseA?.currentUsage).toBe(0);
    expect(licenseB?.currentUsage).toBe(0);

    // TODO: Call an endpoint that consumes quota to verify increment
  });
});
