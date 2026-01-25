import React from 'react';
import { useSync } from '../contexts/SyncContext';
import { Cloud, CloudOff, RefreshCw, AlertCircle } from 'lucide-react';

/**
 *
 */
export function SyncStatusBadge() {
  const { status, connectionState } = useSync();

  if (connectionState === 'OFFLINE') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 text-xs font-medium border border-gray-200 dark:border-gray-700">
        <CloudOff className="h-3.5 w-3.5" />
        <span>Offline</span>
      </div>
    );
  }

  if (status === 'SYNCING') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 text-xs font-medium border border-blue-100 dark:border-blue-800">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        <span>Syncing...</span>
      </div>
    );
  }

  if (status === 'ERROR') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 text-xs font-medium border border-red-100 dark:border-red-800">
        <AlertCircle className="h-3.5 w-3.5" />
        <span>Sync Error</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 text-xs font-medium border border-green-100 dark:border-green-800">
      <Cloud className="h-3.5 w-3.5" />
      <span>Online</span>
    </div>
  );
}
