/**
 * Electron Preload Script for VoiceInvoice Desktop.
 *
 * This script runs in a privileged context before the renderer
 * process loads. It exposes a safe API to the renderer via
 * contextBridge, preventing direct access to Node.js APIs.
 *
 * Security Note: Only expose necessary APIs through contextBridge.
 * Never expose ipcRenderer directly to the renderer process.
 *
 * @module electron/preload
 */

import { contextBridge, ipcRenderer } from 'electron';
import { createPreloadApi } from './preload-api';

/**
 * Create the preload API using ipcRenderer.invoke
 */
const api = createPreloadApi(ipcRenderer.invoke.bind(ipcRenderer));

/**
 * Expose the API to the renderer process.
 *
 * In the renderer, this will be available as window.voiceinvoice
 *
 * @example
 * // In React component
 * const invoices = await window.voiceinvoice.invoice.getAll();
 */
contextBridge.exposeInMainWorld('voiceinvoice', api);

/**
 * Type declaration for the global window object.
 *
 * Adds TypeScript support for the exposed API.
 */
declare global {
  interface Window {
    voiceinvoice: typeof api;
  }
}
