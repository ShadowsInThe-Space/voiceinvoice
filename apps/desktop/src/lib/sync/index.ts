/**
 * Offline Sync Module for VoiceInvoice Enterprise.
 *
 * Provides SQLite to PostgreSQL synchronization capabilities
 * for offline-first operation with conflict resolution.
 *
 * @module lib/sync
 *
 * @example
 * ```typescript
 * import {
 *   SyncQueue,
 *   SyncEngine,
 *   ConflictResolver,
 * } from '@/lib/sync';
 *
 * // Create sync components
 * const queue = new SyncQueue({ tenantId: 'tenant-123' });
 * const resolver = new ConflictResolver({ strategy: 'LAST_WRITE_WINS' });
 *
 * const engine = new SyncEngine({
 *   queue,
 *   resolver,
 *   apiClient,
 *   tenantId: 'tenant-123',
 * });
 *
 * // Start background sync
 * engine.start();
 *
 * // Queue local changes
 * queue.enqueue({
 *   entityType: 'customer',
 *   entityId: 'cust-1',
 *   operation: 'CREATE',
 *   data: { name: 'New Customer' },
 * });
 * ```
 */

// Sync Queue exports
export {
  SyncQueue,
  type SyncQueueEntry,
  type SyncOperation,
  type SyncEntityType,
  type SyncEntryStatus,
  type EnqueueInput,
  type SyncQueueStorage,
  type SyncQueueOptions,
} from './sync-queue';

// Conflict Resolver exports
export {
  ConflictResolver,
  type ConflictResolutionStrategy,
  type ConflictType,
  type ConflictWinner,
  type ConflictAction,
  type SyncConflict,
  type ResolvedConflict,
  type ConflictDetectionInput,
  type CustomResolverFn,
  type ConflictHistoryEntry,
  type ConflictResolverOptions,
} from './conflict-resolver';

// Sync Engine exports
export {
  SyncEngine,
  type SyncStatus,
  type ConnectionState,
  type SyncResult,
  type SyncProgress,
  type SyncStats,
  type SyncApiClient,
  type SyncEngineOptions,
  type StatusChangeHandler,
  type ConnectionChangeHandler,
  type SyncCompleteHandler,
  type ErrorHandler,
  type ConflictHandler,
} from './sync-engine';

// HTTP Sync Client exports
export { HttpSyncApiClient, type HttpSyncClientOptions } from './http-sync-client';

// Encrypted Sync Client exports (E2E encryption support)
export {
  EncryptedSyncClient,
  createEncryptedSyncClientFromEnv,
  type EncryptedSyncConfig,
  type EncryptedSyncPayload,
} from './encrypted-sync-client';
