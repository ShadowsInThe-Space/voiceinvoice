/**
 * IPC Handlers for Offline Sync.
 *
 * Provides synchronization status and control for offline-first operation.
 * Queues local changes and syncs with PostgreSQL backend when online.
 *
 * @module electron/ipc/sync-handlers
 */

import { ipcMain, BrowserWindow } from 'electron';
import { SyncQueue, SyncEngine, ConflictResolver } from '../../src/lib/sync';
import type { SyncStatus, SyncStats, SyncEntityType } from '../../src/lib/sync';

/**
 * Sync service singleton.
 */
let syncQueue: SyncQueue | null = null;
let syncEngine: SyncEngine | null = null;
let isOnline = true;

/**
 * Sync status for IPC.
 */
export interface SyncStatusResult {
  isOnline: boolean;
  status: SyncStatus;
  pendingChanges: number;
  lastSyncAt: string | null;
  stats: SyncStats | null;
}

/**
 * Initialize the sync service.
 *
 * @param tenantId - The tenant ID for multi-tenant sync
 */
export function initSyncService(tenantId: string): void {
  if (syncQueue) {
    console.log('[Sync] Service already initialized');
    return;
  }

  // Initialize sync queue
  syncQueue = new SyncQueue({ tenantId });

  // Initialize conflict resolver with last-write-wins strategy
  const resolver = new ConflictResolver({ strategy: 'LAST_WRITE_WINS' });

  // Create mock API client for MVP (actual implementation would connect to proxy server)
  const mockApiClient = {
    push: async (): Promise<{ success: boolean; serverData?: Record<string, unknown> }> => ({
      success: true,
    }),
    pull: async (): Promise<{
      data: Array<{
        entityType: SyncEntityType;
        entityId: string;
        operation: 'CREATE' | 'UPDATE' | 'DELETE';
        data: Record<string, unknown>;
        serverVersion?: number;
      }>;
      lastSyncTimestamp: number;
    }> => ({
      data: [],
      lastSyncTimestamp: Date.now(),
    }),
    checkConnection: async (): Promise<boolean> => isOnline,
  };

  // Initialize sync engine
  syncEngine = new SyncEngine({
    queue: syncQueue,
    resolver,
    apiClient: mockApiClient,
    tenantId,
  });

  // Listen for online/offline events
  syncEngine.onConnectionChange((state) => {
    isOnline = state === 'ONLINE';
    notifyRenderer('sync:connection-changed', { isOnline: state === 'ONLINE' });
  });

  syncEngine.onSyncComplete((result) => {
    notifyRenderer('sync:completed', result);
  });

  syncEngine.onError((error) => {
    console.error('[Sync] Error:', error);
    notifyRenderer('sync:error', { message: error.message });
  });

  console.log('[Sync] Service initialized for tenant:', tenantId);
}

/**
 * Notify renderer process of sync events.
 *
 * @param channel - The IPC channel name
 * @param data - The data to send to renderer
 */
function notifyRenderer(channel: string, data: unknown): void {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  });
}

/**
 * Register sync IPC handlers.
 */
export function registerSyncHandlers(): void {
  /**
   * Get current sync status.
   */
  ipcMain.handle('sync:getStatus', async (): Promise<SyncStatusResult> => {
    if (!syncEngine || !syncQueue) {
      return {
        isOnline: true,
        status: 'IDLE',
        pendingChanges: 0,
        lastSyncAt: null,
        stats: null,
      };
    }

    const pending = await syncQueue.getPending();

    return {
      isOnline,
      status: syncEngine.getStatus(),
      pendingChanges: pending.length,
      lastSyncAt: syncEngine.getLastSyncTimestamp()
        ? new Date(syncEngine.getLastSyncTimestamp()!).toISOString()
        : null,
      stats: syncEngine.getStats(),
    };
  });

  /**
   * Trigger manual sync.
   */
  ipcMain.handle('sync:trigger', async (): Promise<{ success: boolean; error?: string }> => {
    if (!syncEngine) {
      return { success: false, error: 'Sync service not initialized' };
    }

    try {
      await syncEngine.sync();
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      return { success: false, error: message };
    }
  });

  /**
   * Start automatic background sync.
   */
  ipcMain.handle('sync:start', async (): Promise<{ success: boolean }> => {
    if (!syncEngine) {
      return { success: false };
    }

    syncEngine.start();
    return { success: true };
  });

  /**
   * Stop automatic background sync.
   */
  ipcMain.handle('sync:stop', async (): Promise<{ success: boolean }> => {
    if (!syncEngine) {
      return { success: false };
    }

    syncEngine.stop();
    return { success: true };
  });

  /**
   * Get pending changes count.
   */
  ipcMain.handle('sync:getPendingCount', async (): Promise<number> => {
    if (!syncQueue) {
      return 0;
    }

    const pending = await syncQueue.getPending();
    return pending.length;
  });

  /**
   * Queue a local change for sync.
   */
  ipcMain.handle(
    'sync:queueChange',
    async (
      _event,
      params: {
        entityType: 'customer' | 'invoice' | 'category' | 'recording';
        entityId: string;
        operation: 'CREATE' | 'UPDATE' | 'DELETE';
        data: Record<string, unknown>;
      }
    ): Promise<{ success: boolean; entryId?: string }> => {
      if (!syncQueue) {
        return { success: false };
      }

      const entry = await syncQueue.enqueue({
        entityType: params.entityType,
        entityId: params.entityId,
        operation: params.operation,
        data: params.data,
      });

      return { success: true, entryId: entry.id };
    }
  );

  console.log('[Sync] IPC handlers registered');
}

/**
 * Cleanup sync service on app quit.
 */
export function cleanupSyncService(): void {
  if (syncEngine) {
    syncEngine.stop();
    syncEngine = null;
  }
  syncQueue = null;
  console.log('[Sync] Service cleaned up');
}
