import { ipcMain } from 'electron';
import { type IpcHandlerContext } from '../context';
import { createInvoiceHandler, getCustomersHandler } from './handlers';

/**
 *
 * @param context
 */
export function registerInvoiceHandlers(context: IpcHandlerContext): void {
  ipcMain.handle('invoice:create', (_event, data) => createInvoiceHandler(context, data));
  ipcMain.handle('customer:list', () => getCustomersHandler(context));
}
