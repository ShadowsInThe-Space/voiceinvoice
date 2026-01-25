/**
 * Database module exports.
 *
 * @module lib/database
 */

export {
  DatabaseService,
  type InvoiceStatus,
  type CreateCustomerInput,
  type UpdateCustomerInput,
  type CreateInvoiceItemInput,
  type CreateInvoiceInput,
  type UpdateInvoiceInput,
  type InvoiceWithRelations,
  type InvoiceStatistics,
} from './database-service';

export {
  WorkflowAnalyticsService,
  type WorkflowExecutionRecord,
  type WorkflowKPIRecord,
  type WorkflowAggregationRecord,
  type PeriodType,
  type RecordExecutionInput,
  type RecordKPIInput,
  type LatestKPIs,
  type ExecutionStats,
  type DailyExecutionCount,
  type WorkflowSuccessRate,
  type ErrorTypeBreakdown,
} from './workflow-analytics';
