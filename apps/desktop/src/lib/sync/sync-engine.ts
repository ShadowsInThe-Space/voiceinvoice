/**
 * Sync Engine for background synchronization.
 *
 * Coordinates offline sync between the local SQLite database
 * and the remote PostgreSQL server.
 *
 * @module lib/sync/sync-engine
 */

import { isValidTenantId } from '@voiceinvoice/database/server';
import { SyncQueue, SyncQueueEntry, SyncEntityType } from './sync-queue';
import { ConflictResolver, SyncConflict, ResolvedConflict } from './conflict-resolver';

/**
 * Status of the sync engine.
 */
export type SyncStatus = 'IDLE' | 'SYNCING' | 'ERROR';

/**
 * Connection state to the server.
 */
export type ConnectionState = 'ONLINE' | 'OFFLINE' | 'CHECKING';

/**
 * Result of a sync operation.
 */
export interface SyncResult {
  /** Whether the sync was successful */
  success: boolean;
  /** Number of entries pushed to server */
  pushed: number;
  /** Number of entries pulled from server */
  pulled: number;
  /** Number of conflicts resolved */
  conflicts: number;
  /** Errors that occurred */
  errors: Error[];
  /** Reason for skipping sync (if applicable) */
  skippedReason?: 'OFFLINE' | 'ALREADY_SYNCING' | 'NO_CHANGES';
  /** Timestamp of the sync */
  timestamp: number;
}

/**
 * Progress information for sync operations.
 */
export interface SyncProgress {
  /** Number of pending entries */
  pending: number;
  /** Number of synced entries */
  synced: number;
  /** Number of failed entries */
  failed: number;
  /** Total entries */
  total: number;
}

/**
 * Statistics for the sync engine.
 */
export interface SyncStats {
  /** Total number of sync operations */
  totalSyncs: number;
  /** Number of successful syncs */
  successfulSyncs: number;
  /** Number of failed syncs */
  failedSyncs: number;
  /** Total entries pushed */
  totalPushed: number;
  /** Total entries pulled */
  totalPulled: number;
  /** Total conflicts resolved */
  totalConflicts: number;
}

/**
 * API client interface for sync operations.
 */
export interface SyncApiClient {
  /**
   * Pushes a local change to the server.
   *
   * @param entry - The sync queue entry to push
   * @returns Result of the push operation
   */
  push(entry: SyncQueueEntry): Promise<{ success: boolean; serverData?: Record<string, unknown> }>;

  /**
   * Pulls changes from the server since a given timestamp.
   *
   * @param since - Timestamp to pull changes since
   * @param entityTypes - Optional filter for entity types
   * @returns Server changes and new sync timestamp
   */
  pull(
    since: number | null,
    entityTypes?: SyncEntityType[]
  ): Promise<{
    data: Array<{
      entityType: SyncEntityType;
      entityId: string;
      operation: 'CREATE' | 'UPDATE' | 'DELETE';
      data: Record<string, unknown>;
      serverVersion?: number;
    }>;
    lastSyncTimestamp: number;
  }>;

  /**
   * Checks if the server is reachable.
   *
   * @returns True if server is reachable
   */
  checkConnection(): Promise<boolean>;
}

/**
 * Event handler types.
 */
export type StatusChangeHandler = (status: SyncStatus) => void;
export type ConnectionChangeHandler = (state: ConnectionState) => void;
export type SyncCompleteHandler = (result: SyncResult) => void;
export type ErrorHandler = (error: Error) => void;
export type ConflictHandler = (conflict: SyncConflict, resolution: ResolvedConflict) => void;

/**
 * Options for creating a SyncEngine.
 */
export interface SyncEngineOptions {
  /** The sync queue to use */
  queue: SyncQueue;
  /** The conflict resolver to use */
  resolver: ConflictResolver;
  /** The API client for server communication */
  apiClient: SyncApiClient;
  /** Tenant ID for multi-tenant isolation */
  tenantId: string;
  /** Interval between automatic syncs in milliseconds */
  syncIntervalMs?: number;
  /** Delay before retrying failed operations */
  retryDelayMs?: number;
  /** Maximum number of retries for failed operations */
  maxRetries?: number;
}

/**
 * Sync engine for coordinating offline synchronization.
 *
 * Manages the synchronization of local changes to the server
 * and handles conflicts when they occur.
 *
 * @example
 * const engine = new SyncEngine({
 *   queue: syncQueue,
 *   resolver: conflictResolver,
 *   apiClient: apiClient,
 *   tenantId: 'tenant-123',
 * });
 *
 * engine.onSyncComplete((result) => {
 *   console.log(`Synced ${result.pushed} items`);
 * });
 *
 * engine.start();
 */
export class SyncEngine {
  private readonly queue: SyncQueue;
  private readonly resolver: ConflictResolver;
  private readonly apiClient: SyncApiClient;
  private readonly tenantId: string;
  private readonly syncIntervalMs: number;
  private readonly retryDelayMs: number;
  private readonly maxRetries: number;

  private status: SyncStatus = 'IDLE';
  private connectionState: ConnectionState = 'CHECKING';
  private isEngineRunning = false;
  private syncIntervalId: ReturnType<typeof setInterval> | null = null;
  private lastSyncTimestamp: number | null = null;

  private stats: SyncStats = {
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    totalPushed: 0,
    totalPulled: 0,
    totalConflicts: 0,
  };

  // Event handlers
  private statusChangeHandlers: StatusChangeHandler[] = [];
  private connectionChangeHandlers: ConnectionChangeHandler[] = [];
  private syncCompleteHandlers: SyncCompleteHandler[] = [];
  private errorHandlers: ErrorHandler[] = [];
  private conflictHandlers: ConflictHandler[] = [];

  /**
   * Creates a new SyncEngine.
   *
   * @param options - Configuration options
   * @throws Error if tenantId is invalid
   */
  constructor(options: SyncEngineOptions) {
    if (!isValidTenantId(options.tenantId)) {
      throw new Error(`Invalid tenant ID: "${options.tenantId}"`);
    }

    this.queue = options.queue;
    this.resolver = options.resolver;
    this.apiClient = options.apiClient;
    this.tenantId = options.tenantId;
    this.syncIntervalMs = options.syncIntervalMs ?? 30000;
    this.retryDelayMs = options.retryDelayMs ?? 5000;
    this.maxRetries = options.maxRetries ?? 3;
  }

  /**
   * Gets the current sync status.
   *
   * @returns The current status
   */
  getStatus(): SyncStatus {
    return this.status;
  }

  /**
   * Gets the current connection state.
   *
   * @returns The connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Checks if the engine is running.
   *
   * @returns True if running
   */
  isRunning(): boolean {
    return this.isEngineRunning;
  }

  /**
   * Gets the last sync timestamp.
   *
   * @returns The timestamp, or null if never synced
   */
  getLastSyncTimestamp(): number | null {
    return this.lastSyncTimestamp;
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
   * Gets the maximum number of retries.
   *
   * @returns The maximum retries
   */
  getMaxRetries(): number {
    return this.maxRetries;
  }

  /**
   * Gets the retry delay in milliseconds.
   *
   * @returns The retry delay
   */
  getRetryDelayMs(): number {
    return this.retryDelayMs;
  }

  /**
   * Starts the sync engine.
   *
   * Begins periodic synchronization and connection monitoring.
   */
  start(): void {
    if (this.isEngineRunning) {
      return;
    }

    this.isEngineRunning = true;

    // Start periodic sync
    this.syncIntervalId = setInterval(() => {
      this.checkConnection().then(() => {
        if (this.connectionState === 'ONLINE') {
          this.sync().catch(this.handleError.bind(this));
        }
      });
    }, this.syncIntervalMs);

    // Initial connection check
    this.checkConnection();
  }

  /**
   * Stops the sync engine.
   *
   * Stops periodic synchronization and cleans up resources.
   */
  stop(): void {
    this.isEngineRunning = false;

    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  /**
   * Performs a sync operation.
   *
   * Pushes pending local changes to the server.
   *
   * @returns The sync result
   */
  async sync(): Promise<SyncResult> {
    if (this.status === 'SYNCING') {
      return {
        success: false,
        pushed: 0,
        pulled: 0,
        conflicts: 0,
        errors: [],
        skippedReason: 'ALREADY_SYNCING',
        timestamp: Date.now(),
      };
    }

    // Check connection first
    const isOnline = await this.apiClient.checkConnection();
    if (!isOnline) {
      this.updateConnectionState('OFFLINE');
      return {
        success: false,
        pushed: 0,
        pulled: 0,
        conflicts: 0,
        errors: [],
        skippedReason: 'OFFLINE',
        timestamp: Date.now(),
      };
    }

    this.updateStatus('SYNCING');
    this.stats.totalSyncs++;

    const errors: Error[] = [];
    let pushed = 0;
    const conflicts = 0;

    try {
      const pending = this.queue.getPending();

      for (const entry of pending) {
        try {
          this.queue.updateStatus(entry.id, 'PROCESSING');

          const result = await this.apiClient.push(entry);

          if (result.success) {
            this.queue.updateStatus(entry.id, 'SYNCED');
            this.queue.remove(entry.id);
            pushed++;
          } else {
            this.queue.updateStatus(entry.id, 'FAILED', 'Push failed');
          }
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          errors.push(err);
          this.queue.updateStatus(entry.id, 'FAILED', err.message);
          this.handleError(err);
        }
      }

      const success = errors.length === 0;
      if (success) {
        this.stats.successfulSyncs++;
      } else {
        this.stats.failedSyncs++;
      }
      this.stats.totalPushed += pushed;
      this.stats.totalConflicts += conflicts;

      const result: SyncResult = {
        success,
        pushed,
        pulled: 0,
        conflicts,
        errors,
        timestamp: Date.now(),
      };

      this.notifySyncComplete(result);
      this.updateStatus('IDLE');

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.updateStatus('ERROR');
      this.handleError(err);
      this.stats.failedSyncs++;

      return {
        success: false,
        pushed,
        pulled: 0,
        conflicts,
        errors: [err],
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Pulls changes from the server.
   *
   * @returns The pull result
   */
  async pull(): Promise<SyncResult> {
    if (this.status === 'SYNCING') {
      return {
        success: false,
        pushed: 0,
        pulled: 0,
        conflicts: 0,
        errors: [],
        skippedReason: 'ALREADY_SYNCING',
        timestamp: Date.now(),
      };
    }

    this.updateStatus('SYNCING');

    try {
      const pullResult = await this.apiClient.pull(this.lastSyncTimestamp);

      let pulled = 0;
      let conflicts = 0;
      const errors: Error[] = [];

      for (const serverChange of pullResult.data) {
        // Check for conflicts with pending local changes
        const localPending = this.queue
          .getPending()
          .find(
            (e) => e.entityType === serverChange.entityType && e.entityId === serverChange.entityId
          );

        if (localPending) {
          // Conflict detected
          const conflict: SyncConflict = {
            type: 'UPDATE_UPDATE',
            entityType: serverChange.entityType,
            entityId: serverChange.entityId,
            localData: localPending.data ?? null,
            serverData: serverChange.data,
            detectedAt: new Date(),
          };

          const resolution = this.resolver.resolve(conflict);
          conflicts++;

          // Notify handlers
          for (const handler of this.conflictHandlers) {
            handler(conflict, resolution);
          }
        } else {
          // No conflict, apply server change
          pulled++;
        }
      }

      this.lastSyncTimestamp = pullResult.lastSyncTimestamp;
      this.stats.totalPulled += pulled;
      this.stats.totalConflicts += conflicts;

      const result: SyncResult = {
        success: true,
        pushed: 0,
        pulled,
        conflicts,
        errors,
        timestamp: Date.now(),
      };

      this.updateStatus('IDLE');
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.updateStatus('ERROR');
      this.handleError(err);

      return {
        success: false,
        pushed: 0,
        pulled: 0,
        conflicts: 0,
        errors: [err],
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Checks the connection to the server.
   *
   * @returns True if online
   */
  async checkConnection(): Promise<boolean> {
    const previousState = this.connectionState;
    this.connectionState = 'CHECKING';

    try {
      const isOnline = await this.apiClient.checkConnection();
      const newState: ConnectionState = isOnline ? 'ONLINE' : 'OFFLINE';
      this.updateConnectionState(newState);

      // Trigger sync on reconnection
      if (previousState === 'OFFLINE' && newState === 'ONLINE') {
        this.sync().catch(this.handleError.bind(this));
      }

      return isOnline;
    } catch {
      this.updateConnectionState('OFFLINE');
      return false;
    }
  }

  /**
   * Forces a push of a specific entry.
   *
   * @param entryId - The entry ID to push
   * @returns The result
   * @throws Error if entry not found
   */
  async forcePush(entryId: string): Promise<SyncResult> {
    const entry = this.queue.getById(entryId);
    if (!entry) {
      throw new Error(`Entry not found: ${entryId}`);
    }

    try {
      const result = await this.apiClient.push(entry);

      if (result.success) {
        this.queue.updateStatus(entry.id, 'SYNCED');
        this.queue.remove(entry.id);
        this.stats.totalPushed++;
      }

      return {
        success: result.success,
        pushed: result.success ? 1 : 0,
        pulled: 0,
        conflicts: 0,
        errors: [],
        timestamp: Date.now(),
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        pushed: 0,
        pulled: 0,
        conflicts: 0,
        errors: [err],
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Resets the sync engine state.
   *
   * Clears the queue and resets all statistics.
   */
  reset(): void {
    this.queue.clear();
    this.lastSyncTimestamp = null;
    this.stats = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      totalPushed: 0,
      totalPulled: 0,
      totalConflicts: 0,
    };
  }

  /**
   * Gets the current sync progress.
   *
   * @returns Progress information
   */
  getSyncProgress(): SyncProgress {
    const all = this.queue.getAll();
    const pending = all.filter((e) => e.status === 'PENDING').length;
    const synced = all.filter((e) => e.status === 'SYNCED').length;
    const failed = all.filter((e) => e.status === 'FAILED').length;

    return {
      pending,
      synced,
      failed,
      total: all.length,
    };
  }

  /**
   * Gets sync statistics.
   *
   * @returns The statistics
   */
  getStats(): SyncStats {
    return { ...this.stats };
  }

  /**
   * Registers a status change handler.
   *
   * @param handler - The handler function
   */
  onStatusChange(handler: StatusChangeHandler): void {
    this.statusChangeHandlers.push(handler);
  }

  /**
   * Registers a connection state change handler.
   *
   * @param handler - The handler function
   */
  onConnectionChange(handler: ConnectionChangeHandler): void {
    this.connectionChangeHandlers.push(handler);
  }

  /**
   * Registers a sync complete handler.
   *
   * @param handler - The handler function
   */
  onSyncComplete(handler: SyncCompleteHandler): void {
    this.syncCompleteHandlers.push(handler);
  }

  /**
   * Registers an error handler.
   *
   * @param handler - The handler function
   */
  onError(handler: ErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Registers a conflict handler.
   *
   * @param handler - The handler function
   */
  onConflict(handler: ConflictHandler): void {
    this.conflictHandlers.push(handler);
  }

  /**
   * Updates the sync status and notifies handlers.
   *
   * @param newStatus - The new status
   */
  private updateStatus(newStatus: SyncStatus): void {
    this.status = newStatus;
    for (const handler of this.statusChangeHandlers) {
      handler(newStatus);
    }
  }

  /**
   * Updates the connection state and notifies handlers.
   *
   * @param newState - The new connection state
   */
  private updateConnectionState(newState: ConnectionState): void {
    const previousState = this.connectionState;
    this.connectionState = newState;

    if (previousState !== newState) {
      for (const handler of this.connectionChangeHandlers) {
        handler(newState);
      }
    }
  }

  /**
   * Handles an error by notifying all error handlers.
   *
   * @param error - The error that occurred
   */
  private handleError(error: Error): void {
    for (const handler of this.errorHandlers) {
      handler(error);
    }
  }

  /**
   * Notifies sync complete handlers.
   *
   * @param result - The sync result
   */
  private notifySyncComplete(result: SyncResult): void {
    for (const handler of this.syncCompleteHandlers) {
      handler(result);
    }
  }
}
