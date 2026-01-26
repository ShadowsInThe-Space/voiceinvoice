/**
 * Database Path Utilities for Electron.
 *
 * Provides correct database path resolution for both development
 * and production (packaged) Electron apps.
 *
 * @module electron/lib/database-path
 */

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Database filename.
 */
const DB_FILENAME = 'voiceinvoice.db';

/**
 * Whether we're in development mode.
 */
const isDev = process.env.NODE_ENV === 'development';

/**
 * Gets the correct database directory path.
 *
 * - Development: ./prisma/data/ (relative to project)
 * - Production: userData directory (~/.config/VoiceInvoice Enterprise/ on Linux)
 *
 * @returns {string} The database directory path
 */
export function getDatabaseDir(): string {
  if (isDev) {
    // Development: use local prisma/data directory
    return path.join(process.cwd(), 'prisma', 'data');
  }

  // Production: use userData directory
  return path.join(app.getPath('userData'), 'data');
}

/**
 * Gets the full database file path.
 *
 * @returns {string} The database file path
 */
export function getDatabasePath(): string {
  return path.join(getDatabaseDir(), DB_FILENAME);
}

/**
 * Gets the Prisma-compatible database URL.
 *
 * @returns {string} The database URL (file:... format)
 */
export function getDatabaseUrl(): string {
  return `file:${getDatabasePath()}`;
}

/**
 * Gets the path to the bundled seed database.
 *
 * In production, this is the database bundled with the app.
 *
 * @returns {string | null} The seed database path, or null if not found
 */
function getSeedDatabasePath(): string | null {
  if (isDev) {
    return null;
  }

  const appPath = app.getAppPath();

  // Try multiple possible locations
  const possiblePaths = [
    path.join(appPath, 'prisma', 'data', DB_FILENAME),
    path.join(appPath, '..', 'prisma', 'data', DB_FILENAME),
    path.join(appPath, 'resources', 'prisma', 'data', DB_FILENAME),
  ];

  for (const seedPath of possiblePaths) {
    if (fs.existsSync(seedPath)) {
      return seedPath;
    }
  }

  return null;
}

/**
 * Ensures the database directory exists and initializes the database if needed.
 *
 * In production, if no database exists, it will attempt to copy the bundled seed database.
 * Should be called once at app startup before any database operations.
 *
 * @returns {Promise<void>}
 */
export async function ensureDatabaseExists(): Promise<void> {
  const dbDir = getDatabaseDir();
  const dbPath = getDatabasePath();

  // Ensure directory exists
  if (!fs.existsSync(dbDir)) {
    console.log(`[Database] Creating database directory: ${dbDir}`);
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Check if database exists
  if (!fs.existsSync(dbPath)) {
    console.log(`[Database] Database not found at: ${dbPath}`);

    // Try to copy seed database in production
    const seedPath = getSeedDatabasePath();
    if (seedPath) {
      console.log(`[Database] Copying seed database from: ${seedPath}`);
      try {
        fs.copyFileSync(seedPath, dbPath);
        console.log(`[Database] Seed database copied successfully.`);
      } catch (err) {
        console.error(`[Database] Failed to copy seed database:`, err);
        // Continue anyway - Prisma will try to create tables
      }
    } else {
      // Create empty database file - Prisma will create schema on connect
      console.log(`[Database] Creating empty database file.`);
      fs.writeFileSync(dbPath, '');
    }
  } else {
    console.log(`[Database] Found existing database at: ${dbPath}`);
  }
}

/**
 * Logs the database configuration for debugging.
 */
export function logDatabaseConfig(): void {
  console.log('[Database] Configuration:');
  console.log(`  - Mode: ${isDev ? 'development' : 'production'}`);
  console.log(`  - Directory: ${getDatabaseDir()}`);
  console.log(`  - Path: ${getDatabasePath()}`);
  console.log(`  - URL: ${getDatabaseUrl()}`);
}
