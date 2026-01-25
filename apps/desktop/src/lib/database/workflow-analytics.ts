/**
 * Workflow Analytics Service for VoiceInvoice Enterprise.
 *
 * Provides database operations for workflow execution tracking,
 * KPI storage, and aggregated statistics.
 *
 * @module lib/database/workflow-analytics
 */

import { PrismaClient } from '@prisma/client';
import type { WorkflowResult, WorkflowParams } from '../workflow';

/**
 * Workflow execution record from the database.
 */
export interface WorkflowExecutionRecord {
  id: string;
  workflowIntent: string;
  workflowName: string;
  triggeredAt: Date;
  executionTimeMs: number;
  success: boolean;
  errorType: string | null;
  errorMessage: string | null;
  params: string | null;
  responseData: string | null;
}

/**
 * Workflow KPI record from the database.
 */
export interface WorkflowKPIRecord {
  id: string;
  workflowIntent: string;
  recordedAt: Date;
  metricName: string;
  metricValue: number;
  metricUnit: string | null;
  metadata: string | null;
}

/**
 * Workflow aggregation record from the database.
 */
export interface WorkflowAggregationRecord {
  id: string;
  workflowIntent: string;
  periodType: string;
  periodStart: Date;
  executionCount: number;
  successCount: number;
  failureCount: number;
  avgExecutionTimeMs: number;
}

/**
 * Period type for aggregations.
 */
export type PeriodType = 'daily' | 'weekly' | 'monthly';

/**
 * Input for recording a workflow execution.
 */
export interface RecordExecutionInput {
  workflowIntent: string;
  workflowName: string;
  result: WorkflowResult;
  params?: WorkflowParams;
}

/**
 * Input for recording a KPI.
 */
export interface RecordKPIInput {
  workflowIntent: string;
  metricName: string;
  metricValue: number;
  metricUnit?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Latest KPI values for display.
 */
export interface LatestKPIs {
  offeneMahnungenEuro: number;
  verarbeiteteRechnungen: number;
  gematchteZahlungen: number;
  ueberfaelligeVertraege: number;
}

/**
 * Execution statistics for a time range.
 */
export interface ExecutionStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  avgExecutionTimeMs: number;
  successRate: number;
}

/**
 * Execution count per day for charts.
 */
export interface DailyExecutionCount {
  date: string;
  count: number;
  successCount: number;
  failureCount: number;
}

/**
 * Success rate per workflow for charts.
 */
export interface WorkflowSuccessRate {
  workflowIntent: string;
  workflowName: string;
  totalExecutions: number;
  successRate: number;
}

/**
 * Error type breakdown for charts.
 */
export interface ErrorTypeBreakdown {
  errorType: string;
  count: number;
  percentage: number;
}

/**
 * KPI mapping for extracting metrics from workflow responses.
 */
const KPI_EXTRACTORS: Record<string, (data: Record<string, unknown>) => RecordKPIInput[]> = {
  WORKFLOW_MAHNWESEN: (data) => {
    const kpis: RecordKPIInput[] = [];
    if (typeof data.offeneMahnungenEuro === 'number') {
      kpis.push({
        workflowIntent: 'WORKFLOW_MAHNWESEN',
        metricName: 'offene_mahnungen_euro',
        metricValue: data.offeneMahnungenEuro,
        metricUnit: 'EUR',
      });
    }
    if (typeof data.ueberfaelligeCount === 'number') {
      kpis.push({
        workflowIntent: 'WORKFLOW_MAHNWESEN',
        metricName: 'ueberfaellige_count',
        metricValue: data.ueberfaelligeCount,
        metricUnit: 'count',
      });
    }
    return kpis;
  },
  WORKFLOW_RECHNUNGSEINGANG: (data) => {
    const kpis: RecordKPIInput[] = [];
    if (typeof data.verarbeiteteRechnungen === 'number') {
      kpis.push({
        workflowIntent: 'WORKFLOW_RECHNUNGSEINGANG',
        metricName: 'verarbeitete_rechnungen',
        metricValue: data.verarbeiteteRechnungen,
        metricUnit: 'count',
      });
    }
    if (typeof data.erkannteSumme === 'number') {
      kpis.push({
        workflowIntent: 'WORKFLOW_RECHNUNGSEINGANG',
        metricName: 'erkannte_summe',
        metricValue: data.erkannteSumme,
        metricUnit: 'EUR',
      });
    }
    return kpis;
  },
  WORKFLOW_ZAHLUNGSABGLEICH: (data) => {
    const kpis: RecordKPIInput[] = [];
    if (typeof data.gematchteZahlungen === 'number') {
      kpis.push({
        workflowIntent: 'WORKFLOW_ZAHLUNGSABGLEICH',
        metricName: 'gematchte_zahlungen',
        metricValue: data.gematchteZahlungen,
        metricUnit: 'EUR',
      });
    }
    if (typeof data.offeneDifferenz === 'number') {
      kpis.push({
        workflowIntent: 'WORKFLOW_ZAHLUNGSABGLEICH',
        metricName: 'offene_differenz',
        metricValue: data.offeneDifferenz,
        metricUnit: 'EUR',
      });
    }
    return kpis;
  },
  WORKFLOW_MONATSREPORT: (data) => {
    const kpis: RecordKPIInput[] = [];
    if (typeof data.umsatzMonat === 'number') {
      kpis.push({
        workflowIntent: 'WORKFLOW_MONATSREPORT',
        metricName: 'umsatz_monat',
        metricValue: data.umsatzMonat,
        metricUnit: 'EUR',
      });
    }
    if (typeof data.ausgabenMonat === 'number') {
      kpis.push({
        workflowIntent: 'WORKFLOW_MONATSREPORT',
        metricName: 'ausgaben_monat',
        metricValue: data.ausgabenMonat,
        metricUnit: 'EUR',
      });
    }
    return kpis;
  },
  WORKFLOW_VERTRAGS_ERINNERUNG: (data) => {
    const kpis: RecordKPIInput[] = [];
    if (typeof data.ablaufendeVertraege === 'number') {
      kpis.push({
        workflowIntent: 'WORKFLOW_VERTRAGS_ERINNERUNG',
        metricName: 'ablaufende_vertraege',
        metricValue: data.ablaufendeVertraege,
        metricUnit: 'count',
      });
    }
    return kpis;
  },
};

/**
 * Workflow Analytics Service for tracking and analyzing workflow executions.
 */
export class WorkflowAnalyticsService {
  private prisma: PrismaClient;

  /**
   * Creates a new WorkflowAnalyticsService instance.
   *
   * @param prisma - The Prisma client instance
   */
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // ==================== Execution Recording ====================

  /**
   * Records a workflow execution and extracts KPIs from the response.
   *
   * @param input - The execution details to record
   * @returns The recorded execution ID
   */
  async recordExecution(input: RecordExecutionInput): Promise<string> {
    const id = this.generateId();
    const now = new Date().toISOString();

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO WorkflowExecution (
        id, workflowIntent, workflowName, triggeredAt, executionTimeMs,
        success, errorType, errorMessage, params, responseData
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.workflowIntent,
      input.workflowName,
      now,
      input.result.executionTimeMs,
      input.result.success ? 1 : 0,
      input.result.errorType ?? null,
      input.result.error ?? null,
      input.params ? JSON.stringify(input.params) : null,
      input.result.data ? JSON.stringify(input.result.data) : null
    );

    // Extract and record KPIs if successful
    if (input.result.success && input.result.data) {
      const extractor = KPI_EXTRACTORS[input.workflowIntent];
      if (extractor) {
        const kpis = extractor(input.result.data);
        for (const kpi of kpis) {
          await this.recordKPI(kpi);
        }
      }
    }

    return id;
  }

  /**
   * Records a KPI value.
   *
   * @param input - The KPI details to record
   * @returns The recorded KPI ID
   */
  async recordKPI(input: RecordKPIInput): Promise<string> {
    const id = this.generateId();
    const now = new Date().toISOString();

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO WorkflowKPI (
        id, workflowIntent, recordedAt, metricName, metricValue, metricUnit, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.workflowIntent,
      now,
      input.metricName,
      input.metricValue,
      input.metricUnit ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null
    );

    return id;
  }

  // ==================== Execution Queries ====================

  /**
   * Gets recent workflow executions.
   *
   * @param limit - Maximum number of executions to return
   * @param workflowIntent - Optional filter by workflow intent
   * @param onlyFailed - Optional filter for only failed executions
   * @returns List of recent executions
   */
  async getRecentExecutions(
    limit = 50,
    workflowIntent?: string,
    onlyFailed?: boolean
  ): Promise<WorkflowExecutionRecord[]> {
    let query = 'SELECT * FROM WorkflowExecution WHERE 1=1';
    const params: unknown[] = [];

    if (workflowIntent) {
      query += ' AND workflowIntent = ?';
      params.push(workflowIntent);
    }

    if (onlyFailed) {
      query += ' AND success = 0';
    }

    query += ' ORDER BY triggeredAt DESC LIMIT ?';
    params.push(limit);

    const results = await this.prisma.$queryRawUnsafe<WorkflowExecutionRecord[]>(query, ...params);

    return results.map((r) => ({
      ...r,
      success: Boolean(r.success),
      triggeredAt: new Date(r.triggeredAt),
    }));
  }

  /**
   * Gets execution statistics for a time range.
   *
   * @param startDate - Start of the time range
   * @param endDate - End of the time range
   * @param workflowIntent - Optional filter by workflow intent
   * @returns Execution statistics
   */
  async getExecutionStats(
    startDate: Date,
    endDate: Date,
    workflowIntent?: string
  ): Promise<ExecutionStats> {
    let query = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed,
        AVG(executionTimeMs) as avgTime
      FROM WorkflowExecution
      WHERE triggeredAt >= ? AND triggeredAt <= ?
    `;
    const params: unknown[] = [startDate.toISOString(), endDate.toISOString()];

    if (workflowIntent) {
      query += ' AND workflowIntent = ?';
      params.push(workflowIntent);
    }

    const results = await this.prisma.$queryRawUnsafe<
      Array<{ total: number; successful: number; failed: number; avgTime: number }>
    >(query, ...params);

    const result = results[0];
    const total = Number(result.total) || 0;
    const successful = Number(result.successful) || 0;

    return {
      totalExecutions: total,
      successfulExecutions: successful,
      failedExecutions: Number(result.failed) || 0,
      avgExecutionTimeMs: Number(result.avgTime) || 0,
      successRate: total > 0 ? (successful / total) * 100 : 0,
    };
  }

  /**
   * Gets daily execution counts for charts.
   *
   * @param days - Number of days to include
   * @returns Daily execution counts
   */
  async getDailyExecutionCounts(days = 30): Promise<DailyExecutionCount[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const results = await this.prisma.$queryRawUnsafe<
      Array<{ date: string; count: number; successCount: number; failureCount: number }>
    >(
      `
      SELECT
        DATE(triggeredAt) as date,
        COUNT(*) as count,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successCount,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failureCount
      FROM WorkflowExecution
      WHERE triggeredAt >= ?
      GROUP BY DATE(triggeredAt)
      ORDER BY date ASC
    `,
      startDate.toISOString()
    );

    return results.map((r) => ({
      date: r.date,
      count: Number(r.count),
      successCount: Number(r.successCount),
      failureCount: Number(r.failureCount),
    }));
  }

  /**
   * Gets success rates per workflow.
   *
   * @returns Success rates per workflow
   */
  async getWorkflowSuccessRates(): Promise<WorkflowSuccessRate[]> {
    const results = await this.prisma.$queryRawUnsafe<
      Array<{
        workflowIntent: string;
        workflowName: string;
        total: number;
        successful: number;
      }>
    >(`
      SELECT
        workflowIntent,
        workflowName,
        COUNT(*) as total,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful
      FROM WorkflowExecution
      GROUP BY workflowIntent, workflowName
      ORDER BY total DESC
    `);

    return results.map((r) => ({
      workflowIntent: r.workflowIntent,
      workflowName: r.workflowName,
      totalExecutions: Number(r.total),
      successRate: Number(r.total) > 0 ? (Number(r.successful) / Number(r.total)) * 100 : 0,
    }));
  }

  /**
   * Gets error type breakdown.
   *
   * @returns Error type breakdown
   */
  async getErrorTypeBreakdown(): Promise<ErrorTypeBreakdown[]> {
    const results = await this.prisma.$queryRawUnsafe<Array<{ errorType: string; count: number }>>(
      `
      SELECT
        COALESCE(errorType, 'UNKNOWN') as errorType,
        COUNT(*) as count
      FROM WorkflowExecution
      WHERE success = 0
      GROUP BY errorType
      ORDER BY count DESC
    `
    );

    const total = results.reduce((sum, r) => sum + Number(r.count), 0);

    return results.map((r) => ({
      errorType: r.errorType,
      count: Number(r.count),
      percentage: total > 0 ? (Number(r.count) / total) * 100 : 0,
    }));
  }

  // ==================== KPI Queries ====================

  /**
   * Gets the latest KPI values for display.
   *
   * @returns Latest KPI values
   */
  async getLatestKPIs(): Promise<LatestKPIs> {
    const getLatestValue = async (metricName: string): Promise<number> => {
      const results = await this.prisma.$queryRawUnsafe<Array<{ metricValue: number }>>(
        `
        SELECT metricValue FROM WorkflowKPI
        WHERE metricName = ?
        ORDER BY recordedAt DESC
        LIMIT 1
      `,
        metricName
      );
      return results[0]?.metricValue ?? 0;
    };

    return {
      offeneMahnungenEuro: await getLatestValue('offene_mahnungen_euro'),
      verarbeiteteRechnungen: await getLatestValue('verarbeitete_rechnungen'),
      gematchteZahlungen: await getLatestValue('gematchte_zahlungen'),
      ueberfaelligeVertraege: await getLatestValue('ablaufende_vertraege'),
    };
  }

  /**
   * Gets KPI history for a metric.
   *
   * @param metricName - The metric name
   * @param days - Number of days to include
   * @returns KPI history records
   */
  async getKPIHistory(metricName: string, days = 30): Promise<WorkflowKPIRecord[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const results = await this.prisma.$queryRawUnsafe<WorkflowKPIRecord[]>(
      `
      SELECT * FROM WorkflowKPI
      WHERE metricName = ? AND recordedAt >= ?
      ORDER BY recordedAt ASC
    `,
      metricName,
      startDate.toISOString()
    );

    return results.map((r) => ({
      ...r,
      recordedAt: new Date(r.recordedAt),
    }));
  }

  // ==================== Aggregation ====================

  /**
   * Updates aggregations for a given period.
   *
   * @param periodType - The period type (daily, weekly, monthly)
   */
  async updateAggregations(periodType: PeriodType): Promise<void> {
    const now = new Date();
    let periodStart: Date;

    switch (periodType) {
      case 'daily':
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        periodStart = new Date(now);
        periodStart.setDate(periodStart.getDate() - periodStart.getDay());
        periodStart.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    const periodEnd = new Date(periodStart);
    switch (periodType) {
      case 'daily':
        periodEnd.setDate(periodEnd.getDate() + 1);
        break;
      case 'weekly':
        periodEnd.setDate(periodEnd.getDate() + 7);
        break;
      case 'monthly':
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        break;
    }

    // Get all workflow intents that have executions in this period
    const intents = await this.prisma.$queryRawUnsafe<Array<{ workflowIntent: string }>>(
      `
      SELECT DISTINCT workflowIntent FROM WorkflowExecution
      WHERE triggeredAt >= ? AND triggeredAt < ?
    `,
      periodStart.toISOString(),
      periodEnd.toISOString()
    );

    for (const { workflowIntent } of intents) {
      const stats = await this.getExecutionStats(periodStart, periodEnd, workflowIntent);

      // Upsert aggregation
      const existing = await this.prisma.$queryRawUnsafe<WorkflowAggregationRecord[]>(
        `
        SELECT * FROM WorkflowAggregation
        WHERE workflowIntent = ? AND periodType = ? AND periodStart = ?
      `,
        workflowIntent,
        periodType,
        periodStart.toISOString()
      );

      if (existing.length > 0) {
        await this.prisma.$executeRawUnsafe(
          `
          UPDATE WorkflowAggregation
          SET executionCount = ?, successCount = ?, failureCount = ?, avgExecutionTimeMs = ?
          WHERE workflowIntent = ? AND periodType = ? AND periodStart = ?
        `,
          stats.totalExecutions,
          stats.successfulExecutions,
          stats.failedExecutions,
          stats.avgExecutionTimeMs,
          workflowIntent,
          periodType,
          periodStart.toISOString()
        );
      } else {
        const id = this.generateId();
        await this.prisma.$executeRawUnsafe(
          `
          INSERT INTO WorkflowAggregation (
            id, workflowIntent, periodType, periodStart,
            executionCount, successCount, failureCount, avgExecutionTimeMs
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
          id,
          workflowIntent,
          periodType,
          periodStart.toISOString(),
          stats.totalExecutions,
          stats.successfulExecutions,
          stats.failedExecutions,
          stats.avgExecutionTimeMs
        );
      }
    }
  }

  /**
   * Gets aggregations for a period type.
   *
   * @param periodType - The period type
   * @param limit - Maximum number of periods to return
   * @returns Aggregation records
   */
  async getAggregations(periodType: PeriodType, limit = 12): Promise<WorkflowAggregationRecord[]> {
    const results = await this.prisma.$queryRawUnsafe<WorkflowAggregationRecord[]>(
      `
      SELECT * FROM WorkflowAggregation
      WHERE periodType = ?
      ORDER BY periodStart DESC
      LIMIT ?
    `,
      periodType,
      limit
    );

    return results.map((r) => ({
      ...r,
      periodStart: new Date(r.periodStart),
    }));
  }

  // ==================== Utility ====================

  /**
   * Generates a unique CUID-like ID.
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `c${timestamp}${random}`;
  }
}
