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
  };
}
