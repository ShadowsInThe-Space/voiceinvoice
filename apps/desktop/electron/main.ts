/**
 * Electron Main Process for VoiceInvoice Enterprise.
 *
 * This is the entry point for the Electron application.
 * It handles:
 * - Application lifecycle (ready, window-all-closed, activate)
 * - Window creation and management
 * - IPC handler registration
 * - Next.js integration (loads rendered pages)
 *
 * @module electron/main
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { createWindowConfig } from './window-manager';
import {
  createInvoiceHandler,
  getCustomersHandler,
  getSettingsHandler,
  updateSettingsHandler,
  type IpcHandlerContext,
} from './ipc/handlers';
import { saveRecording, listRecordings, deleteRecording } from './ipc/voice-handlers';

/**
 * Main application window reference.
 *
 * Kept in module scope to prevent garbage collection
 * and for future use (e.g., menu bar, tray icon).
 */
let mainWindow: BrowserWindow | null = null;

/**
 * Returns the main window instance.
 *
 * @returns {BrowserWindow | null} The main window or null
 */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/**
 * Whether the app is running in development mode.
 */
const isDev = process.env.NODE_ENV === 'development';

/**
 * Path to the preload script.
 */
const preloadPath = path.join(__dirname, 'preload.js');

/**
 * Creates the main application window.
 *
 * Sets up the BrowserWindow with secure defaults and
 * loads either the dev server or production build.
 *
 * @returns {BrowserWindow} The created window
 */
function createMainWindow(): BrowserWindow {
  const config = createWindowConfig(
    {
      title: 'VoiceInvoice Enterprise',
      width: 1280,
      height: 800,
      show: false, // Show after ready-to-show
    },
    preloadPath
  );

  // Cast to satisfy exactOptionalPropertyTypes with Electron types
  const win = new BrowserWindow(config as Electron.BrowserWindowConstructorOptions);

  // Show window when ready to prevent visual flash
  win.once('ready-to-show', () => {
    win.show();
  });

  // Handle window closed
  win.on('closed', () => {
    mainWindow = null;
  });

  // Load the appropriate URL
  if (isDev) {
    // Development: Load from Next.js dev server
    const devServerUrl = process.env.ELECTRON_DEV_URL ?? 'http://localhost:3000';
    win.loadURL(devServerUrl);

    // Open DevTools in development
    win.webContents.openDevTools();
  } else {
    // Production: Load from exported Next.js build
    const indexPath = path.join(__dirname, '..', 'out', 'index.html');
    win.loadFile(indexPath);
  }

  return win;
}

/**
 * Creates the IPC handler context.
 *
 * This context provides dependencies to IPC handlers.
 * Currently uses a placeholder database that will be
 * replaced with the real Prisma client in Subagent #4.
 *
 * @returns {IpcHandlerContext} The handler context
 */
function createHandlerContext(): IpcHandlerContext {
  // Placeholder database operations - will be replaced in Subagent #4
  const database = {
    createInvoice: async (data: unknown): Promise<unknown> => {
      console.log('[Database] Creating invoice:', data);
      return {
        id: `inv-${Date.now()}`,
        ...(data as Record<string, unknown>),
        status: 'DRAFT',
        createdAt: new Date(),
      };
    },
    getCustomers: async (): Promise<unknown[]> => {
      console.log('[Database] Getting customers');
      return [];
    },
    getSettings: async (): Promise<unknown> => {
      console.log('[Database] Getting settings');
      return null;
    },
    updateSettings: async (data: unknown): Promise<unknown> => {
      console.log('[Database] Updating settings:', data);
      return data;
    },
  };

  return { database };
}

/**
 * Registers all IPC handlers.
 *
 * Sets up the communication bridge between the renderer
 * process and the main process.
 *
 * @param {IpcHandlerContext} context - The handler context
 */
function registerIpcHandlers(context: IpcHandlerContext): void {
  // Invoice handlers
  ipcMain.handle('invoice:create', async (_event, data) => {
    return createInvoiceHandler(context, data);
  });

  ipcMain.handle('invoice:getAll', async () => {
    // Will be implemented in Subagent #4
    return { success: true, data: [] };
  });

  ipcMain.handle('invoice:getById', async (_event, _id) => {
    // Will be implemented in Subagent #4
    return { success: false, error: { message: 'Not implemented' } };
  });

  ipcMain.handle('invoice:update', async (_event, _id, _data) => {
    // Will be implemented in Subagent #4
    return { success: false, error: { message: 'Not implemented' } };
  });

  ipcMain.handle('invoice:delete', async (_event, _id) => {
    // Will be implemented in Subagent #4
    return { success: false, error: { message: 'Not implemented' } };
  });

  // Customer handlers
  ipcMain.handle('customer:getAll', async () => {
    return getCustomersHandler(context);
  });

  ipcMain.handle('customer:create', async (_event, _data) => {
    // Will be implemented in Subagent #4
    return { success: false, error: { message: 'Not implemented' } };
  });

  ipcMain.handle('customer:getById', async (_event, _id) => {
    // Will be implemented in Subagent #4
    return { success: false, error: { message: 'Not implemented' } };
  });

  ipcMain.handle('customer:update', async (_event, _id, _data) => {
    // Will be implemented in Subagent #4
    return { success: false, error: { message: 'Not implemented' } };
  });

  ipcMain.handle('customer:delete', async (_event, _id) => {
    // Will be implemented in Subagent #4
    return { success: false, error: { message: 'Not implemented' } };
  });

  // Settings handlers
  ipcMain.handle('settings:get', async () => {
    return getSettingsHandler(context);
  });

  ipcMain.handle('settings:update', async (_event, data) => {
    return updateSettingsHandler(context, data);
  });

  // Voice handlers
  ipcMain.handle('voice:startRecording', async () => {
    // Recording is handled in renderer process
    // Main process just acknowledges the start
    return { success: true };
  });

  ipcMain.handle('voice:stopRecording', async () => {
    // Recording result is sent separately via voice:saveRecording
    return { success: true, data: { transcription: '' } };
  });

  ipcMain.handle(
    'voice:saveRecording',
    async (_event, audioData: ArrayBuffer, duration: number, mimeType: string) => {
      return saveRecording(audioData, duration, mimeType);
    }
  );

  ipcMain.handle('voice:getRecordings', async () => {
    const recordings = await listRecordings();
    return { success: true, data: recordings };
  });

  ipcMain.handle('voice:deleteRecording', async (_event, filePath: string) => {
    const deleted = await deleteRecording(filePath);
    return { success: deleted };
  });

  // App info handlers
  ipcMain.handle('app:getVersion', async () => {
    return app.getVersion();
  });

  ipcMain.handle('app:getPlatform', async () => {
    return process.platform;
  });
}

/**
 * Application ready handler.
 *
 * Called when Electron has finished initialization and
 * is ready to create browser windows.
 */
async function onAppReady(): Promise<void> {
  // Create handler context
  const context = createHandlerContext();

  // Register IPC handlers
  registerIpcHandlers(context);

  // Create main window
  mainWindow = createMainWindow();

  console.log('VoiceInvoice Enterprise started');
}

/**
 * All windows closed handler.
 *
 * Quits the app on Windows/Linux, but not on macOS
 * where apps typically stay active until explicitly quit.
 */
function onWindowAllClosed(): void {
  if (process.platform !== 'darwin') {
    app.quit();
  }
}

/**
 * Activate handler (macOS).
 *
 * Recreates the window when the dock icon is clicked
 * and no windows are open.
 */
function onActivate(): void {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow();
  }
}

// Application lifecycle handlers
app.whenReady().then(onAppReady);
app.on('window-all-closed', onWindowAllClosed);
app.on('activate', onActivate);

// Security: Disable navigation to external URLs
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    const isAllowed = parsedUrl.origin === 'http://localhost:3000' || url.startsWith('file://');

    if (!isAllowed) {
      console.warn('[Security] Blocked navigation to:', url);
      event.preventDefault();
    }
  });
});
