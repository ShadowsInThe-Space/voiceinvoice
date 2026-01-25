/**
 * React hook for workflow analytics data.
 *
 * Provides access to workflow execution statistics, KPIs,
 * and historical data for the analytics dashboard.
 *
 * @module hooks/use-workflow-analytics
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PrismaClient } from '@prisma/client';
import {
  WorkflowAnalyticsService,
  type LatestKPIs,
  type ExecutionStats,
  type DailyExecutionCount,
  type WorkflowSuccessRate,
  type ErrorTypeBreakdown,
  type WorkflowExecutionRecord,
} from '@/lib/database';

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
 * Global Prisma client instance (singleton pattern for browser).
 */
let prismaInstance: PrismaClient | null = null;

/**
 * Gets or creates the Prisma client instance.
 */
function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
}

/**
 * Hook for accessing workflow analytics data.
 *
 * @param options - Configuration options
 * @returns Analytics state and refresh function
 *
 * @example
 * ```tsx
 * const { kpis, stats, loading, refresh } = useWorkflowAnalytics({ days: 30 });
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

  // Create service instance
  const service = useMemo(() => {
    const prisma = getPrismaClient();
    return new WorkflowAnalyticsService(prisma);
  }, []);

  /**
   * Fetches all analytics data.
   */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const endDate = new Date();

      // Fetch all data in parallel
      const [
        fetchedKpis,
        fetchedStats,
        fetchedDailyCounts,
        fetchedSuccessRates,
        fetchedErrorBreakdown,
        fetchedExecutions,
      ] = await Promise.all([
        service.getLatestKPIs(),
        service.getExecutionStats(startDate, endDate, workflowIntent),
        service.getDailyExecutionCounts(days),
        service.getWorkflowSuccessRates(),
        service.getErrorTypeBreakdown(),
        service.getRecentExecutions(20, workflowIntent),
      ]);

      setKpis(fetchedKpis);
      setStats(fetchedStats);
      setDailyCounts(fetchedDailyCounts);
      setSuccessRates(fetchedSuccessRates);
      setErrorBreakdown(fetchedErrorBreakdown);
      setRecentExecutions(fetchedExecutions);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Laden der Analytics-Daten';
      setError(message);
      console.error('[useWorkflowAnalytics] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [service, days, workflowIntent]);

  /**
   * Triggers aggregation update.
   */
  const triggerAggregation = useCallback(async () => {
    try {
      await Promise.all([
        service.updateAggregations('daily'),
        service.updateAggregations('weekly'),
        service.updateAggregations('monthly'),
      ]);
    } catch (err) {
      console.error('[useWorkflowAnalytics] Aggregation error:', err);
    }
  }, [service]);

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
