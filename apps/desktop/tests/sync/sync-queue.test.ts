/**
 * Tests for SyncQueue.
 *
 * Tests the offline sync queue functionality for tracking
 * local changes that need to be synchronized to the server.
 *
 * @module tests/sync/sync-queue
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SyncQueue, SyncQueueEntry } from '../../src/lib/sync/sync-queue';

describe('SyncQueue', () => {
  let queue: SyncQueue;
  const mockStorage = new Map<string, string>();

  const createMockStorage = () => ({
    getItem: vi.fn((key: string) => mockStorage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => mockStorage.set(key, value)),
    removeItem: vi.fn((key: string) => mockStorage.delete(key)),
  });

  beforeEach(() => {
    mockStorage.clear();
    queue = new SyncQueue({
      storage: createMockStorage(),
      tenantId: 'tenant-123',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a SyncQueue with default options', () => {
      const defaultQueue = new SyncQueue({ tenantId: 'tenant-abc' });

      expect(defaultQueue).toBeDefined();
      expect(defaultQueue.getTenantId()).toBe('tenant-abc');
    });

    it('should throw error for invalid tenantId', () => {
      expect(() => new SyncQueue({ tenantId: '' })).toThrow('Invalid tenant ID');
    });

    it('should load existing queue from storage', () => {
      const existingEntries: SyncQueueEntry[] = [
        {
          id: 'entry-1',
          tenantId: 'tenant-123',
          entityType: 'customer',
          entityId: 'cust-1',
          operation: 'CREATE',
          data: { name: 'Test' },
          timestamp: Date.now(),
          retryCount: 0,
          status: 'PENDING',
        },
      ];
      mockStorage.set('sync_queue_tenant-123', JSON.stringify(existingEntries));

      const loadedQueue = new SyncQueue({
        storage: createMockStorage(),
        tenantId: 'tenant-123',
      });

      expect(loadedQueue.size()).toBe(1);
    });
  });

  describe('enqueue', () => {
    it('should add a CREATE operation to the queue', () => {
      const entry = queue.enqueue({
        entityType: 'customer',
        entityId: 'cust-1',
        operation: 'CREATE',
        data: { name: 'Acme Corp', email: 'info@acme.de' },
      });

      expect(entry.id).toBeDefined();
      expect(entry.tenantId).toBe('tenant-123');
      expect(entry.operation).toBe('CREATE');
      expect(entry.status).toBe('PENDING');
      expect(queue.size()).toBe(1);
    });

    it('should add an UPDATE operation to the queue', () => {
      const entry = queue.enqueue({
        entityType: 'invoice',
        entityId: 'inv-1',
        operation: 'UPDATE',
        data: { status: 'SENT' },
        previousData: { status: 'DRAFT' },
      });

      expect(entry.operation).toBe('UPDATE');
      expect(entry.previousData).toEqual({ status: 'DRAFT' });
    });

    it('should add a DELETE operation to the queue', () => {
      const entry = queue.enqueue({
        entityType: 'customer',
        entityId: 'cust-2',
        operation: 'DELETE',
      });

      expect(entry.operation).toBe('DELETE');
      expect(entry.data).toBeUndefined();
    });

    it('should persist queue to storage after enqueue', () => {
      const storage = createMockStorage();
      const persistQueue = new SyncQueue({ storage, tenantId: 'tenant-123' });

      persistQueue.enqueue({
        entityType: 'customer',
        entityId: 'cust-1',
        operation: 'CREATE',
        data: { name: 'Test' },
      });

      expect(storage.setItem).toHaveBeenCalledWith(
        'sync_queue_tenant-123',
        expect.any(String)
      );
    });

    it('should merge consecutive UPDATE operations for same entity', () => {
      queue.enqueue({
        entityType: 'customer',
        entityId: 'cust-1',
        operation: 'UPDATE',
        data: { name: 'New Name' },
      });

      queue.enqueue({
        entityType: 'customer',
        entityId: 'cust-1',
        operation: 'UPDATE',
        data: { email: 'new@email.de' },
      });

      expect(queue.size()).toBe(1);
      const entries = queue.getAll();
      expect(entries[0].data).toEqual({ name: 'New Name', email: 'new@email.de' });
    });

    it('should not merge operations for different entities', () => {
      queue.enqueue({
        entityType: 'customer',
        entityId: 'cust-1',
        operation: 'UPDATE',
        data: { name: 'Name 1' },
      });

      queue.enqueue({
        entityType: 'customer',
        entityId: 'cust-2',
        operation: 'UPDATE',
        data: { name: 'Name 2' },
      });

      expect(queue.size()).toBe(2);
    });
  });

  describe('dequeue', () => {
    it('should return and remove the oldest pending entry', () => {
      queue.enqueue({
        entityType: 'customer',
        entityId: 'cust-1',
        operation: 'CREATE',
        data: { name: 'First' },
      });

      queue.enqueue({
        entityType: 'customer',
        entityId: 'cust-2',
        operation: 'CREATE',
        data: { name: 'Second' },
      });

      const entry = queue.dequeue();

      expect(entry?.entityId).toBe('cust-1');
      expect(queue.size()).toBe(1);
    });

    it('should return null when queue is empty', () => {
      const entry = queue.dequeue();

      expect(entry).toBeNull();
    });

    it('should skip entries with status other than PENDING', () => {
      queue.enqueue({
        entityType: 'customer',
        entityId: 'cust-1',
        operation: 'CREATE',
        data: { name: 'First' },
      });

      const firstEntry = queue.peek();
      if (firstEntry) {
        queue.updateStatus(firstEntry.id, 'PROCESSING');
      }

      queue.enqueue({
        entityType: 'customer',
        entityId: 'cust-2',
        operation: 'CREATE',
        data: { name: 'Second' },
      });

      const entry = queue.dequeue();

      expect(entry?.entityId).toBe('cust-2');
    });
  });

  describe('peek', () => {
    it('should return the oldest entry without removing it', () => {
      queue.enqueue({
        entityType: 'customer',
        entityId: 'cust-1',
        operation: 'CREATE',
        data: { name: 'Test' },
      });

      const entry1 = queue.peek();
      const entry2 = queue.peek();

      expect(entry1).toEqual(entry2);
      expect(queue.size()).toBe(1);
    });

    it('should return null when queue is empty', () => {
      expect(queue.peek()).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('should update the status of an entry', () => {
      const entry = queue.enqueue({
        entityType: 'customer',
        entityId: 'cust-1',
        operation: 'CREATE',
        data: { name: 'Test' },
      });

      queue.updateStatus(entry.id, 'SYNCED');

      const updated = queue.getById(entry.id);
      expect(updated?.status).toBe('SYNCED');
    });

    it('should update error message when status is FAILED', () => {
      const entry = queue.enqueue({
        entityType: 'customer',
        entityId: 'cust-1',
        operation: 'CREATE',
        data: { name: 'Test' },
      });

      queue.updateStatus(entry.id, 'FAILED', 'Network error');

      const updated = queue.getById(entry.id);
      expect(updated?.status).toBe('FAILED');
      expect(updated?.errorMessage).toBe('Network error');
    });

    it('should increment retryCount when status changes from FAILED to PENDING', () => {
      const entry = queue.enqueue({
        entityType: 'customer',
        entityId: 'cust-1',
        operation: 'CREATE',
        data: { name: 'Test' },
      });

      queue.updateStatus(entry.id, 'FAILED', 'Error');
      queue.updateStatus(entry.id, 'PENDING');

      const updated = queue.getById(entry.id);
      expect(updated?.retryCount).toBe(1);
    });

    it('should throw error for non-existent entry', () => {
      expect(() => queue.updateStatus('non-existent', 'SYNCED')).toThrow(
        'Entry not found'
      );
    });
  });

  describe('remove', () => {
    it('should remove an entry by ID', () => {
      const entry = queue.enqueue({
        entityType: 'customer',
        entityId: 'cust-1',
        operation: 'CREATE',
        data: { name: 'Test' },
      });

      queue.remove(entry.id);

      expect(queue.size()).toBe(0);
      expect(queue.getById(entry.id)).toBeNull();
    });

    it('should not throw for non-existent entry', () => {
      expect(() => queue.remove('non-existent')).not.toThrow();
    });
  });

  describe('getByEntity', () => {
    it('should return all entries for a specific entity', () => {
      queue.enqueue({
        entityType: 'customer',
        entityId: 'cust-1',
        operation: 'CREATE',
        data: { name: 'Test' },
      });

      queue.enqueue({
        entityType: 'invoice',
        entityId: 'inv-1',
        operation: 'CREATE',
        data: { number: 'INV-001' },
      });

      const customerEntries = queue.getByEntity('customer');

      expect(customerEntries).toHaveLength(1);
      expect(customerEntries[0].entityType).toBe('customer');
    });
  });

  describe('clear', () => {
    it('should remove all entries from the queue', () => {
      queue.enqueue({
        entityType: 'customer',
        entityId: 'cust-1',
        operation: 'CREATE',
        data: { name: 'Test 1' },
      });

      queue.enqueue({
        entityType: 'customer',
        entityId: 'cust-2',
        operation: 'CREATE',
        data: { name: 'Test 2' },
      });

      queue.clear();

      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
    });
  });

  describe('getPending', () => {
    it('should return only PENDING entries', () => {
      const entry1 = queue.enqueue({
        entityType: 'customer',
        entityId: 'cust-1',
        operation: 'CREATE',
        data: { name: 'Test 1' },
      });

      queue.enqueue({
        entityType: 'customer',
        entityId: 'cust-2',
        operation: 'CREATE',
        data: { name: 'Test 2' },
      });

      queue.updateStatus(entry1.id, 'SYNCED');

      const pending = queue.getPending();

      expect(pending).toHaveLength(1);
      expect(pending[0].entityId).toBe('cust-2');
    });
  });

  describe('getFailed', () => {
    it('should return only FAILED entries', () => {
      const entry1 = queue.enqueue({
        entityType: 'customer',
        entityId: 'cust-1',
        operation: 'CREATE',
        data: { name: 'Test 1' },
      });

      queue.enqueue({
        entityType: 'customer',
        entityId: 'cust-2',
        operation: 'CREATE',
        data: { name: 'Test 2' },
      });

      queue.updateStatus(entry1.id, 'FAILED', 'Network error');

      const failed = queue.getFailed();

      expect(failed).toHaveLength(1);
      expect(failed[0].errorMessage).toBe('Network error');
    });
  });

  describe('getRetryable', () => {
    it('should return FAILED entries within retry limit', () => {
      const entry = queue.enqueue({
        entityType: 'customer',
        entityId: 'cust-1',
        operation: 'CREATE',
        data: { name: 'Test' },
      });

      queue.updateStatus(entry.id, 'FAILED', 'Error');

      const retryable = queue.getRetryable(3);

      expect(retryable).toHaveLength(1);
    });

    it('should not return entries exceeding retry limit', () => {
      const entry = queue.enqueue({
        entityType: 'customer',
        entityId: 'cust-1',
        operation: 'CREATE',
        data: { name: 'Test' },
      });

      // Simulate multiple retries
      for (let i = 0; i < 4; i++) {
        queue.updateStatus(entry.id, 'FAILED', 'Error');
        if (i < 3) {
          queue.updateStatus(entry.id, 'PENDING');
        }
      }

      const retryable = queue.getRetryable(3);

      expect(retryable).toHaveLength(0);
    });
  });

  describe('hasConflicts', () => {
    it('should detect DELETE after CREATE for same entity', () => {
      queue.enqueue({
        entityType: 'customer',
        entityId: 'cust-1',
        operation: 'CREATE',
        data: { name: 'Test' },
      });

      const hasConflict = queue.hasConflicts('customer', 'cust-1', 'DELETE');

      expect(hasConflict).toBe(false); // CREATE then DELETE = DELETE wins, no conflict
    });

    it('should detect UPDATE after DELETE for same entity', () => {
      queue.enqueue({
        entityType: 'customer',
        entityId: 'cust-1',
        operation: 'DELETE',
      });

      const hasConflict = queue.hasConflicts('customer', 'cust-1', 'UPDATE');

      expect(hasConflict).toBe(true); // Cannot UPDATE deleted entity
    });
  });
});
