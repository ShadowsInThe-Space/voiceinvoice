import { ipcMain } from 'electron';
import { type IpcHandlerContext } from '../context';
import { saveRecording, listRecordings, deleteRecording } from './voice-handlers';

/**
 *
 * @param _context
 */
export function registerVoiceHandlers(_context: IpcHandlerContext): void {
  ipcMain.handle('voice:save-recording', (_event, audioData, duration, mimeType) =>
    saveRecording(audioData, duration, mimeType)
  );
  ipcMain.handle('voice:list-recordings', () => listRecordings());
  ipcMain.handle('voice:delete-recording', (_event, filePath) => deleteRecording(filePath));
}
