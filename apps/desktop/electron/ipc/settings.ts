import { ipcMain } from 'electron';
import { type IpcHandlerContext } from '../context';
import { getSettingsHandler, updateSettingsHandler } from './handlers';

/**
 *
 * @param context
 */
export function registerSettingsHandlers(context: IpcHandlerContext): void {
  ipcMain.handle('settings:get', () => getSettingsHandler(context));
  ipcMain.handle('settings:update', (_event, data) => updateSettingsHandler(context, data));
}
