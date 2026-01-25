/**
 * React hook for invoice timeline and customer analytics.
 *
 * Provides data for the payment timeline visualization,
 * overdue invoices, and top customers by revenue.
 *
 * @module hooks/use-invoice-timeline
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PrismaClient, Invoice } from '@prisma/client';

/**
 * Invoice with due date information for timeline.
 */
export interface TimelineInvoice {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  total: number;
  dueAt: Date | null;
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
 * Calculates days until due date.
 */
function calculateDaysUntilDue(dueAt: Date | null): number {
  if (!dueAt) return Infinity;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueAt);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Hook for accessing invoice timeline and customer data.
 *
 * @param options - Configuration options
 * @returns Timeline state and refresh function
 *
 * @example
 * ```tsx
 * const { timelineInvoices, topCustomers, loading } = useInvoiceTimeline({ daysAhead: 30 });
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

  const prisma = useMemo(() => getPrismaClient(), []);

  /**
   * Fetches all timeline data.
   */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch invoices with open status (SENT or OVERDUE)
      const invoices = await prisma.$queryRawUnsafe<
        Array<Invoice & { customerName: string }>
      >(`
        SELECT i.*, c.name as customerName
        FROM Invoice i
        LEFT JOIN Customer c ON i.customerId = c.id
        WHERE i.deletedAt IS NULL
          AND i.status IN ('SENT', 'OVERDUE', 'DRAFT')
        ORDER BY i.dueAt ASC
      `);

      // Transform to timeline format
      const timeline: TimelineInvoice[] = invoices.map((inv) => {
        const dueAt = inv.dueAt ? new Date(inv.dueAt) : null;
        const daysUntilDue = calculateDaysUntilDue(dueAt);

        return {
          id: inv.id,
          number: inv.number,
          customerId: inv.customerId,
          customerName: inv.customerName ?? 'Unbekannt',
          total: inv.total,
          dueAt,
          daysUntilDue,
          isOverdue: daysUntilDue < 0 && inv.status !== 'PAID',
          status: inv.status,
        };
      });

      setTimelineInvoices(timeline);

      // Fetch top customers by revenue
      const customers = await prisma.$queryRawUnsafe<
        Array<{
          id: string;
          name: string;
          totalRevenue: number;
          invoiceCount: number;
          paidCount: number;
        }>
      >(
        `
        SELECT
          c.id,
          c.name,
          COALESCE(SUM(CASE WHEN i.status = 'PAID' THEN i.total ELSE 0 END), 0) as totalRevenue,
          COUNT(i.id) as invoiceCount,
          SUM(CASE WHEN i.status = 'PAID' THEN 1 ELSE 0 END) as paidCount
        FROM Customer c
        LEFT JOIN Invoice i ON c.id = i.customerId AND i.deletedAt IS NULL
        WHERE c.deletedAt IS NULL
        GROUP BY c.id, c.name
        ORDER BY totalRevenue DESC
        LIMIT ?
      `,
        topCustomerLimit
      );

      setTopCustomers(
        customers.map((c) => ({
          id: c.id,
          name: c.name,
          totalRevenue: Number(c.totalRevenue) || 0,
          invoiceCount: Number(c.invoiceCount) || 0,
          paidCount: Number(c.paidCount) || 0,
        }))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Laden der Timeline-Daten';
      setError(message);
      console.error('[useInvoiceTimeline] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [prisma, topCustomerLimit]);

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
