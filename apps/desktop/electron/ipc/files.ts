import { ipcMain, dialog } from 'electron';
import * as fs from 'fs';
import { type IpcHandlerContext } from '../context';

/**
 *
 * @param _context
 */
export function registerFileHandlers(_context: IpcHandlerContext): void {
  ipcMain.handle(
    'file:saveFile',
    async (
      _event,
      content: string,
      defaultFilename: string,
      filters: { name: string; extensions: string[] }[]
    ) => {
      try {
        const result = await dialog.showSaveDialog({
          defaultPath: defaultFilename,
          filters: filters,
        });

        if (result.canceled || !result.filePath) {
          return false;
        }

        // Check if content is base64 (for binary files like PDFs)
        // Base64 strings only contain A-Z, a-z, 0-9, +, /, and = padding
        const isBase64 = /^[A-Za-z0-9+/=]+$/.test(content) && content.length > 100;

        if (isBase64) {
          // Decode base64 to binary buffer
          const buffer = Buffer.from(content, 'base64');
          fs.writeFileSync(result.filePath, buffer);
        } else {
          // Write as UTF-8 text
          fs.writeFileSync(result.filePath, content, 'utf-8');
        }

        return true;
      } catch (error) {
        console.error('Error saving file:', error);
        return false;
      }
    }
  );
}
