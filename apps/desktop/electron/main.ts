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

import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { createWindowConfig } from './window-manager';
import {
  createInvoiceHandler,
  getCustomersHandler,
  getSettingsHandler,
  updateSettingsHandler,
  type IpcHandlerContext,
} from './ipc/handlers';
import { saveRecording, listRecordings, deleteRecording } from './ipc/voice-handlers';
import {
  getWorkflowKPIsHandler,
  getExecutionStatsHandler,
  getDailyCountsHandler,
  getSuccessRatesHandler,
  getErrorBreakdownHandler,
  getRecentExecutionsHandler,
  getTimelineInvoicesHandler,
  getTopCustomersHandler,
  triggerAggregationHandler,
} from './ipc/analytics-handlers';
import { ensureDatabaseExists, logDatabaseConfig, getDatabaseUrl } from './lib/database-path';

/**
 * Main application window reference.
 *
 * Kept in module scope to prevent garbage collection
 * and for future use (e.g., menu bar, tray icon).
 */
let mainWindow: BrowserWindow | null = null;

/**
 * Next.js standalone server process (production only).
 */
let nextServerProcess: ChildProcess | null = null;

/**
 * Port for the Next.js server.
 */
const NEXT_SERVER_PORT = 3000;

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
 * Starts the Next.js standalone server in production.
 *
 * @returns {Promise<void>} Resolves when server is ready
 */
async function startNextServer(): Promise<void> {
  if (isDev) return;

  // In a monorepo, Next.js standalone preserves the directory structure
  // Use app.getAppPath() for correct path resolution in packaged app
  const appPath = app.getAppPath();
  const serverPath = path.join(appPath, '.next', 'standalone', 'apps', 'desktop', 'server.js');

  // Check if standalone server exists
  if (!fs.existsSync(serverPath)) {
    console.error('Next.js standalone server not found at:', serverPath);
    throw new Error('Standalone server not found. Run "next build" first.');
  }

  return new Promise((resolve, reject) => {
    console.log('Starting Next.js standalone server...');

    // Get the correct writable database URL
    const databaseUrl = getDatabaseUrl();
    console.log('[Next.js] Using DATABASE_URL:', databaseUrl);

    nextServerProcess = spawn('node', [serverPath], {
      env: {
        ...process.env,
        PORT: String(NEXT_SERVER_PORT),
        HOSTNAME: 'localhost',
        DATABASE_URL: databaseUrl,
      },
      cwd: path.join(appPath, '.next', 'standalone', 'apps', 'desktop'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let serverReady = false;

    nextServerProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      console.log('[Next.js]', output);

      // Check if server is ready
      if (output.includes('Ready') || output.includes('started server')) {
        serverReady = true;
        resolve();
      }
    });

    nextServerProcess.stderr?.on('data', (data: Buffer) => {
      console.error('[Next.js Error]', data.toString());
    });

    nextServerProcess.on('error', (err) => {
      console.error('Failed to start Next.js server:', err);
      reject(err);
    });

    nextServerProcess.on('exit', (code) => {
      console.log('Next.js server exited with code:', code);
      nextServerProcess = null;
    });

    // Timeout: resolve anyway after 5 seconds (server might be ready without message)
    setTimeout(() => {
      if (!serverReady) {
        console.log('Server startup timeout - assuming ready');
        resolve();
      }
    }, 5000);
  });
}

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

  // Enable DevTools shortcut (Ctrl+Shift+I) in both dev and production
  win.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // Load the appropriate URL
  if (isDev) {
    // Development: Load from Next.js dev server
    const devServerUrl = process.env.ELECTRON_DEV_URL ?? 'http://localhost:3002';
    win.loadURL(devServerUrl);

    // Open DevTools in development
    win.webContents.openDevTools();
  } else {
    // Production: Load from Next.js standalone server
    const serverUrl = `http://localhost:${NEXT_SERVER_PORT}`;
    win.loadURL(serverUrl);
  }

  return win;
}

// Mock Database Implementation for UI Demo
// In a real app, this would import @voiceinvoice/database
const databaseOperations = {
  createInvoice: async (data: unknown) => {
    console.log('Mock DB: createInvoice', data);
    return { id: 'mock-id', ...(data as object) };
  },
  getCustomers: async () => {
    return [
      { id: 'c1', companyName: 'Acme Corp', type: 'CUSTOMER' },
      { id: 'c2', companyName: 'Globex', type: 'SUPPLIER' },
    ];
  },
  getSettings: async () => {
    return { privacyMode: 'STRICT', n8nEnabled: false };
  },
  updateSettings: async (data: unknown) => {
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
  // Analytics handlers
  ipcMain.handle('analytics:getKPIs', () => getWorkflowKPIsHandler());
  ipcMain.handle('analytics:getStats', (_event, startDate, endDate, workflowIntent) =>
    getExecutionStatsHandler(startDate, endDate, workflowIntent)
  );
  ipcMain.handle('analytics:getDailyCounts', (_event, days) => getDailyCountsHandler(days));
  ipcMain.handle('analytics:getSuccessRates', () => getSuccessRatesHandler());
  ipcMain.handle('analytics:getErrorBreakdown', () => getErrorBreakdownHandler());
  ipcMain.handle('analytics:getRecentExecutions', (_event, limit, workflowIntent) =>
    getRecentExecutionsHandler(limit, workflowIntent)
  );
  ipcMain.handle('analytics:getTimelineInvoices', () => getTimelineInvoicesHandler());
  ipcMain.handle('analytics:getTopCustomers', (_event, limit) => getTopCustomersHandler(limit));
  ipcMain.handle('analytics:triggerAggregation', () => triggerAggregationHandler());

  // File handlers
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

// App lifecycle
app.whenReady().then(async () => {
  // Initialize database before setting up handlers
  logDatabaseConfig();
  await ensureDatabaseExists();

  setupHandlers();

  // Start Next.js server in production before creating window
  try {
    await startNextServer();
  } catch (err) {
    console.error('Failed to start Next.js server:', err);
    dialog.showErrorBox(
      'Server Error',
      'Failed to start the application server. Please try again.'
    );
    app.quit();
    return;
  }

  mainWindow = createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
  // Check for updates in production
  if (!isDev) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { autoUpdater } = require('electron-updater');
    console.log('Checking for updates...');

    // Allow prereleases (e.g. beta)
    autoUpdater.allowPrerelease = true;

    // Check and notify
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    autoUpdater.checkForUpdatesAndNotify().catch((err: any) => {
      console.error('Failed to check for updates:', err);
    });
  }
});
app.on('window-all-closed', () => {
  // Stop Next.js server when all windows are closed
  if (nextServerProcess) {
    console.log('Stopping Next.js server...');
    nextServerProcess.kill();
    nextServerProcess = null;
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup on app quit
app.on('will-quit', () => {
  if (nextServerProcess) {
    nextServerProcess.kill();
    nextServerProcess = null;
  }
});

// Security: Disable navigation to external URLs
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    const allowedOrigins = [
      'http://localhost:3002', // Dev server
      `http://localhost:${NEXT_SERVER_PORT}`, // Production server
    ];
    const isAllowed = allowedOrigins.includes(parsedUrl.origin) || url.startsWith('file://');

    if (!isAllowed) {
      console.warn('[Security] Blocked navigation to:', url);
      event.preventDefault();
    }
  });
});
