import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  SyncEngine,
  SyncStatus,
  ConnectionState,
  SyncStats,
  SyncResult,
} from '../lib/sync/sync-engine';
import { SyncQueue } from '../lib/sync/sync-queue';
import { ConflictResolver } from '../lib/sync/conflict-resolver';
import { HttpSyncApiClient } from '../lib/sync/http-sync-client';

interface SyncContextType {
  status: SyncStatus;
  connectionState: ConnectionState;
  lastSyncTimestamp: number | null;
  stats: SyncStats;
  syncEngine: SyncEngine | null;
  isInitialized: boolean;
  forceSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

/**
 *
 */
export function useSync() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}

interface SyncProviderProps {
  children: ReactNode;
  tenantId?: string; // Optional, defaults to 'default-tenant' or similar if not provided/auth not ready
}

/**
 *
 * @param root0
 * @param root0.children
 * @param root0.tenantId
 */
export function SyncProvider({ children, tenantId = 'demo-tenant' }: SyncProviderProps) {
  const [syncEngine, setSyncEngine] = useState<SyncEngine | null>(null);
  const [status, setStatus] = useState<SyncStatus>('IDLE');
  const [connectionState, setConnectionState] = useState<ConnectionState>('CHECKING');
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<number | null>(null);
  const [stats, setStats] = useState<SyncStats>({
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    totalPushed: 0,
    totalPulled: 0,
    totalConflicts: 0,
  });

  useEffect(() => {
    // Only initialize sync if API URL is explicitly configured
    // Skip sync in standalone/offline mode (no NEXT_PUBLIC_API_URL set)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      // Running in standalone/offline mode - no sync needed
      setConnectionState('OFFLINE');
      setStatus('IDLE');
      return;
    }

    // Initialize Sync Engine
    const queue = new SyncQueue({ tenantId });
    const resolver = new ConflictResolver();
    const apiClient = new HttpSyncApiClient({
      baseUrl: apiUrl,
      getAuthToken: async () => localStorage.getItem('voiceinvoice_license_token'),
    });

    const engine = new SyncEngine({
      queue,
      resolver,
      apiClient,
      tenantId,
      syncIntervalMs: 30000, // 30 seconds
    });

    // Subscribe to events
    engine.onStatusChange(setStatus);
    engine.onConnectionChange(setConnectionState);
    engine.onSyncComplete((result: SyncResult) => {
      setLastSyncTimestamp(result.timestamp);
      setStats(engine.getStats());
    });

    // Start engine
    engine.start();
    setSyncEngine(engine);

    // Cleanup
    return () => {
      engine.stop();
    };
  }, [tenantId]);

  const forceSync = async () => {
    if (syncEngine && connectionState === 'ONLINE') {
      await syncEngine.sync();
    }
  };

  const value = {
    status,
    connectionState,
    lastSyncTimestamp,
    stats,
    syncEngine,
    isInitialized: !!syncEngine,
    forceSync,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
