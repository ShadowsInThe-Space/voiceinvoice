/**
 * Preload API factory for VoiceInvoice Desktop.
 *
 * Creates the API object that will be exposed to the renderer
 * process via contextBridge. This module is designed to be
 * testable without Electron dependencies.
 *
 * @module electron/preload-api
 */

/**
 * Type for the IPC invoker function.
 *
 * Abstraction that allows testing without Electron's ipcRenderer.
 */
export type IpcInvoker = (channel: string, ...args: unknown[]) => Promise<unknown>;

/**
 * Invoice API exposed to renderer.
 */
export interface InvoiceApi {
  create: (data: unknown) => Promise<unknown>;
  getAll: () => Promise<unknown>;
  getById: (id: string) => Promise<unknown>;
  update: (id: string, data: unknown) => Promise<unknown>;
  delete: (id: string) => Promise<unknown>;
}

/**
 * Customer API exposed to renderer.
 */
export interface CustomerApi {
  create: (data: unknown) => Promise<unknown>;
  getAll: () => Promise<unknown>;
  getById: (id: string) => Promise<unknown>;
  update: (id: string, data: unknown) => Promise<unknown>;
  delete: (id: string) => Promise<unknown>;
}

/**
 * Settings API exposed to renderer.
 */
export interface SettingsApi {
  get: () => Promise<unknown>;
  update: (data: unknown) => Promise<unknown>;
}

/**
 * Voice API exposed to renderer.
 */
export interface VoiceApi {
  startRecording: () => Promise<unknown>;
  stopRecording: () => Promise<unknown>;
  saveRecording: (audioData: ArrayBuffer, duration: number, mimeType: string) => Promise<unknown>;
  getRecordings: () => Promise<unknown>;
  deleteRecording: (filePath: string) => Promise<unknown>;
}

/**
 * App info API exposed to renderer.
 */
export interface AppApi {
  getVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
}

/**
/**
 * Analytics API exposed to renderer.
 */
export interface AnalyticsApi {
  getKPIs: () => Promise<unknown>;
  getStats: (startDate?: string, endDate?: string, workflowIntent?: string) => Promise<unknown>;
  getDailyCounts: (days?: number) => Promise<unknown>;
  getSuccessRates: () => Promise<unknown>;
  getErrorBreakdown: () => Promise<unknown>;
  getRecentExecutions: (limit?: number, workflowIntent?: string) => Promise<unknown>;
  getTimelineInvoices: () => Promise<unknown>;
  getTopCustomers: (limit?: number) => Promise<unknown>;
  triggerAggregation: () => Promise<unknown>;
}

/**
 * File API for saving files via Electron dialog.
 */
export interface FileApi {
  saveFile: (
    content: string,
    defaultFilename: string,
    filters: { name: string; extensions: string[] }[]
  ) => Promise<boolean>;
}

/**
 * Banking API for CSV import and invoice matching.
 */
export interface BankingApi {
  selectCsvFiles: () => Promise<unknown>;
  selectFolder: () => Promise<unknown>;
  importCsv: (filePath: string) => Promise<unknown>;
  getAllTransactions: () => Promise<unknown>;
  getUnmatchedTransactions: () => Promise<unknown>;
  findMatches: (transactionId: string) => Promise<unknown>;
  confirmMatch: (transactionId: string, invoiceId: string, confidence: number) => Promise<unknown>;
}

/**
 * Sync API for offline-first synchronization.
 */
export interface SyncApi {
  getStatus: () => Promise<unknown>;
  trigger: () => Promise<{ success: boolean; error?: string }>;
  start: () => Promise<{ success: boolean }>;
  stop: () => Promise<{ success: boolean }>;
  getPendingCount: () => Promise<number>;
  queueChange: (params: {
    entityType: 'customer' | 'invoice' | 'category' | 'recording';
    entityId: string;
    operation: 'CREATE' | 'UPDATE' | 'DELETE';
    data: Record<string, unknown>;
  }) => Promise<{ success: boolean; entryId?: string }>;
}

/**
 * Complete Preload API interface.
 *
 * This is the full API exposed to the renderer process
 * via contextBridge.
 */
export interface PreloadApi {
  invoice: InvoiceApi;
  customer: CustomerApi;
  settings: SettingsApi;
  voice: VoiceApi;
  app: AppApi;
  file: FileApi;
  analytics: AnalyticsApi;
  banking: BankingApi;
  sync: SyncApi;
}

/**
 * Creates the preload API with the given IPC invoker.
 *
 * This factory function allows the API to be created with
 * either the real ipcRenderer.invoke or a mock for testing.
 *
 * @param {IpcInvoker} invoke - Function to invoke IPC channels
 * @returns {PreloadApi} The complete preload API
 *
 * @example
 * // In preload.ts (production)
 * const api = createPreloadApi(ipcRenderer.invoke.bind(ipcRenderer));
 * contextBridge.exposeInMainWorld('voiceinvoice', api);
 *
 * @example
 * // In tests
 * const mockInvoke = vi.fn();
 * const api = createPreloadApi(mockInvoke);
 */
export function createPreloadApi(invoke: IpcInvoker): PreloadApi {
  return {
    invoice: {
      create: (data: unknown) => invoke('invoice:create', data),
      getAll: () => invoke('invoice:getAll'),
      getById: (id: string) => invoke('invoice:getById', id),
      update: (id: string, data: unknown) => invoke('invoice:update', id, data),
      delete: (id: string) => invoke('invoice:delete', id),
    },

    customer: {
      create: (data: unknown) => invoke('customer:create', data),
      getAll: () => invoke('customer:getAll'),
      getById: (id: string) => invoke('customer:getById', id),
      update: (id: string, data: unknown) => invoke('customer:update', id, data),
      delete: (id: string) => invoke('customer:delete', id),
    },

    settings: {
      get: () => invoke('settings:get'),
      update: (data: unknown) => invoke('settings:update', data),
    },

    voice: {
      startRecording: () => invoke('voice:startRecording'),
      stopRecording: () => invoke('voice:stopRecording'),
      saveRecording: (audioData: ArrayBuffer, duration: number, mimeType: string) =>
        invoke('voice:saveRecording', audioData, duration, mimeType),
      getRecordings: () => invoke('voice:getRecordings'),
      deleteRecording: (filePath: string) => invoke('voice:deleteRecording', filePath),
    },

    app: {
      getVersion: () => invoke('app:getVersion') as Promise<string>,
      getPlatform: () => invoke('app:getPlatform') as Promise<string>,
    },

    file: {
      saveFile: (
        content: string,
        defaultFilename: string,
        filters: { name: string; extensions: string[] }[]
      ) => invoke('file:saveFile', content, defaultFilename, filters) as Promise<boolean>,
    },
    analytics: {
      getKPIs: () => invoke('analytics:getKPIs'),
      getStats: (startDate?: string, endDate?: string, workflowIntent?: string) =>
        invoke('analytics:getStats', startDate, endDate, workflowIntent),
      getDailyCounts: (days?: number) => invoke('analytics:getDailyCounts', days),
      getSuccessRates: () => invoke('analytics:getSuccessRates'),
      getErrorBreakdown: () => invoke('analytics:getErrorBreakdown'),
      getRecentExecutions: (limit?: number, workflowIntent?: string) =>
        invoke('analytics:getRecentExecutions', limit, workflowIntent),
      getTimelineInvoices: () => invoke('analytics:getTimelineInvoices'),
      getTopCustomers: (limit?: number) => invoke('analytics:getTopCustomers', limit),
      triggerAggregation: () => invoke('analytics:triggerAggregation'),
    },

    banking: {
      selectCsvFiles: () => invoke('banking:selectCsvFiles'),
      selectFolder: () => invoke('banking:selectFolder'),
      importCsv: (filePath: string) => invoke('banking:importCsv', filePath),
      getAllTransactions: () => invoke('banking:getAllTransactions'),
      getUnmatchedTransactions: () => invoke('banking:getUnmatchedTransactions'),
      findMatches: (transactionId: string) => invoke('banking:findMatches', transactionId),
      confirmMatch: (transactionId: string, invoiceId: string, confidence: number) =>
        invoke('banking:confirmMatch', transactionId, invoiceId, confidence),
    },

    sync: {
      getStatus: () => invoke('sync:getStatus'),
      trigger: () => invoke('sync:trigger') as Promise<{ success: boolean; error?: string }>,
      start: () => invoke('sync:start') as Promise<{ success: boolean }>,
      stop: () => invoke('sync:stop') as Promise<{ success: boolean }>,
      getPendingCount: () => invoke('sync:getPendingCount') as Promise<number>,
      queueChange: (params: {
        entityType: 'customer' | 'invoice' | 'category' | 'recording';
        entityId: string;
        operation: 'CREATE' | 'UPDATE' | 'DELETE';
        data: Record<string, unknown>;
      }) => invoke('sync:queueChange', params) as Promise<{ success: boolean; entryId?: string }>,
    },
  };
}
