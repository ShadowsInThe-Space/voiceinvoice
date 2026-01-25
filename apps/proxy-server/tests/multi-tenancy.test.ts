import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pushEntity, pullChanges, SyncQueueEntry } from '../src/services/sync-service';

// Mock getPrismaClient
const mockPrisma = {
  license: {
    findUnique: vi.fn(),
  },
  syncedEntity: {
    upsert: vi.fn(),
    findMany: vi.fn(),
  },
};

vi.mock('../src/services/prisma', () => ({
  getPrismaClient: () => mockPrisma,
}));

describe('Multi-Tenancy Sync Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('pushEntity', () => {
    it('should push entity for valid license', async () => {
      mockPrisma.license.findUnique.mockResolvedValue({ id: 'lic-123' });
      mockPrisma.syncedEntity.upsert.mockResolvedValue({});

      const entry: SyncQueueEntry = {
        id: '1',
        entityType: 'customer',
        entityId: 'cust-1',
        operation: 'CREATE',
        data: { name: 'Test' },
        timestamp: 1000,
      };

      const result = await pushEntity('KEY-123', entry);

      expect(result.success).toBe(true);
      expect(mockPrisma.license.findUnique).toHaveBeenCalledWith({ where: { licenseKey: 'KEY-123' }, select: { id: true } });
      expect(mockPrisma.syncedEntity.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: {
            licenseId_entityType_entityId: {
              licenseId: 'lic-123',
              entityType: 'customer',
              entityId: 'cust-1',
            }
        },
        create: expect.objectContaining({ licenseId: 'lic-123' }),
      }));
    });

    it('should fail if license not found', async () => {
      mockPrisma.license.findUnique.mockResolvedValue(null);

      const entry: SyncQueueEntry = {
        id: '1',
        entityType: 'customer',
        entityId: 'cust-1',
        operation: 'CREATE',
        data: { name: 'Test' },
        timestamp: 1000,
      };

      const result = await pushEntity('INVALID-KEY', entry);

      expect(result.success).toBe(false);
      expect(result.error).toContain('License not found');
      expect(mockPrisma.syncedEntity.upsert).not.toHaveBeenCalled();
    });
  });

  describe('pullChanges', () => {
    it('should only return entities for the specific license', async () => {
      mockPrisma.license.findUnique.mockResolvedValue({ id: 'lic-A' });

      const mockEntities = [
        {
          entityType: 'customer',
          entityId: 'cust-A1',
          data: { name: 'Customer A' },
          updatedAt: new Date('2023-01-01'),
          deleted: false,
        }
      ];
      mockPrisma.syncedEntity.findMany.mockResolvedValue(mockEntities);

      const result = await pullChanges('KEY-A', null);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].entityId).toBe('cust-A1');

      // Verify isolation in query
      expect(mockPrisma.syncedEntity.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          licenseId: 'lic-A'
        })
      }));
    });

    it('should not leak data between tenants', async () => {
      // Simulate Tenant B trying to pull
      mockPrisma.license.findUnique.mockResolvedValue({ id: 'lic-B' });
      mockPrisma.syncedEntity.findMany.mockResolvedValue([]); // No data for B

      const result = await pullChanges('KEY-B', null);

      expect(result.data).toHaveLength(0);
      expect(mockPrisma.syncedEntity.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          licenseId: 'lic-B'
        })
      }));

      // Ensure it didn't query for lic-A
      const callArgs = mockPrisma.syncedEntity.findMany.mock.calls[0][0];
      expect(callArgs.where.licenseId).not.toBe('lic-A');
    });
  });
});
