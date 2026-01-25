/**
 * IPC Handlers for Workflow Analytics.
 *
 * Provides database operations for workflow execution statistics,
 * KPIs, and invoice timeline data.
 *
 * @module electron/ipc/analytics-handlers
 */

import type { IpcResult } from './handlers';

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
 * Mock data for development.
 * In production, these would come from the real database.
 */
const MOCK_KPIS: LatestKPIs = {
  offeneMahnungenEuro: 12500,
  verarbeiteteRechnungen: 156,
  gematchteZahlungen: 89500,
  ueberfaelligeVertraege: 3,
};

const MOCK_STATS: ExecutionStats = {
  totalExecutions: 245,
  successfulExecutions: 228,
  failedExecutions: 17,
  avgExecutionTimeMs: 1250,
  successRate: 93.1,
};

/**
 * Generates mock daily counts for the last N days.
 * @param days
 */
function generateMockDailyCounts(days: number): DailyExecutionCount[] {
  const counts: DailyExecutionCount[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const successCount = Math.floor(Math.random() * 10) + 5;
    const failureCount = Math.floor(Math.random() * 3);

    counts.push({
      date: date.toISOString().split('T')[0],
      count: successCount + failureCount,
      successCount,
      failureCount,
    });
  }

  return counts;
}

const MOCK_SUCCESS_RATES: WorkflowSuccessRate[] = [
  {
    workflowName: 'Rechnungseingang-Agent',
    workflowIntent: 'WORKFLOW_RECHNUNGSEINGANG',
    successRate: 98.5,
    totalExecutions: 85,
  },
  {
    workflowName: 'Mahnwesen-Agent',
    workflowIntent: 'WORKFLOW_MAHNWESEN',
    successRate: 94.2,
    totalExecutions: 52,
  },
  {
    workflowName: 'Zahlungsabgleich-Agent',
    workflowIntent: 'WORKFLOW_ZAHLUNGSABGLEICH',
    successRate: 87.3,
    totalExecutions: 63,
  },
  {
    workflowName: 'Monatsreport-Agent',
    workflowIntent: 'WORKFLOW_MONATSREPORT',
    successRate: 100.0,
    totalExecutions: 12,
  },
];

const MOCK_ERROR_BREAKDOWN: ErrorTypeBreakdown[] = [
  { errorType: 'TIMEOUT', count: 8, percentage: 47.1 },
  { errorType: 'NETWORK_ERROR', count: 5, percentage: 29.4 },
  { errorType: 'VALIDATION_ERROR', count: 3, percentage: 17.6 },
  { errorType: 'UNKNOWN', count: 1, percentage: 5.9 },
];

const MOCK_EXECUTIONS: WorkflowExecutionRecord[] = [
  {
    id: 'ex1',
    workflowIntent: 'WORKFLOW_RECHNUNGSEINGANG',
    workflowName: 'Rechnungseingang-Agent',
    triggeredAt: new Date().toISOString(),
    executionTimeMs: 1234,
    success: true,
    errorType: null,
    errorMessage: null,
    params: null,
    responseData: '{"processed": 5}',
  },
  {
    id: 'ex2',
    workflowIntent: 'WORKFLOW_MAHNWESEN',
    workflowName: 'Mahnwesen-Agent',
    triggeredAt: new Date(Date.now() - 3600000).toISOString(),
    executionTimeMs: 2156,
    success: true,
    errorType: null,
    errorMessage: null,
    params: null,
    responseData: '{"reminders": 3}',
  },
  {
    id: 'ex3',
    workflowIntent: 'WORKFLOW_ZAHLUNGSABGLEICH',
    workflowName: 'Zahlungsabgleich-Agent',
    triggeredAt: new Date(Date.now() - 7200000).toISOString(),
    executionTimeMs: 5000,
    success: false,
    errorType: 'TIMEOUT',
    errorMessage: 'Request timed out after 5000ms',
    params: null,
    responseData: null,
  },
];

const MOCK_TIMELINE_INVOICES: TimelineInvoice[] = [
  {
    id: 'inv1',
    number: 'RE-2026-001',
    customerId: 'c1',
    customerName: 'Acme Corp',
    total: 2500,
    dueAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    daysUntilDue: -5,
    isOverdue: true,
    status: 'OVERDUE',
  },
  {
    id: 'inv2',
    number: 'RE-2026-002',
    customerId: 'c2',
    customerName: 'Globex GmbH',
    total: 1800,
    dueAt: new Date(Date.now() + 86400000 * 3).toISOString(),
    daysUntilDue: 3,
    isOverdue: false,
    status: 'SENT',
  },
  {
    id: 'inv3',
    number: 'RE-2026-003',
    customerId: 'c3',
    customerName: 'TechStart AG',
    total: 4200,
    dueAt: new Date(Date.now() + 86400000 * 10).toISOString(),
    daysUntilDue: 10,
    isOverdue: false,
    status: 'SENT',
  },
  {
    id: 'inv4',
    number: 'RE-2026-004',
    customerId: 'c1',
    customerName: 'Acme Corp',
    total: 3100,
    dueAt: new Date(Date.now() + 86400000 * 15).toISOString(),
    daysUntilDue: 15,
    isOverdue: false,
    status: 'SENT',
  },
  {
    id: 'inv5',
    number: 'RE-2026-005',
    customerId: 'c4',
    customerName: 'Digital Solutions',
    total: 950,
    dueAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    daysUntilDue: -2,
    isOverdue: true,
    status: 'OVERDUE',
  },
];

const MOCK_TOP_CUSTOMERS: TopCustomer[] = [
  { id: 'c1', name: 'Acme Corp', totalRevenue: 45600, invoiceCount: 12, paidCount: 10 },
  { id: 'c2', name: 'Globex GmbH', totalRevenue: 32400, invoiceCount: 8, paidCount: 7 },
  { id: 'c3', name: 'TechStart AG', totalRevenue: 28900, invoiceCount: 6, paidCount: 5 },
  { id: 'c4', name: 'Digital Solutions', totalRevenue: 18500, invoiceCount: 5, paidCount: 4 },
  { id: 'c5', name: 'CloudFirst Inc', totalRevenue: 15200, invoiceCount: 4, paidCount: 4 },
];

/**
 * Gets the latest KPI values.
 */
export async function getWorkflowKPIsHandler(): Promise<IpcResult<LatestKPIs>> {
  try {
    // TODO: Replace with real Prisma query
    return {
      success: true,
      data: MOCK_KPIS,
    };
  } catch (error) {
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
 * @param _startDate
 * @param _endDate
 * @param _workflowIntent
 */
export async function getExecutionStatsHandler(
  _startDate?: string,
  _endDate?: string,
  _workflowIntent?: string
): Promise<IpcResult<ExecutionStats>> {
  try {
    // TODO: Replace with real Prisma query
    return {
      success: true,
      data: MOCK_STATS,
    };
  } catch (error) {
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
    // TODO: Replace with real Prisma query
    return {
      success: true,
      data: generateMockDailyCounts(days),
    };
  } catch (error) {
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
    // TODO: Replace with real Prisma query
    return {
      success: true,
      data: MOCK_SUCCESS_RATES,
    };
  } catch (error) {
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
    // TODO: Replace with real Prisma query
    return {
      success: true,
      data: MOCK_ERROR_BREAKDOWN,
    };
  } catch (error) {
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
 * @param _limit
 * @param _workflowIntent
 */
export async function getRecentExecutionsHandler(
  _limit: number = 20,
  _workflowIntent?: string
): Promise<IpcResult<WorkflowExecutionRecord[]>> {
  try {
    // TODO: Replace with real Prisma query
    return {
      success: true,
      data: MOCK_EXECUTIONS,
    };
  } catch (error) {
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
    // TODO: Replace with real Prisma query
    return {
      success: true,
      data: MOCK_TIMELINE_INVOICES,
    };
  } catch (error) {
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
 * @param _limit
 */
export async function getTopCustomersHandler(
  _limit: number = 5
): Promise<IpcResult<TopCustomer[]>> {
  try {
    // TODO: Replace with real Prisma query
    return {
      success: true,
      data: MOCK_TOP_CUSTOMERS,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: `Failed to fetch top customers: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    };
  }
}
