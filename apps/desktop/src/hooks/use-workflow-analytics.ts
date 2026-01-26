/**
 * React hook for workflow analytics data.
 *
 * Provides access to workflow execution statistics, KPIs,
 * and historical data for the analytics dashboard.
 *
 * Uses Electron IPC to communicate with the main process
 * for database operations.
 *
 * @module hooks/use-workflow-analytics
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * Latest KPI values.
 */
export interface LatestKPIs {
  offeneMahnungenEuro: number;
  verarbeiteteRechnungen: number;
  gematchteZahlungen: number;
  ueberfaelligeVertraege: number;
}

/**
 * Execution statistics.
 */
export interface ExecutionStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  avgExecutionTimeMs: number;
  successRate: number;
}

/**
 * Daily execution count.
 */
export interface DailyExecutionCount {
  date: string;
  count: number;
  successCount: number;
  failureCount: number;
}

/**
 * Workflow success rate.
 */
export interface WorkflowSuccessRate {
  workflowName: string;
  workflowIntent: string;
  successRate: number;
  totalExecutions: number;
}

/**
 * Error type breakdown.
 */
export interface ErrorTypeBreakdown {
  errorType: string;
  count: number;
  percentage: number;
}

/**
 * Workflow execution record.
 */
export interface WorkflowExecutionRecord {
  id: string;
  workflowIntent: string;
  workflowName: string;
  triggeredAt: string;
  executionTimeMs: number;
  success: boolean;
  errorType: string | null;
  errorMessage: string | null;
  params: string | null;
  responseData: string | null;
}

/**
 * State returned by useWorkflowAnalytics hook.
 */
export interface WorkflowAnalyticsState {
  /** Whether data is being loaded */
  loading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Latest KPI values */
  kpis: LatestKPIs;
  /** Execution statistics for the selected time range */
  stats: ExecutionStats;
  /** Daily execution counts for charts */
  dailyCounts: DailyExecutionCount[];
  /** Success rates per workflow */
  successRates: WorkflowSuccessRate[];
  /** Error type breakdown */
  errorBreakdown: ErrorTypeBreakdown[];
  /** Recent executions */
  recentExecutions: WorkflowExecutionRecord[];
}

/**
 * Options for useWorkflowAnalytics hook.
 */
export interface WorkflowAnalyticsOptions {
  /** Number of days to include in statistics (default: 30) */
  days?: number;
  /** Workflow intent to filter by (optional) */
  workflowIntent?: string;
  /** Whether to auto-refresh data (default: false) */
  autoRefresh?: boolean;
  /** Auto-refresh interval in ms (default: 60000) */
  refreshInterval?: number;
}

/**
 * Default empty KPIs.
 */
const EMPTY_KPIS: LatestKPIs = {
  offeneMahnungenEuro: 0,
  verarbeiteteRechnungen: 0,
  gematchteZahlungen: 0,
  ueberfaelligeVertraege: 0,
};

/**
 * Default empty stats.
 */
const EMPTY_STATS: ExecutionStats = {
  totalExecutions: 0,
  successfulExecutions: 0,
  failedExecutions: 0,
  avgExecutionTimeMs: 0,
  successRate: 0,
};

/**
 * IPC result type.
 */
interface IpcResult<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
  };
}

/**
 * Hook for accessing workflow analytics data.
 *
 * Uses Electron IPC to fetch data from the main process.
 *
 * @param options - Configuration options
 * @returns Analytics state and refresh function
 *
 * @example
 * ```tsx
 * const { state, refresh } = useWorkflowAnalytics({ days: 30 });
 * ```
 */
export function useWorkflowAnalytics(options: WorkflowAnalyticsOptions = {}): {
  state: WorkflowAnalyticsState;
  refresh: () => Promise<void>;
  triggerAggregation: () => Promise<void>;
} {
  const { days = 30, workflowIntent, autoRefresh = false, refreshInterval = 60000 } = options;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<LatestKPIs>(EMPTY_KPIS);
  const [stats, setStats] = useState<ExecutionStats>(EMPTY_STATS);
  const [dailyCounts, setDailyCounts] = useState<DailyExecutionCount[]>([]);
  const [successRates, setSuccessRates] = useState<WorkflowSuccessRate[]>([]);
  const [errorBreakdown, setErrorBreakdown] = useState<ErrorTypeBreakdown[]>([]);
  const [recentExecutions, setRecentExecutions] = useState<WorkflowExecutionRecord[]>([]);

  /**
   * Fetches KPIs via REST API (browser fallback).
   */
  const fetchViaApi = useCallback(async () => {
    const response = await fetch('/api/analytics/kpis');
    if (!response.ok) {
      throw new Error('Failed to fetch analytics');
    }
    const data = await response.json();
    setKpis({
      offeneMahnungenEuro: data.offeneMahnungenEuro || 0,
      verarbeiteteRechnungen: data.verarbeiteteRechnungen || 0,
      gematchteZahlungen: data.gematchteZahlungen || 0,
      ueberfaelligeVertraege: data.ueberfaelligeVertraege || 0,
    });
    setStats({
      totalExecutions: data.recentExecutions || 0,
      successfulExecutions: data.gematchteZahlungen || 0,
      failedExecutions: data.ueberfaelligeVertraege || 0,
      avgExecutionTimeMs: 0,
      successRate: data.successRate || 0,
    });
  }, []);

  /**
   * Fetches all analytics data via IPC or REST API.
   */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Check if we're in Electron context
    if (typeof window === 'undefined' || !window.voiceinvoice?.analytics) {
      // Fallback to REST API for browser context
      try {
        await fetchViaApi();
        setLoading(false);
        return;
      } catch (err) {
        console.error('[Analytics] API fallback failed:', err);
        setError('Analytics lädt...');
        setLoading(false);
        return;
      }
    }

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const endDate = new Date();

      // Fetch all data in parallel via IPC
      const [
        kpisResult,
        statsResult,
        dailyCountsResult,
        successRatesResult,
        errorBreakdownResult,
        executionsResult,
      ] = await Promise.all([
        window.voiceinvoice.analytics.getKPIs() as Promise<IpcResult<LatestKPIs>>,
        window.voiceinvoice.analytics.getStats(
          startDate.toISOString(),
          endDate.toISOString(),
          workflowIntent
        ) as Promise<IpcResult<ExecutionStats>>,
        window.voiceinvoice.analytics.getDailyCounts(days) as Promise<
          IpcResult<DailyExecutionCount[]>
        >,
        window.voiceinvoice.analytics.getSuccessRates() as Promise<
          IpcResult<WorkflowSuccessRate[]>
        >,
        window.voiceinvoice.analytics.getErrorBreakdown() as Promise<
          IpcResult<ErrorTypeBreakdown[]>
        >,
        window.voiceinvoice.analytics.getRecentExecutions(20, workflowIntent) as Promise<
          IpcResult<WorkflowExecutionRecord[]>
        >,
      ]);

      // Process results
      if (kpisResult.success && kpisResult.data) {
        setKpis(kpisResult.data);
      }
      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      }
      if (dailyCountsResult.success && dailyCountsResult.data) {
        setDailyCounts(dailyCountsResult.data);
      }
      if (successRatesResult.success && successRatesResult.data) {
        setSuccessRates(successRatesResult.data);
      }
      if (errorBreakdownResult.success && errorBreakdownResult.data) {
        setErrorBreakdown(errorBreakdownResult.data);
      }
      if (executionsResult.success && executionsResult.data) {
        setRecentExecutions(executionsResult.data);
      }

      // Check for any errors
      const firstError = [
        kpisResult,
        statsResult,
        dailyCountsResult,
        successRatesResult,
        errorBreakdownResult,
        executionsResult,
      ].find((r) => !r.success);

      if (firstError && firstError.error) {
        setError(firstError.error.message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Laden der Analytics-Daten';
      setError(message);
      console.error('[useWorkflowAnalytics] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [days, workflowIntent]);

  /**
   * Triggers aggregation update (placeholder).
   */
  const triggerAggregation = useCallback(async () => {
    // TODO: Implement aggregation trigger via IPC
    console.log('[useWorkflowAnalytics] Aggregation triggered');
  }, []);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchData]);

  const state: WorkflowAnalyticsState = {
    loading,
    error,
    kpis,
    stats,
    dailyCounts,
    successRates,
    errorBreakdown,
    recentExecutions,
  };

  return {
    state,
    refresh: fetchData,
    triggerAggregation,
  };
}
