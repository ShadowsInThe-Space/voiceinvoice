/**
 * Tests for ConflictResolver.
 *
 * Tests the conflict resolution strategies for offline sync,
 * handling cases where local and server data have diverged.
 *
 * @module tests/sync/conflict-resolver
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictResolver, SyncConflict } from '../../src/lib/sync/conflict-resolver';

describe('ConflictResolver', () => {
  let resolver: ConflictResolver;

  beforeEach(() => {
    resolver = new ConflictResolver();
  });

  describe('constructor', () => {
    it('should create resolver with default strategy', () => {
      expect(resolver.getStrategy()).toBe('LAST_WRITE_WINS');
    });

    it('should create resolver with specified strategy', () => {
      const customResolver = new ConflictResolver({ strategy: 'SERVER_WINS' });
      expect(customResolver.getStrategy()).toBe('SERVER_WINS');
    });

    it('should accept CLIENT_WINS strategy', () => {
      const customResolver = new ConflictResolver({ strategy: 'CLIENT_WINS' });
      expect(customResolver.getStrategy()).toBe('CLIENT_WINS');
    });
  });

  describe('detectConflict', () => {
    it('should detect UPDATE_CONFLICT when both sides modified same entity', () => {
      const conflict = resolver.detectConflict({
        entityType: 'customer',
        entityId: 'cust-1',
        localData: {
          id: 'cust-1',
          name: 'Local Name',
          updatedAt: new Date('2024-01-15T10:00:00Z'),
        },
        serverData: {
          id: 'cust-1',
          name: 'Server Name',
          updatedAt: new Date('2024-01-15T11:00:00Z'),
        },
        baseData: {
          id: 'cust-1',
          name: 'Original Name',
          updatedAt: new Date('2024-01-14T10:00:00Z'),
        },
      });

      expect(conflict).not.toBeNull();
      expect(conflict?.type).toBe('UPDATE_UPDATE');
    });

    it('should detect DELETE_UPDATE conflict', () => {
      const conflict = resolver.detectConflict({
        entityType: 'customer',
        entityId: 'cust-1',
        localData: null, // Deleted locally
        serverData: {
          id: 'cust-1',
          name: 'Updated on Server',
          updatedAt: new Date('2024-01-15T11:00:00Z'),
        },
        baseData: {
          id: 'cust-1',
          name: 'Original',
          updatedAt: new Date('2024-01-14T10:00:00Z'),
        },
      });

      expect(conflict?.type).toBe('DELETE_UPDATE');
    });

    it('should detect UPDATE_DELETE conflict', () => {
      const conflict = resolver.detectConflict({
        entityType: 'customer',
        entityId: 'cust-1',
        localData: {
          id: 'cust-1',
          name: 'Updated Locally',
          updatedAt: new Date('2024-01-15T10:00:00Z'),
        },
        serverData: null, // Deleted on server
        baseData: {
          id: 'cust-1',
          name: 'Original',
          updatedAt: new Date('2024-01-14T10:00:00Z'),
        },
      });

      expect(conflict?.type).toBe('UPDATE_DELETE');
    });

    it('should return null when no conflict exists', () => {
      const conflict = resolver.detectConflict({
        entityType: 'customer',
        entityId: 'cust-1',
        localData: {
          id: 'cust-1',
          name: 'Local Name',
          updatedAt: new Date('2024-01-15T10:00:00Z'),
        },
        serverData: {
          id: 'cust-1',
          name: 'Local Name', // Same as local
          updatedAt: new Date('2024-01-15T10:00:00Z'),
        },
        baseData: {
          id: 'cust-1',
          name: 'Original',
          updatedAt: new Date('2024-01-14T10:00:00Z'),
        },
      });

      expect(conflict).toBeNull();
    });

    it('should detect CREATE_CREATE conflict (rare edge case)', () => {
      const conflict = resolver.detectConflict({
        entityType: 'customer',
        entityId: 'cust-1',
        localData: {
          id: 'cust-1',
          name: 'Created Locally',
          createdAt: new Date('2024-01-15T10:00:00Z'),
        },
        serverData: {
          id: 'cust-1',
          name: 'Created on Server',
          createdAt: new Date('2024-01-15T10:00:00Z'),
        },
        baseData: null, // No base = both created
      });

      expect(conflict?.type).toBe('CREATE_CREATE');
    });
  });

  describe('resolve with LAST_WRITE_WINS', () => {
    beforeEach(() => {
      resolver = new ConflictResolver({ strategy: 'LAST_WRITE_WINS' });
    });

    it('should choose server when server has later timestamp', () => {
      const conflict: SyncConflict = {
        type: 'UPDATE_UPDATE',
        entityType: 'customer',
        entityId: 'cust-1',
        localData: {
          id: 'cust-1',
          name: 'Local',
          updatedAt: new Date('2024-01-15T10:00:00Z'),
        },
        serverData: {
          id: 'cust-1',
          name: 'Server',
          updatedAt: new Date('2024-01-15T12:00:00Z'),
        },
        detectedAt: new Date(),
      };

      const resolved = resolver.resolve(conflict);

      expect(resolved.winner).toBe('SERVER');
      expect(resolved.resolvedData).toEqual(conflict.serverData);
    });

    it('should choose local when local has later timestamp', () => {
      const conflict: SyncConflict = {
        type: 'UPDATE_UPDATE',
        entityType: 'customer',
        entityId: 'cust-1',
        localData: {
          id: 'cust-1',
          name: 'Local',
          updatedAt: new Date('2024-01-15T14:00:00Z'),
        },
        serverData: {
          id: 'cust-1',
          name: 'Server',
          updatedAt: new Date('2024-01-15T12:00:00Z'),
        },
        detectedAt: new Date(),
      };

      const resolved = resolver.resolve(conflict);

      expect(resolved.winner).toBe('LOCAL');
      expect(resolved.resolvedData).toEqual(conflict.localData);
    });
  });

  describe('resolve with SERVER_WINS', () => {
    beforeEach(() => {
      resolver = new ConflictResolver({ strategy: 'SERVER_WINS' });
    });

    it('should always choose server regardless of timestamp', () => {
      const conflict: SyncConflict = {
        type: 'UPDATE_UPDATE',
        entityType: 'customer',
        entityId: 'cust-1',
        localData: {
          id: 'cust-1',
          name: 'Local',
          updatedAt: new Date('2024-01-15T14:00:00Z'), // Later
        },
        serverData: {
          id: 'cust-1',
          name: 'Server',
          updatedAt: new Date('2024-01-15T10:00:00Z'), // Earlier
        },
        detectedAt: new Date(),
      };

      const resolved = resolver.resolve(conflict);

      expect(resolved.winner).toBe('SERVER');
      expect(resolved.resolvedData).toEqual(conflict.serverData);
    });
  });

  describe('resolve with CLIENT_WINS', () => {
    beforeEach(() => {
      resolver = new ConflictResolver({ strategy: 'CLIENT_WINS' });
    });

    it('should always choose local regardless of timestamp', () => {
      const conflict: SyncConflict = {
        type: 'UPDATE_UPDATE',
        entityType: 'customer',
        entityId: 'cust-1',
        localData: {
          id: 'cust-1',
          name: 'Local',
          updatedAt: new Date('2024-01-15T10:00:00Z'), // Earlier
        },
        serverData: {
          id: 'cust-1',
          name: 'Server',
          updatedAt: new Date('2024-01-15T14:00:00Z'), // Later
        },
        detectedAt: new Date(),
      };

      const resolved = resolver.resolve(conflict);

      expect(resolved.winner).toBe('LOCAL');
      expect(resolved.resolvedData).toEqual(conflict.localData);
    });
  });

  describe('resolve with MERGE strategy', () => {
    beforeEach(() => {
      resolver = new ConflictResolver({ strategy: 'MERGE' });
    });

    it('should merge non-conflicting field changes', () => {
      const conflict: SyncConflict = {
        type: 'UPDATE_UPDATE',
        entityType: 'customer',
        entityId: 'cust-1',
        localData: {
          id: 'cust-1',
          name: 'Original',
          email: 'local@email.de', // Changed locally
          updatedAt: new Date('2024-01-15T10:00:00Z'),
        },
        serverData: {
          id: 'cust-1',
          name: 'Server Name', // Changed on server
          email: 'original@email.de',
          updatedAt: new Date('2024-01-15T11:00:00Z'),
        },
        baseData: {
          id: 'cust-1',
          name: 'Original',
          email: 'original@email.de',
          updatedAt: new Date('2024-01-14T10:00:00Z'),
        },
        detectedAt: new Date(),
      };

      const resolved = resolver.resolve(conflict);

      expect(resolved.winner).toBe('MERGED');
      expect(resolved.resolvedData).toEqual({
        id: 'cust-1',
        name: 'Server Name', // From server (later timestamp)
        email: 'local@email.de', // From local (changed locally)
        updatedAt: expect.any(Date),
      });
    });

    it('should use LAST_WRITE_WINS for same field conflicts during merge', () => {
      const conflict: SyncConflict = {
        type: 'UPDATE_UPDATE',
        entityType: 'customer',
        entityId: 'cust-1',
        localData: {
          id: 'cust-1',
          name: 'Local Name', // Both changed name
          updatedAt: new Date('2024-01-15T10:00:00Z'),
        },
        serverData: {
          id: 'cust-1',
          name: 'Server Name', // Both changed name
          updatedAt: new Date('2024-01-15T12:00:00Z'), // Server is later
        },
        baseData: {
          id: 'cust-1',
          name: 'Original',
          updatedAt: new Date('2024-01-14T10:00:00Z'),
        },
        detectedAt: new Date(),
      };

      const resolved = resolver.resolve(conflict);

      expect(resolved.resolvedData.name).toBe('Server Name'); // Later wins
    });
  });

  describe('resolve DELETE conflicts', () => {
    it('should handle DELETE_UPDATE by preferring the update (data preservation)', () => {
      resolver = new ConflictResolver({ strategy: 'LAST_WRITE_WINS' });

      const conflict: SyncConflict = {
        type: 'DELETE_UPDATE',
        entityType: 'customer',
        entityId: 'cust-1',
        localData: null,
        serverData: {
          id: 'cust-1',
          name: 'Updated on Server',
          updatedAt: new Date('2024-01-15T12:00:00Z'),
        },
        detectedAt: new Date(),
      };

      const resolved = resolver.resolve(conflict);

      // Server update should win to preserve data
      expect(resolved.winner).toBe('SERVER');
      expect(resolved.action).toBe('RESTORE_AND_UPDATE');
    });

    it('should handle UPDATE_DELETE with SERVER_WINS', () => {
      resolver = new ConflictResolver({ strategy: 'SERVER_WINS' });

      const conflict: SyncConflict = {
        type: 'UPDATE_DELETE',
        entityType: 'customer',
        entityId: 'cust-1',
        localData: {
          id: 'cust-1',
          name: 'Updated Locally',
          updatedAt: new Date('2024-01-15T10:00:00Z'),
        },
        serverData: null,
        detectedAt: new Date(),
      };

      const resolved = resolver.resolve(conflict);

      expect(resolved.winner).toBe('SERVER');
      expect(resolved.action).toBe('DELETE_LOCAL');
    });
  });

  describe('setCustomResolver', () => {
    it('should use custom resolver function', () => {
      const customFn = vi.fn().mockReturnValue({
        winner: 'LOCAL' as const,
        resolvedData: { id: 'cust-1', name: 'Custom Resolved' },
        action: 'UPDATE_LOCAL' as const,
      });

      resolver.setCustomResolver('customer', customFn);

      const conflict: SyncConflict = {
        type: 'UPDATE_UPDATE',
        entityType: 'customer',
        entityId: 'cust-1',
        localData: { id: 'cust-1', name: 'Local' },
        serverData: { id: 'cust-1', name: 'Server' },
        detectedAt: new Date(),
      };

      const resolved = resolver.resolve(conflict);

      expect(customFn).toHaveBeenCalledWith(conflict);
      expect(resolved.resolvedData.name).toBe('Custom Resolved');
    });

    it('should fall back to default strategy when no custom resolver', () => {
      resolver.setCustomResolver('invoice', vi.fn());

      const conflict: SyncConflict = {
        type: 'UPDATE_UPDATE',
        entityType: 'customer', // Different entity type
        entityId: 'cust-1',
        localData: {
          id: 'cust-1',
          name: 'Local',
          updatedAt: new Date('2024-01-15T14:00:00Z'),
        },
        serverData: {
          id: 'cust-1',
          name: 'Server',
          updatedAt: new Date('2024-01-15T10:00:00Z'),
        },
        detectedAt: new Date(),
      };

      const resolved = resolver.resolve(conflict);

      expect(resolved.winner).toBe('LOCAL'); // LAST_WRITE_WINS default
    });
  });

  describe('createConflictReport', () => {
    it('should generate a human-readable conflict report', () => {
      const conflict: SyncConflict = {
        type: 'UPDATE_UPDATE',
        entityType: 'customer',
        entityId: 'cust-1',
        localData: { id: 'cust-1', name: 'Local' },
        serverData: { id: 'cust-1', name: 'Server' },
        detectedAt: new Date('2024-01-15T12:00:00Z'),
      };

      const report = resolver.createConflictReport(conflict);

      expect(report).toContain('customer');
      expect(report).toContain('cust-1');
      expect(report).toContain('UPDATE_UPDATE');
    });
  });

  describe('getConflictHistory', () => {
    it('should track resolved conflicts', () => {
      const conflict: SyncConflict = {
        type: 'UPDATE_UPDATE',
        entityType: 'customer',
        entityId: 'cust-1',
        localData: { id: 'cust-1', name: 'Local', updatedAt: new Date() },
        serverData: { id: 'cust-1', name: 'Server', updatedAt: new Date() },
        detectedAt: new Date(),
      };

      resolver.resolve(conflict);

      const history = resolver.getConflictHistory();

      expect(history).toHaveLength(1);
      expect(history[0].conflict).toEqual(conflict);
      expect(history[0].resolution).toBeDefined();
    });

    it('should limit history size', () => {
      resolver = new ConflictResolver({ maxHistorySize: 5 });

      for (let i = 0; i < 10; i++) {
        resolver.resolve({
          type: 'UPDATE_UPDATE',
          entityType: 'customer',
          entityId: `cust-${i}`,
          localData: { id: `cust-${i}`, updatedAt: new Date() },
          serverData: { id: `cust-${i}`, updatedAt: new Date() },
          detectedAt: new Date(),
        });
      }

      const history = resolver.getConflictHistory();

      expect(history).toHaveLength(5);
      expect(history[0].conflict.entityId).toBe('cust-5'); // Oldest kept
    });
  });
});
