import { ipcMain } from 'electron';
import { type IpcHandlerContext } from '../context';
import {
  getWorkflowKPIsHandler,
  getExecutionStatsHandler,
  getDailyCountsHandler,
  getSuccessRatesHandler,
  getErrorBreakdownHandler,
  getRecentExecutionsHandler,
  getTimelineInvoicesHandler,
  getTopCustomersHandler,
  triggerAggregationHandler,
} from './analytics-handlers';

/**
 *
 * @param _context
 */
export function registerAnalyticsHandlers(_context: IpcHandlerContext): void {
  ipcMain.handle('analytics:getKPIs', () => getWorkflowKPIsHandler());
  ipcMain.handle('analytics:getStats', (_event, startDate, endDate, workflowIntent) =>
    getExecutionStatsHandler(startDate, endDate, workflowIntent)
  );
  ipcMain.handle('analytics:getDailyCounts', (_event, days) => getDailyCountsHandler(days));
  ipcMain.handle('analytics:getSuccessRates', () => getSuccessRatesHandler());
  ipcMain.handle('analytics:getErrorBreakdown', () => getErrorBreakdownHandler());
  ipcMain.handle('analytics:getRecentExecutions', (_event, limit, workflowIntent) =>
    getRecentExecutionsHandler(limit, workflowIntent)
  );
  ipcMain.handle('analytics:getTimelineInvoices', () => getTimelineInvoicesHandler());
  ipcMain.handle('analytics:getTopCustomers', (_event, limit) => getTopCustomersHandler(limit));
  ipcMain.handle('analytics:triggerAggregation', () => triggerAggregationHandler());
}
