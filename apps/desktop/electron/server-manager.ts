/**
 * Server Manager for Next.js Standalone Process.
 *
 * Handles starting and stopping the Next.js server child process.
 *
 * @module electron/server-manager
 */

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { getDatabaseUrl } from './lib/database-path';

const NEXT_SERVER_PORT = 3000;
const isDev = process.env.NODE_ENV === 'development';

/**
 *
 */
export class ServerManager {
  private static instance: ServerManager;
  private nextServerProcess: ChildProcess | null = null;
  private logPath: string;

  private constructor() {
    this.logPath = path.join(app.getPath('userData'), 'electron-startup.log');
  }

  /**
   *
   */
  public static getInstance(): ServerManager {
    if (!ServerManager.instance) {
      ServerManager.instance = new ServerManager();
    }
    return ServerManager.instance;
  }

  private log(msg: string): void {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(this.logPath, `[${timestamp}] ${msg}\n`);
    console.log(msg);
  }

  /**
   *
   */
  public get port(): number {
    return NEXT_SERVER_PORT;
  }

  /**
   *
   */
  public get isProduction(): boolean {
    return !isDev;
  }

  /**
   * Starts the Next.js standalone server if in production mode.
   */
  public async start(): Promise<void> {
    if (isDev) return;

    const appPath = app.getAppPath();
    const serverPath = path.join(appPath, '.next', 'standalone', 'apps', 'desktop', 'server.js');

    this.log(`=== Electron Server Manager ===`);
    this.log(`Attempting to start server at: ${serverPath}`);

    if (!fs.existsSync(serverPath)) {
      this.log(`ERROR: Next.js standalone server not found.`);
      throw new Error('Standalone server not found. Run "next build" first.');
    }

    return new Promise((resolve, reject) => {
      const databaseUrl = getDatabaseUrl();
      const cwd = path.join(appPath, '.next', 'standalone', 'apps', 'desktop');

      try {
        this.nextServerProcess = spawn('node', [serverPath], {
          env: {
            ...process.env,
            PORT: String(NEXT_SERVER_PORT),
            HOSTNAME: 'localhost',
            DATABASE_URL: databaseUrl,
          },
          cwd,
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        this.log('[Next.js] Child process spawned successfully');
      } catch (spawnErr) {
        this.log(`[Next.js] Spawn ERROR: ${spawnErr}`);
        throw spawnErr;
      }

      let serverReady = false;

      this.nextServerProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        this.log(`[Next.js STDOUT] ${output}`);

        if (output.includes('Ready') || output.includes('started server')) {
          serverReady = true;
          this.log('[Next.js] Server is READY');
          resolve();
        }
      });

      this.nextServerProcess.stderr?.on('data', (data: Buffer) => {
        this.log(`[Next.js STDERR] ${data.toString()}`);
      });

      this.nextServerProcess.on('error', (err) => {
        this.log(`[Next.js] Process ERROR: ${err.message}`);
        reject(err);
      });

      this.nextServerProcess.on('exit', (code) => {
        this.log(`[Next.js] Process exited with code: ${code}`);
        this.nextServerProcess = null;
      });

      // Fallback timeout
      setTimeout(() => {
        if (!serverReady) {
          this.log('Server startup timeout - assuming ready');
          resolve();
        }
      }, 5000);
    });
  }

  /**
   * Stops the Next.js server process.
   */
  public stop(): void {
    if (this.nextServerProcess) {
      this.log('Stopping Next.js server...');
      this.nextServerProcess.kill();
      this.nextServerProcess = null;
    }
  }
}
