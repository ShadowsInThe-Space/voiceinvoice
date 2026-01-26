/**
 * Workflow Analytics API Route
 *
 * Provides workflow execution statistics, KPIs, timeline data,
 * and top customers. Works in both browser and Electron contexts.
 *
 * @module api/analytics/workflows
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

/**
 * Timeline invoice for payment timeline.
 */
interface TimelineInvoice {
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
interface TopCustomer {
  id: string;
  name: string;
  totalRevenue: number;
  invoiceCount: number;
  paidCount: number;
}

/**
 * Workflow execution record.
 */
interface WorkflowExecution {
  id: string;
  workflowIntent: string;
  workflowName: string;
  triggeredAt: string;
  executionTimeMs: number;
  success: boolean;
  errorType: string | null;
  errorMessage: string | null;
}

/**
 * Success rate per workflow.
 */
interface WorkflowSuccessRate {
  workflowName: string;
  workflowIntent: string;
  successRate: number;
  totalExecutions: number;
}

/**
 * Daily execution count.
 */
interface DailyCount {
  date: string;
  count: number;
  successCount: number;
  failureCount: number;
}

/**
 * Error breakdown.
 */
interface ErrorBreakdown {
  errorType: string;
  count: number;
  percentage: number;
}

/**
 * API response structure.
 */
interface WorkflowAnalyticsResponse {
  success: boolean;
  data: {
    // Workflow KPIs
    kpis: {
      offeneMahnungenEuro: number;
      verarbeiteteRechnungen: number;
      gematchteZahlungen: number;
      ueberfaelligeVertraege: number;
    };
    // Timeline invoices
    timelineInvoices: TimelineInvoice[];
    // Top customers
    topCustomers: TopCustomer[];
    // Workflow executions
    recentExecutions: WorkflowExecution[];
    // Success rates
    successRates: WorkflowSuccessRate[];
    // Daily counts (last 30 days)
    dailyCounts: DailyCount[];
    // Error breakdown
    errorBreakdown: ErrorBreakdown[];
    // Totals
    totalOverdueAmount: number;
    overdueCount: number;
  };
}

/**
 * GET /api/analytics/workflows
 *
 * Returns workflow analytics data.
 * @param req
 * @param res
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WorkflowAnalyticsResponse>
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ success: false, data: getEmptyData() });
    return;
  }

  try {
    const now = new Date();

    // Fetch invoices with customer info
    const invoices = await prisma.invoice.findMany({
      where: { deletedAt: null },
      include: {
        customer: {
          select: { id: true, name: true },
        },
      },
      orderBy: { dueAt: 'asc' },
    });

    // Calculate timeline invoices
    const timelineInvoices: TimelineInvoice[] = invoices
      .filter(
        (inv) => inv.status !== 'PAID' && inv.status !== 'CANCELLED' && inv.status !== 'DRAFT'
      )
      .map((inv) => {
        const dueAt = inv.dueAt ? new Date(inv.dueAt) : null;
        const daysUntilDue = dueAt
          ? Math.ceil((dueAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        const isOverdue = dueAt ? dueAt < now : false;

        return {
          id: inv.id,
          number: inv.number,
          customerId: inv.customerId,
          customerName: inv.customer?.name || 'Unbekannt',
          total: inv.total,
          dueAt: inv.dueAt?.toISOString() || null,
          daysUntilDue,
          isOverdue,
          status: inv.status,
        };
      });

    // Calculate overdue stats
    const overdueInvoices = timelineInvoices.filter((inv) => inv.isOverdue);
    const totalOverdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.total, 0);

    // Calculate top customers
    const customerStats = new Map<
      string,
      { name: string; revenue: number; count: number; paidCount: number }
    >();
    for (const inv of invoices) {
      const id = inv.customerId;
      const name = inv.customer?.name || 'Unbekannt';
      const current = customerStats.get(id) || { name, revenue: 0, count: 0, paidCount: 0 };
      current.count += 1;
      if (inv.status === 'PAID') {
        current.revenue += inv.total;
        current.paidCount += 1;
      }
      customerStats.set(id, current);
    }

    const topCustomers: TopCustomer[] = Array.from(customerStats.entries())
      .map(([id, stats]) => ({
        id,
        name: stats.name,
        totalRevenue: stats.revenue,
        invoiceCount: stats.count,
        paidCount: stats.paidCount,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5);

    // Fetch workflow executions
    let recentExecutions: WorkflowExecution[] = [];
    let successRates: WorkflowSuccessRate[] = [];
    let dailyCounts: DailyCount[] = [];
    let errorBreakdown: ErrorBreakdown[] = [];

    try {
      const executions = await prisma.workflowExecution.findMany({
        orderBy: { triggeredAt: 'desc' },
        take: 50,
      });

      recentExecutions = executions.map((ex) => ({
        id: ex.id,
        workflowIntent: ex.workflowIntent,
        workflowName: ex.workflowName,
        triggeredAt: ex.triggeredAt.toISOString(),
        executionTimeMs: ex.executionTimeMs,
        success: ex.success,
        errorType: ex.errorType,
        errorMessage: ex.errorMessage,
      }));

      // Calculate success rates per workflow
      const workflowStats = new Map<string, { name: string; total: number; success: number }>();
      for (const ex of executions) {
        const key = ex.workflowIntent;
        const current = workflowStats.get(key) || { name: ex.workflowName, total: 0, success: 0 };
        current.total += 1;
        if (ex.success) current.success += 1;
        workflowStats.set(key, current);
      }

      successRates = Array.from(workflowStats.entries()).map(([intent, stats]) => ({
        workflowIntent: intent,
        workflowName: stats.name,
        totalExecutions: stats.total,
        successRate: stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0,
      }));

      // Calculate daily counts (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const dailyMap = new Map<string, { count: number; success: number; failure: number }>();
      for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dailyMap.set(dateStr, { count: 0, success: 0, failure: 0 });
      }

      for (const ex of executions) {
        const dateStr = ex.triggeredAt.toISOString().split('T')[0];
        const current = dailyMap.get(dateStr);
        if (current) {
          current.count += 1;
          if (ex.success) current.success += 1;
          else current.failure += 1;
        }
      }

      dailyCounts = Array.from(dailyMap.entries())
        .map(([date, stats]) => ({
          date,
          count: stats.count,
          successCount: stats.success,
          failureCount: stats.failure,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Calculate error breakdown
      const errorStats = new Map<string, number>();
      const failedExecutions = executions.filter((ex) => !ex.success && ex.errorType);
      for (const ex of failedExecutions) {
        const errorType = ex.errorType || 'UNKNOWN';
        errorStats.set(errorType, (errorStats.get(errorType) || 0) + 1);
      }

      const totalErrors = failedExecutions.length;
      errorBreakdown = Array.from(errorStats.entries()).map(([errorType, count]) => ({
        errorType,
        count,
        percentage: totalErrors > 0 ? Math.round((count / totalErrors) * 100) : 0,
      }));
    } catch (workflowError) {
      console.warn('[Workflow Analytics] Could not fetch workflow data:', workflowError);
    }

    // Fetch workflow KPIs
    const kpis = {
      offeneMahnungenEuro: totalOverdueAmount,
      verarbeiteteRechnungen: invoices.filter((i) => i.status === 'PAID').length,
      gematchteZahlungen: invoices
        .filter((i) => i.status === 'PAID')
        .reduce((sum, i) => sum + i.total, 0),
      ueberfaelligeVertraege: overdueInvoices.length,
    };

    try {
      const kpiRecords = await prisma.workflowKPI.findMany({
        orderBy: { recordedAt: 'desc' },
        take: 10,
      });

      for (const kpi of kpiRecords) {
        if (kpi.metricName === 'offene_mahnungen_euro') {
          kpis.offeneMahnungenEuro = kpi.metricValue;
        } else if (kpi.metricName === 'verarbeitete_rechnungen') {
          kpis.verarbeiteteRechnungen = kpi.metricValue;
        } else if (kpi.metricName === 'gematchte_zahlungen') {
          kpis.gematchteZahlungen = kpi.metricValue;
        } else if (kpi.metricName === 'ablaufende_vertraege') {
          kpis.ueberfaelligeVertraege = kpi.metricValue;
        }
      }
    } catch (kpiError) {
      console.warn('[Workflow Analytics] Could not fetch KPI data:', kpiError);
    }

    res.status(200).json({
      success: true,
      data: {
        kpis,
        timelineInvoices,
        topCustomers,
        recentExecutions,
        successRates,
        dailyCounts,
        errorBreakdown,
        totalOverdueAmount,
        overdueCount: overdueInvoices.length,
      },
    });
  } catch (error) {
    console.error('[Workflow Analytics API] Error:', error);
    res.status(200).json({ success: true, data: getEmptyData() });
  }
}

/**
 * Returns empty data structure.
 */
function getEmptyData() {
  return {
    kpis: {
      offeneMahnungenEuro: 0,
      verarbeiteteRechnungen: 0,
      gematchteZahlungen: 0,
      ueberfaelligeVertraege: 0,
    },
    timelineInvoices: [],
    topCustomers: [],
    recentExecutions: [],
    successRates: [],
    dailyCounts: [],
    errorBreakdown: [],
    totalOverdueAmount: 0,
    overdueCount: 0,
  };
}
