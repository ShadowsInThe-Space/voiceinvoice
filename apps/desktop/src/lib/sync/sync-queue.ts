/**
 * Sync Queue for offline change tracking.
 *
 * Manages a persistent queue of local changes that need to be
 * synchronized with the PostgreSQL server when online.
 *
 * @module lib/sync/sync-queue
 */

import { isValidTenantId } from '@voiceinvoice/database/server';

/**
 * Supported sync operations.
 */
export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';

/**
 * Entity types that can be synced.
 */
export type SyncEntityType =
  | 'customer'
  | 'invoice'
  | 'invoiceItem'
  | 'recording'
  | 'category'
  | 'bankTransaction'
  | 'appSettings';

/**
 * Status of a sync queue entry.
 */
export type SyncEntryStatus = 'PENDING' | 'PROCESSING' | 'SYNCED' | 'FAILED';

/**
 * A single entry in the sync queue.
 */
export interface SyncQueueEntry {
  /** Unique identifier for this queue entry */
  id: string;
  /** Tenant ID for multi-tenant isolation */
  tenantId: string;
  /** Type of entity being synced */
  entityType: SyncEntityType;
  /** ID of the entity being synced */
  entityId: string;
  /** Operation to perform */
  operation: SyncOperation;
  /** Data for CREATE/UPDATE operations */
  data?: Record<string, unknown> | undefined;
  /** Previous data for UPDATE operations (for conflict resolution) */
  previousData?: Record<string, unknown> | undefined;
  /** Timestamp when the entry was created */
  timestamp: number;
  /** Number of retry attempts */
  retryCount: number;
  /** Current status */
  status: SyncEntryStatus;
  /** Error message if status is FAILED */
  errorMessage?: string | undefined;
}

/**
 * Input for enqueueing a new sync operation.
 */
export interface EnqueueInput {
  /** Type of entity being synced */
  entityType: SyncEntityType;
  /** ID of the entity being synced */
  entityId: string;
  /** Operation to perform */
  operation: SyncOperation;
  /** Data for CREATE/UPDATE operations */
  data?: Record<string, unknown>;
  /** Previous data for UPDATE operations */
  previousData?: Record<string, unknown>;
}

/**
 * Storage interface for persisting the queue.
 */
export interface SyncQueueStorage {
  /** Get item from storage */
  getItem(key: string): string | null;
  /** Set item in storage */
  setItem(key: string, value: string): void;
  /** Remove item from storage */
  removeItem(key: string): void;
}

/**
 * Options for creating a SyncQueue.
 */
export interface SyncQueueOptions {
  /** Tenant ID for multi-tenant isolation */
  tenantId: string;
  /** Storage backend for persistence (defaults to localStorage if available) */
  storage?: SyncQueueStorage;
}

/**
 * Generates a unique ID for queue entries.
 *
 * @returns A unique string ID
 */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `sync_${timestamp}_${random}`;
}

/**
 * Default storage using localStorage (browser) or Map (Node.js).
 */
function createDefaultStorage(): SyncQueueStorage {
  if (typeof localStorage !== 'undefined') {
    return {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => localStorage.setItem(key, value),
      removeItem: (key) => localStorage.removeItem(key),
    };
  }

  // Fallback for Node.js environment
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  };
}

/**
 * Sync queue for tracking offline changes.
 *
 * This queue persists local changes that occur while offline,
 * allowing them to be synchronized when the connection is restored.
 *
 * @example
 * const queue = new SyncQueue({ tenantId: 'tenant-123' });
 *
 * // Add a change to the queue
 * queue.enqueue({
 *   entityType: 'customer',
 *   entityId: 'cust-1',
 *   operation: 'CREATE',
 *   data: { name: 'Acme Corp' },
 * });
 *
 * // Process pending entries
 * while (!queue.isEmpty()) {
 *   const entry = queue.dequeue();
 *   await syncToServer(entry);
 * }
 */
export class SyncQueue {
  private readonly tenantId: string;
  private readonly storage: SyncQueueStorage;
  private readonly storageKey: string;
  private entries: SyncQueueEntry[];

  /**
   * Creates a new SyncQueue.
   *
   * @param options - Configuration options
   * @throws Error if tenantId is invalid
   *
   * @example
   * const queue = new SyncQueue({
   *   tenantId: 'org-abc-123',
   *   storage: customStorage,
   * });
   */
  constructor(options: SyncQueueOptions) {
    if (!isValidTenantId(options.tenantId)) {
      throw new Error(`Invalid tenant ID: "${options.tenantId}"`);
    }

    this.tenantId = options.tenantId;
    this.storage = options.storage ?? createDefaultStorage();
    this.storageKey = `sync_queue_${this.tenantId}`;
    this.entries = this.loadFromStorage();
  }

  /**
   * Gets the tenant ID.
   *
   * @returns The tenant ID
   */
  getTenantId(): string {
    return this.tenantId;
  }

  /**
   * Adds a new entry to the sync queue.
   *
   * @param input - The entry to add
   * @returns The created queue entry
   *
   * @example
   * const entry = queue.enqueue({
   *   entityType: 'invoice',
   *   entityId: 'inv-1',
   *   operation: 'UPDATE',
   *   data: { status: 'SENT' },
   * });
   */
  enqueue(input: EnqueueInput): SyncQueueEntry {
    // Check for merge opportunity (consecutive UPDATEs on same entity)
    if (input.operation === 'UPDATE') {
      const existingIndex = this.entries.findIndex(
        (e) =>
          e.entityType === input.entityType &&
          e.entityId === input.entityId &&
          e.operation === 'UPDATE' &&
          e.status === 'PENDING'
      );

      if (existingIndex !== -1) {
        // Merge the updates
        const existing = this.entries[existingIndex];
        existing.data = { ...existing.data, ...input.data };
        existing.timestamp = Date.now();
        this.persist();
        return existing;
      }
    }

    const entry: SyncQueueEntry = {
      id: generateId(),
      tenantId: this.tenantId,
      entityType: input.entityType,
      entityId: input.entityId,
      operation: input.operation,
      data: input.data,
      previousData: input.previousData,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'PENDING',
    };

    this.entries.push(entry);
    this.persist();
    return entry;
  }

  /**
   * Removes and returns the oldest pending entry.
   *
   * @returns The oldest pending entry, or null if none
   *
   * @example
   * const entry = queue.dequeue();
   * if (entry) {
   *   await processEntry(entry);
   * }
   */
  dequeue(): SyncQueueEntry | null {
    const index = this.entries.findIndex((e) => e.status === 'PENDING');
    if (index === -1) {
      return null;
    }

    const entry = this.entries.splice(index, 1)[0];
    this.persist();
    return entry;
  }

  /**
   * Returns the oldest pending entry without removing it.
   *
   * @returns The oldest pending entry, or null if none
   */
  peek(): SyncQueueEntry | null {
    return this.entries.find((e) => e.status === 'PENDING') ?? null;
  }

  /**
   * Gets an entry by ID.
   *
   * @param id - The entry ID
   * @returns The entry, or null if not found
   */
  getById(id: string): SyncQueueEntry | null {
    return this.entries.find((e) => e.id === id) ?? null;
  }

  /**
   * Gets all entries in the queue.
   *
   * @returns All queue entries
   */
  getAll(): SyncQueueEntry[] {
    return [...this.entries];
  }

  /**
   * Gets all entries for a specific entity type.
   *
   * @param entityType - The entity type to filter by
   * @returns Entries matching the entity type
   */
  getByEntity(entityType: SyncEntityType): SyncQueueEntry[] {
    return this.entries.filter((e) => e.entityType === entityType);
  }

  /**
   * Gets all pending entries.
   *
   * @returns All entries with PENDING status
   */
  getPending(): SyncQueueEntry[] {
    return this.entries.filter((e) => e.status === 'PENDING');
  }

  /**
   * Gets all failed entries.
   *
   * @returns All entries with FAILED status
   */
  getFailed(): SyncQueueEntry[] {
    return this.entries.filter((e) => e.status === 'FAILED');
  }

  /**
   * Gets failed entries that can be retried.
   *
   * @param maxRetries - Maximum number of retries allowed
   * @returns Failed entries within retry limit
   */
  getRetryable(maxRetries: number): SyncQueueEntry[] {
    return this.entries.filter(
      (e) => e.status === 'FAILED' && e.retryCount < maxRetries
    );
  }

  /**
   * Updates the status of an entry.
   *
   * @param id - The entry ID
   * @param status - The new status
   * @param errorMessage - Optional error message for FAILED status
   * @throws Error if entry not found
   *
   * @example
   * queue.updateStatus(entry.id, 'SYNCED');
   * queue.updateStatus(entry.id, 'FAILED', 'Network timeout');
   */
  updateStatus(id: string, status: SyncEntryStatus, errorMessage?: string): void {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) {
      throw new Error(`Entry not found: ${id}`);
    }

    // Increment retry count when moving from FAILED to PENDING
    if (entry.status === 'FAILED' && status === 'PENDING') {
      entry.retryCount++;
    }

    entry.status = status;
    entry.errorMessage = status === 'FAILED' ? errorMessage : undefined;
    this.persist();
  }

  /**
   * Removes an entry from the queue.
   *
   * @param id - The entry ID to remove
   */
  remove(id: string): void {
    const index = this.entries.findIndex((e) => e.id === id);
    if (index !== -1) {
      this.entries.splice(index, 1);
      this.persist();
    }
  }

  /**
   * Clears all entries from the queue.
   */
  clear(): void {
    this.entries = [];
    this.persist();
  }

  /**
   * Gets the number of entries in the queue.
   *
   * @returns The queue size
   */
  size(): number {
    return this.entries.length;
  }

  /**
   * Checks if the queue is empty.
   *
   * @returns True if queue has no entries
   */
  isEmpty(): boolean {
    return this.entries.length === 0;
  }

  /**
   * Checks for potential conflicts with a new operation.
   *
   * @param entityType - The entity type
   * @param entityId - The entity ID
   * @param operation - The proposed operation
   * @returns True if there's a conflict
   *
   * @example
   * if (queue.hasConflicts('customer', 'cust-1', 'UPDATE')) {
   *   console.warn('Conflict detected');
   * }
   */
  hasConflicts(
    entityType: SyncEntityType,
    entityId: string,
    operation: SyncOperation
  ): boolean {
    const existingOps = this.entries.filter(
      (e) =>
        e.entityType === entityType && e.entityId === entityId && e.status === 'PENDING'
    );

    if (existingOps.length === 0) {
      return false;
    }

    // Check for conflicting operations
    for (const existing of existingOps) {
      // UPDATE after DELETE is a conflict
      if (existing.operation === 'DELETE' && operation === 'UPDATE') {
        return true;
      }
      // CREATE after DELETE of same entity is a conflict (rare edge case)
      if (existing.operation === 'DELETE' && operation === 'CREATE') {
        return true;
      }
    }

    return false;
  }

  /**
   * Loads the queue from storage.
   *
   * @returns The loaded entries, or empty array if none
   */
  private loadFromStorage(): SyncQueueEntry[] {
    try {
      const data = this.storage.getItem(this.storageKey);
      if (!data) {
        return [];
      }
      return JSON.parse(data) as SyncQueueEntry[];
    } catch {
      return [];
    }
  }

  /**
   * Persists the queue to storage.
   */
  private persist(): void {
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(this.entries));
    } catch (error) {
      console.error('Failed to persist sync queue:', error);
    }
  }
}
