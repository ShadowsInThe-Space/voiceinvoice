/**
 * Type declarations for Electron IPC API.
 *
 * Provides TypeScript support for the window.voiceinvoice API
 * exposed by the preload script.
 *
 * @module types/electron
 */

import type { PreloadApi } from '../../electron/preload-api';

declare global {
  interface Window {
    /**
     * VoiceInvoice API exposed by the Electron preload script.
     *
     * Available only when running in Electron context.
     * Check for existence before using in web-only contexts.
     *
     * @example
     * if (window.voiceinvoice) {
     *   const invoices = await window.voiceinvoice.invoice.getAll();
     * }
     */
    voiceinvoice: PreloadApi;
  }
}

export {};
