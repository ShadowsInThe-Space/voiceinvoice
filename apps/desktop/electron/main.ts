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
import { getGoogleApiKey, getN8nChatWebhook, getN8nIngestWebhook } from './ipc/env-handlers';

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
    const devServerUrl = process.env.ELECTRON_DEV_URL ?? 'http://localhost:3002';
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

// Mock Database Implementation for UI Demo
// In a real app, this would import @voiceinvoice/database
const databaseOperations = {
  createInvoice: async (data: unknown): Promise<{ id: string; [key: string]: unknown }> => {
    console.log('Mock DB: createInvoice', data);
    return { id: 'mock-id', ...(data as object) };
  },
  getCustomers: async (): Promise<Array<{ id: string; companyName: string; type: string }>> => {
    return [
      { id: 'c1', companyName: 'Acme Corp', type: 'CUSTOMER' },
      { id: 'c2', companyName: 'Globex', type: 'SUPPLIER' },
    ];
  },
  getSettings: async (): Promise<{ privacyMode: string; n8nEnabled: boolean }> => {
    return { privacyMode: 'STRICT', n8nEnabled: false };
  },
  updateSettings: async (data: unknown): Promise<unknown> => {
    console.log('Mock DB: updateSettings', data);
    return data;
  },
};

const context: IpcHandlerContext = {
  database: databaseOperations,
};

// Setup handlers
function setupHandlers(): void {
  // Invoice handlers
  ipcMain.handle('invoice:create', (_event, data) => createInvoiceHandler(context, data));
  ipcMain.handle('customer:list', () => getCustomersHandler(context));

  // Settings handlers
  ipcMain.handle('settings:get', () => getSettingsHandler(context));
  ipcMain.handle('settings:update', (_event, data) => updateSettingsHandler(context, data));

  // Voice handlers
  ipcMain.handle('voice:save-recording', (_event, audioData, duration, mimeType) =>
    saveRecording(audioData, duration, mimeType)
  );
  ipcMain.handle('voice:list-recordings', () => listRecordings());
  ipcMain.handle('voice:delete-recording', (_event, filePath) => deleteRecording(filePath));

  // Environment configuration handlers
  ipcMain.handle('env:getGoogleApiKey', () => getGoogleApiKey());
  ipcMain.handle('env:getN8nChatWebhook', () => getN8nChatWebhook());
  ipcMain.handle('env:getN8nIngestWebhook', () => getN8nIngestWebhook());
}

// App lifecycle
app.whenReady().then(() => {
  setupHandlers();
  mainWindow = createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Disable navigation to external URLs
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    const isAllowed = parsedUrl.origin === 'http://localhost:3002' || url.startsWith('file://');

    if (!isAllowed) {
      console.warn('[Security] Blocked navigation to:', url);
      event.preventDefault();
    }
  });
});
