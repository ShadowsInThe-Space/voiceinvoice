/**
 * Workflow History component.
 *
 * Displays a paginated table of workflow executions.
 *
 * @module components/workflows/WorkflowHistory
 */

import React, { useState, useMemo } from 'react';

/**
 * Workflow execution record for display.
 * Accepts both Date and string for triggeredAt to support IPC serialization.
 */
export interface WorkflowExecutionDisplay {
  id: string;
  workflowIntent: string;
  workflowName: string;
  triggeredAt: Date | string;
  executionTimeMs: number;
  success: boolean;
  errorType: string | null;
  errorMessage: string | null;
  params?: string | null;
  responseData?: string | null;
}

/**
 * Props for WorkflowHistory component.
 */
export interface WorkflowHistoryProps {
  /** List of executions to display */
  executions: WorkflowExecutionDisplay[];
  /** Whether data is loading */
  loading?: boolean;
  /** Items per page (default: 10) */
  itemsPerPage?: number;
}

/**
 * Formats a date for display.
 * @param date
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Formats execution time.
 * @param ms
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Status badge component.
 * @param root0
 * @param root0.success
 */
function StatusBadge({ success }: { success: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}
    >
      {success ? '✓ Erfolgreich' : '✗ Fehler'}
    </span>
  );
}

/**
 * Error type badge component.
 * @param root0
 * @param root0.errorType
 */
function ErrorTypeBadge({ errorType }: { errorType: string }) {
  const colors: Record<string, string> = {
    TIMEOUT: 'bg-yellow-100 text-yellow-800',
    CREDENTIALS_MISSING: 'bg-purple-100 text-purple-800',
    N8N_NOT_REACHABLE: 'bg-orange-100 text-orange-800',
    EXECUTION_FAILED: 'bg-red-100 text-red-800',
    UNKNOWN: 'bg-gray-100 text-gray-800',
  };

  const displayName = errorType.replace(/_/g, ' ');

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${colors[errorType] || colors.UNKNOWN}`}
    >
      {displayName}
    </span>
  );
}

/**
 * Workflow execution history table.
 *
 * @param props - Component props
 * @param props.executions
 * @param props.loading
 * @param props.itemsPerPage
 * @returns History table
 *
 * @example
 * ```tsx
 * <WorkflowHistory executions={executions} />
 * ```
 */
export function WorkflowHistory({
  executions,
  loading = false,
  itemsPerPage = 10,
}: WorkflowHistoryProps): React.ReactElement {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all');

  // Filter executions
  const filteredExecutions = useMemo(() => {
    if (filter === 'all') return executions;
    return executions.filter((e) => (filter === 'success' ? e.success : !e.success));
  }, [executions, filter]);

  // Paginate
  const totalPages = Math.ceil(filteredExecutions.length / itemsPerPage);
  const paginatedExecutions = useMemo(() => {
    const start = page * itemsPerPage;
    return filteredExecutions.slice(start, start + itemsPerPage);
  }, [filteredExecutions, page, itemsPerPage]);

  // Reset page when filter changes
  React.useEffect(() => {
    setPage(0);
  }, [filter]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header with filters */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Ausführungshistorie</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-sm rounded-lg ${
              filter === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Alle
          </button>
          <button
            onClick={() => setFilter('success')}
            className={`px-3 py-1 text-sm rounded-lg ${
              filter === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Erfolgreich
          </button>
          <button
            onClick={() => setFilter('failed')}
            className={`px-3 py-1 text-sm rounded-lg ${
              filter === 'failed'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Fehler
          </button>
        </div>
      </div>

      {/* Table */}
      {paginatedExecutions.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          {filter === 'all'
            ? 'Noch keine Ausführungen'
            : filter === 'success'
              ? 'Keine erfolgreichen Ausführungen'
              : 'Keine fehlgeschlagenen Ausführungen'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Workflow
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Zeitpunkt
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dauer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedExecutions.map((execution) => (
                <tr key={execution.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{execution.workflowName}</p>
                      <p className="text-xs text-gray-500">{execution.workflowIntent}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(new Date(execution.triggeredAt))}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDuration(execution.executionTimeMs)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge success={execution.success} />
                  </td>
                  <td className="px-4 py-3">
                    {execution.errorType ? (
                      <ErrorTypeBadge errorType={execution.errorType} />
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Zeige {page * itemsPerPage + 1}-
            {Math.min((page + 1) * itemsPerPage, filteredExecutions.length)} von{' '}
            {filteredExecutions.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Zurück
            </button>
            <span className="text-sm text-gray-600">
              Seite {page + 1} von {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Weiter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
