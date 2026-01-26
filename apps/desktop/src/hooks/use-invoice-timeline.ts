/**
 * React hook for invoice timeline and customer analytics.
 *
 * Provides data for the payment timeline visualization,
 * overdue invoices, and top customers by revenue.
 *
 * Uses Electron IPC to communicate with the main process
 * for database operations.
 *
 * @module hooks/use-invoice-timeline
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * Invoice with due date information for timeline.
 */
export interface TimelineInvoice {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  total: number;
  dueAt: string | null;
  daysUntilDue: number;
  isOverdue: boolean;
  status: string;
}

/**
 * Top customer by revenue.
 */
export interface TopCustomer {
  id: string;
  name: string;
  totalRevenue: number;
  invoiceCount: number;
  paidCount: number;
}

/**
 * State returned by useInvoiceTimeline hook.
 */
export interface InvoiceTimelineState {
  /** Whether data is being loaded */
  loading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** All invoices for the timeline */
  timelineInvoices: TimelineInvoice[];
  /** Overdue invoices only */
  overdueInvoices: TimelineInvoice[];
  /** Upcoming invoices (due in next 30 days) */
  upcomingInvoices: TimelineInvoice[];
  /** Top customers by revenue */
  topCustomers: TopCustomer[];
  /** Total overdue amount */
  totalOverdueAmount: number;
  /** Number of overdue invoices */
  overdueCount: number;
}

/**
 * Options for useInvoiceTimeline hook.
 */
export interface InvoiceTimelineOptions {
  /** Number of days to look ahead (default: 30) */
  daysAhead?: number;
  /** Number of top customers to return (default: 5) */
  topCustomerLimit?: number;
  /** Whether to auto-refresh data (default: false) */
  autoRefresh?: boolean;
  /** Auto-refresh interval in ms (default: 60000) */
  refreshInterval?: number;
}

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
 * Hook for accessing invoice timeline and customer data.
 *
 * Uses Electron IPC to fetch data from the main process.
 *
 * @param options - Configuration options
 * @returns Timeline state and refresh function
 *
 * @example
 * ```tsx
 * const { state, refresh } = useInvoiceTimeline({ daysAhead: 30 });
 * ```
 */
export function useInvoiceTimeline(options: InvoiceTimelineOptions = {}): {
  state: InvoiceTimelineState;
  refresh: () => Promise<void>;
} {
  const {
    daysAhead = 30,
    topCustomerLimit = 5,
    autoRefresh = false,
    refreshInterval = 60000,
  } = options;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timelineInvoices, setTimelineInvoices] = useState<TimelineInvoice[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);

  /**
   * Fetches all timeline data via REST API or IPC.
   */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Try REST API first (works in browser and Electron)
    try {
      const response = await fetch('/api/analytics/workflows');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setTimelineInvoices(result.data.timelineInvoices || []);
          setTopCustomers(result.data.topCustomers?.slice(0, topCustomerLimit) || []);
          setLoading(false);
          return;
        }
      }
    } catch (apiError) {
      console.warn('[useInvoiceTimeline] REST API failed, trying IPC:', apiError);
    }

    // Fallback to Electron IPC if available
    if (typeof window !== 'undefined' && window.voiceinvoice?.analytics) {
      try {
        const [invoicesResult, customersResult] = await Promise.all([
          window.voiceinvoice.analytics.getTimelineInvoices() as Promise<
            IpcResult<TimelineInvoice[]>
          >,
          window.voiceinvoice.analytics.getTopCustomers(topCustomerLimit) as Promise<
            IpcResult<TopCustomer[]>
          >,
        ]);

        if (invoicesResult.success && invoicesResult.data) {
          setTimelineInvoices(invoicesResult.data);
        }

        if (customersResult.success && customersResult.data) {
          setTopCustomers(customersResult.data);
        }

        if (!invoicesResult.success && invoicesResult.error) {
          setError(invoicesResult.error.message);
        } else if (!customersResult.success && customersResult.error) {
          setError(customersResult.error.message);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler beim Laden der Timeline-Daten';
        setError(message);
        console.error('[useInvoiceTimeline] IPC Error:', err);
      }
    }

    setLoading(false);
  }, [topCustomerLimit]);

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

  // Computed values
  const overdueInvoices = useMemo(
    () => timelineInvoices.filter((inv) => inv.isOverdue),
    [timelineInvoices]
  );

  const upcomingInvoices = useMemo(
    () =>
      timelineInvoices.filter(
        (inv) => !inv.isOverdue && inv.daysUntilDue <= daysAhead && inv.daysUntilDue >= 0
      ),
    [timelineInvoices, daysAhead]
  );

  const totalOverdueAmount = useMemo(
    () => overdueInvoices.reduce((sum, inv) => sum + inv.total, 0),
    [overdueInvoices]
  );

  const state: InvoiceTimelineState = {
    loading,
    error,
    timelineInvoices,
    overdueInvoices,
    upcomingInvoices,
    topCustomers,
    totalOverdueAmount,
    overdueCount: overdueInvoices.length,
  };

  return {
    state,
    refresh: fetchData,
  };
}
