/**
 * IPC Handlers for Workflow Analytics.
 *
 * Provides database operations for workflow execution statistics,
 * KPIs, and invoice timeline data using Prisma.
 *
 * @module electron/ipc/analytics-handlers
 */

import { PrismaClient } from '@/generated/prisma';
import { getDatabaseUrl, logDatabaseConfig } from '../lib/database-path';
import type { IpcResult } from './handlers';

/**
 * Prisma client instance (lazy-initialized).
 */
let prisma: PrismaClient | null = null;

/**
 * Gets or creates the Prisma client with the correct database path.
 *
 * Uses lazy initialization to ensure app.getPath('userData') is available.
 *
 * @returns {PrismaClient} The Prisma client instance
 */
function getPrismaClient(): PrismaClient {
  if (!prisma) {
    logDatabaseConfig();
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: getDatabaseUrl(),
        },
      },
    });
  }
  return prisma;
}

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
 * Timeline invoice.
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
 * Top customer.
 */
export interface TopCustomer {
  id: string;
  name: string;
  totalRevenue: number;
  invoiceCount: number;
  paidCount: number;
}

/**
 * Gets the latest KPI values from the database.
 */
export async function getWorkflowKPIsHandler(): Promise<IpcResult<LatestKPIs>> {
  try {
    // Get latest KPIs from WorkflowKPI table
    const kpiResults = await getPrismaClient().$queryRaw<
      Array<{ metricName: string; metricValue: number }>
    >`
      SELECT metricName, metricValue
      FROM WorkflowKPI
      WHERE id IN (
        SELECT id FROM WorkflowKPI k1
        WHERE recordedAt = (
          SELECT MAX(recordedAt) FROM WorkflowKPI k2
          WHERE k2.metricName = k1.metricName
        )
      )
    `;

    // Also get overdue invoice totals directly from Invoice table
    const overdueResult = await getPrismaClient().$queryRaw<
      Array<{ total: number; count: number }>
    >`
      SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as count
      FROM Invoice
      WHERE status = 'OVERDUE' AND deletedAt IS NULL
    `;

    // Build KPIs object
    const kpis: LatestKPIs = {
      offeneMahnungenEuro: 0,
      verarbeiteteRechnungen: 0,
      gematchteZahlungen: 0,
      ueberfaelligeVertraege: 0,
    };

    // Map database values
    for (const kpi of kpiResults) {
      switch (kpi.metricName) {
        case 'offene_mahnungen_euro':
          kpis.offeneMahnungenEuro = kpi.metricValue;
          break;
        case 'verarbeitete_rechnungen':
          kpis.verarbeiteteRechnungen = kpi.metricValue;
          break;
        case 'gematchte_zahlungen':
          kpis.gematchteZahlungen = kpi.metricValue;
          break;
        case 'ueberfaellige_count':
          kpis.ueberfaelligeVertraege = kpi.metricValue;
          break;
      }
    }

    // Use actual overdue data if KPI not set
    if (kpis.offeneMahnungenEuro === 0 && overdueResult[0]) {
      kpis.offeneMahnungenEuro = overdueResult[0].total;
    }
    if (kpis.ueberfaelligeVertraege === 0 && overdueResult[0]) {
      kpis.ueberfaelligeVertraege = overdueResult[0].count;
    }

    return { success: true, data: kpis };
  } catch (error) {
    console.error('[getWorkflowKPIsHandler] Error:', error);
    return {
      success: false,
      error: {
        message: `Failed to fetch KPIs: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    };
  }
}

/**
 * Gets execution statistics for a time range.
 * @param startDate
 * @param endDate
 * @param workflowIntent
 */
export async function getExecutionStatsHandler(
  startDate?: string,
  endDate?: string,
  workflowIntent?: string
): Promise<IpcResult<ExecutionStats>> {
  try {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    let whereClause = `triggeredAt >= '${start.toISOString()}' AND triggeredAt <= '${end.toISOString()}'`;
    if (workflowIntent) {
      whereClause += ` AND workflowIntent = '${workflowIntent}'`;
    }

    const result = await getPrismaClient().$queryRawUnsafe<
      Array<{
        total: number;
        successful: number;
        failed: number;
        avgTime: number;
      }>
    >(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed,
        AVG(executionTimeMs) as avgTime
      FROM WorkflowExecution
      WHERE ${whereClause}
    `);

    const stats = result[0] || { total: 0, successful: 0, failed: 0, avgTime: 0 };

    return {
      success: true,
      data: {
        totalExecutions: Number(stats.total) || 0,
        successfulExecutions: Number(stats.successful) || 0,
        failedExecutions: Number(stats.failed) || 0,
        avgExecutionTimeMs: Math.round(Number(stats.avgTime) || 0),
        successRate:
          stats.total > 0
            ? Math.round((Number(stats.successful) / Number(stats.total)) * 1000) / 10
            : 0,
      },
    };
  } catch (error) {
    console.error('[getExecutionStatsHandler] Error:', error);
    return {
      success: false,
      error: {
        message: `Failed to fetch stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    };
  }
}

/**
 * Gets daily execution counts.
 * @param days
 */
export async function getDailyCountsHandler(
  days: number = 30
): Promise<IpcResult<DailyExecutionCount[]>> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const results = await getPrismaClient().$queryRaw<
      Array<{
        date: string;
        total: number;
        successCount: number;
        failureCount: number;
      }>
    >`
      SELECT
        DATE(triggeredAt) as date,
        COUNT(*) as total,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successCount,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failureCount
      FROM WorkflowExecution
      WHERE triggeredAt >= ${startDate.toISOString()}
      GROUP BY DATE(triggeredAt)
      ORDER BY date ASC
    `;

    // Fill in missing days with zeros
    const filledData: DailyExecutionCount[] = [];
    const dataMap = new Map(results.map((r) => [r.date, r]));

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const dateStr = date.toISOString().split('T')[0];

      const existing = dataMap.get(dateStr);
      filledData.push({
        date: dateStr,
        count: Number(existing?.total) || 0,
        successCount: Number(existing?.successCount) || 0,
        failureCount: Number(existing?.failureCount) || 0,
      });
    }

    return { success: true, data: filledData };
  } catch (error) {
    console.error('[getDailyCountsHandler] Error:', error);
    return {
      success: false,
      error: {
        message: `Failed to fetch daily counts: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    };
  }
}

/**
 * Gets workflow success rates.
 */
export async function getSuccessRatesHandler(): Promise<IpcResult<WorkflowSuccessRate[]>> {
  try {
    const results = await getPrismaClient().$queryRaw<
      Array<{
        workflowName: string;
        workflowIntent: string;
        total: number;
        successful: number;
      }>
    >`
      SELECT
        workflowName,
        workflowIntent,
        COUNT(*) as total,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful
      FROM WorkflowExecution
      GROUP BY workflowIntent, workflowName
      ORDER BY total DESC
    `;

    const data: WorkflowSuccessRate[] = results.map((r) => ({
      workflowName: r.workflowName,
      workflowIntent: r.workflowIntent,
      totalExecutions: Number(r.total),
      successRate:
        r.total > 0 ? Math.round((Number(r.successful) / Number(r.total)) * 1000) / 10 : 0,
    }));

    return { success: true, data };
  } catch (error) {
    console.error('[getSuccessRatesHandler] Error:', error);
    return {
      success: false,
      error: {
        message: `Failed to fetch success rates: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    };
  }
}

/**
 * Gets error type breakdown.
 */
export async function getErrorBreakdownHandler(): Promise<IpcResult<ErrorTypeBreakdown[]>> {
  try {
    const results = await getPrismaClient().$queryRaw<
      Array<{
        errorType: string;
        count: number;
      }>
    >`
      SELECT
        COALESCE(errorType, 'UNKNOWN') as errorType,
        COUNT(*) as count
      FROM WorkflowExecution
      WHERE success = 0
      GROUP BY errorType
      ORDER BY count DESC
    `;

    const totalErrors = results.reduce((sum, r) => sum + Number(r.count), 0);

    const data: ErrorTypeBreakdown[] = results.map((r) => ({
      errorType: r.errorType || 'UNKNOWN',
      count: Number(r.count),
      percentage: totalErrors > 0 ? Math.round((Number(r.count) / totalErrors) * 1000) / 10 : 0,
    }));

    return { success: true, data };
  } catch (error) {
    console.error('[getErrorBreakdownHandler] Error:', error);
    return {
      success: false,
      error: {
        message: `Failed to fetch error breakdown: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    };
  }
}

/**
 * Gets recent workflow executions.
 * @param limit
 * @param workflowIntent
 */
export async function getRecentExecutionsHandler(
  limit: number = 20,
  workflowIntent?: string
): Promise<IpcResult<WorkflowExecutionRecord[]>> {
  try {
    const where: Record<string, unknown> = {};
    if (workflowIntent) {
      where.workflowIntent = workflowIntent;
    }

    const executions = await getPrismaClient().workflowExecution.findMany({
      where,
      orderBy: { triggeredAt: 'desc' },
      take: limit,
    });

    const data: WorkflowExecutionRecord[] = executions.map((e) => ({
      id: e.id,
      workflowIntent: e.workflowIntent,
      workflowName: e.workflowName,
      triggeredAt: e.triggeredAt.toISOString(),
      executionTimeMs: e.executionTimeMs,
      success: e.success,
      errorType: e.errorType,
      errorMessage: e.errorMessage,
      params: e.params,
      responseData: e.responseData,
    }));

    return { success: true, data };
  } catch (error) {
    console.error('[getRecentExecutionsHandler] Error:', error);
    return {
      success: false,
      error: {
        message: `Failed to fetch executions: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    };
  }
}

/**
 * Gets invoice timeline data.
 */
export async function getTimelineInvoicesHandler(): Promise<IpcResult<TimelineInvoice[]>> {
  try {
    const results = await getPrismaClient().$queryRaw<
      Array<{
        id: string;
        number: string;
        customerId: string;
        customerName: string;
        total: number;
        dueAt: string | null;
        status: string;
      }>
    >`
      SELECT
        i.id,
        i.number,
        i.customerId,
        c.name as customerName,
        i.total,
        i.dueAt,
        i.status
      FROM Invoice i
      LEFT JOIN Customer c ON i.customerId = c.id
      WHERE i.deletedAt IS NULL
        AND i.status IN ('SENT', 'OVERDUE', 'DRAFT')
      ORDER BY i.dueAt ASC
    `;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const data: TimelineInvoice[] = results.map((inv) => {
      let daysUntilDue = Infinity;
      let isOverdue = false;

      if (inv.dueAt) {
        const dueDate = new Date(inv.dueAt);
        dueDate.setHours(0, 0, 0, 0);
        daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        isOverdue = daysUntilDue < 0 && inv.status !== 'PAID';
      }

      return {
        id: inv.id,
        number: inv.number,
        customerId: inv.customerId,
        customerName: inv.customerName || 'Unbekannt',
        total: inv.total,
        dueAt: inv.dueAt,
        daysUntilDue,
        isOverdue,
        status: inv.status,
      };
    });

    return { success: true, data };
  } catch (error) {
    console.error('[getTimelineInvoicesHandler] Error:', error);
    return {
      success: false,
      error: {
        message: `Failed to fetch timeline: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    };
  }
}

/**
 * Gets top customers by revenue.
 * @param limit
 */
export async function getTopCustomersHandler(limit: number = 5): Promise<IpcResult<TopCustomer[]>> {
  try {
    const results = await getPrismaClient().$queryRaw<
      Array<{
        id: string;
        name: string;
        totalRevenue: number;
        invoiceCount: number;
        paidCount: number;
      }>
    >`
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
      LIMIT ${limit}
    `;

    const data: TopCustomer[] = results.map((c) => ({
      id: c.id,
      name: c.name,
      totalRevenue: Number(c.totalRevenue) || 0,
      invoiceCount: Number(c.invoiceCount) || 0,
      paidCount: Number(c.paidCount) || 0,
    }));

    return { success: true, data };
  } catch (error) {
    console.error('[getTopCustomersHandler] Error:', error);
    return {
      success: false,
      error: {
        message: `Failed to fetch top customers: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    };
  }
}
