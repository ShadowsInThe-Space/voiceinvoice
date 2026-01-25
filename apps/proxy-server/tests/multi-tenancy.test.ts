import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';

// Mock services
vi.mock('../src/services/speech-service', () => ({
  transcribeAudio: vi.fn(),
  checkAvailability: vi.fn().mockResolvedValue(true),
}));

vi.mock('../src/services/gemini-service', () => ({
  extractInvoiceData: vi.fn(),
  checkAvailability: vi.fn().mockResolvedValue(true),
}));

// Mock Prisma Client
const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      license: {
        findUnique: vi.fn(),
        create: vi.fn(),
        deleteMany: vi.fn(),
      },
      syncedEntity: {
        findMany: vi.fn(),
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
    },
  };
});

vi.mock('../generated/client', () => {
  return {
    PrismaClient: vi.fn(() => mockPrisma),
    Prisma: {
      SyncedEntityScalarFieldEnum: {},
    },
  };
});

import { buildServer } from '../src/server';
import { generateLicenseToken } from '../src/services/license-service';

describe('Multi-Tenancy Integration Tests', () => {
  let server: FastifyInstance;
  const originalEnv = process.env.NODE_ENV;

  // Test Tenants
  const tenantA = {
    id: 'license-id-a',
    licenseKey: 'LICENSE-KEY-A',
    companyName: 'Tenant A Corp',
    token: '',
  };

  const tenantB = {
    id: 'license-id-b',
    licenseKey: 'LICENSE-KEY-B',
    companyName: 'Tenant B Inc',
    token: '',
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-key-123456789'; // Ensure secret is set for token generation

    // Generate Tokens
    tenantA.token = generateLicenseToken({
      licenseKey: tenantA.licenseKey,
      companyName: tenantA.companyName,
      expiresAt: new Date(Date.now() + 10000000).toISOString(),
    });

    tenantB.token = generateLicenseToken({
      licenseKey: tenantB.licenseKey,
      companyName: tenantB.companyName,
      expiresAt: new Date(Date.now() + 10000000).toISOString(),
    });

    server = await buildServer({ logger: false });
  });

  afterAll(async () => {
    await server.close();
    process.env.NODE_ENV = originalEnv;
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default Mock Behavior: Find License returns appropriate ID
    mockPrisma.license.findUnique.mockImplementation(async (args: any) => {
      if (args.where.licenseKey === tenantA.licenseKey) {
        return tenantA;
      }
      if (args.where.licenseKey === tenantB.licenseKey) {
        return tenantB;
      }
      return null;
    });
  });

  it('should isolate data between tenants (Tenant A cannot read Tenant B data)', async () => {
    // Setup: Tenant A has an invoice, Tenant B has an invoice
    // We mock findMany to return FILTERED results based on the licenseId passed in the where clause
    mockPrisma.syncedEntity.findMany.mockImplementation(async (args: any) => {
      const licenseId = args.where.licenseId;
      if (licenseId === tenantA.id) {
        return [
          {
            entityType: 'invoice',
            entityId: 'inv-a-1',
            data: { amount: 100 },
            updatedAt: new Date(),
            version: 1,
          },
        ];
      }
      if (licenseId === tenantB.id) {
        return [
          {
            entityType: 'invoice',
            entityId: 'inv-b-1',
            data: { amount: 500 },
            updatedAt: new Date(),
            version: 1,
          },
        ];
      }
      return [];
    });

    // Action: Tenant A pulls changes
    const responseA = await server.inject({
      method: 'GET',
      url: '/api/sync/pull',
      headers: { Authorization: `Bearer ${tenantA.token}` },
    });

    const bodyA = JSON.parse(responseA.body);

    // Assert 1: Service called DB with correct filter
    expect(mockPrisma.syncedEntity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          licenseId: tenantA.id,
        }),
      })
    );

    // Assert 2: Only Tenant A's invoice is returned
    expect(bodyA.changes).toHaveLength(1);
    expect(bodyA.changes[0].entityId).toBe('inv-a-1');
  });

  it('should prevent cross-tenant updates (Tenant B cannot update Tenant A entity)', async () => {
    // Action: Tenant B pushes an update for an entity ID that hypothetically belongs to A (in a shared world),
    // but here we verify that the upsert uses Tenant B's licenseId.

    const targetEntityId = 'shared-id';

    await server.inject({
      method: 'POST',
      url: '/api/sync/push',
      headers: { Authorization: `Bearer ${tenantB.token}` },
      payload: {
        entityType: 'customer',
        entityId: targetEntityId,
        operation: 'UPDATE',
        data: { name: 'Hacked' },
        timestamp: Date.now(),
      },
    });

    // Assert: Upsert is called with Tenant B's ID in the Unique constraint
    expect(mockPrisma.syncedEntity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          licenseId_entityType_entityId: {
            licenseId: tenantB.id, // CRITICAL: Must be B's ID
            entityType: 'customer',
            entityId: targetEntityId,
          },
        },
        update: expect.anything(),
        create: expect.objectContaining({
          licenseId: tenantB.id,
        }),
      })
    );
  });
});
