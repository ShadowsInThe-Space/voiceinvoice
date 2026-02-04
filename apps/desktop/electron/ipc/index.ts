/**
 * IPC Handler Registration Hub.
 *
 * Aggregates all IPC modules and registers them with the context.
 *
 * @module electron/ipc/index
 */

import { type IpcHandlerContext } from '../context';
import { registerInvoiceHandlers } from './invoices';
import { registerSettingsHandlers } from './settings';
import { registerVoiceHandlers } from './voice';
import { registerAnalyticsHandlers } from './analytics';
import { registerFileHandlers } from './files';

/**
 *
 * @param context
 */
export function registerIpcHandlers(context: IpcHandlerContext): void {
  registerInvoiceHandlers(context);
  registerSettingsHandlers(context);
  registerVoiceHandlers(context);
  registerAnalyticsHandlers(context);
  registerFileHandlers(context);
}
