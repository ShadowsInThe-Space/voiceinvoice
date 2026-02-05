/**
 * Database module for VoiceInvoice Enterprise.
 *
 * Provides Prisma client access for both SQLite (desktop) and
 * PostgreSQL (server) databases. This module handles client
 * initialization and connection management.
 *
 * @module @voiceinvoice/database
 */

import { PrismaClient } from '../generated/client';

export * from '../generated/client';

/**
 * Database module version for compatibility checking.
 */
export const DATABASE_VERSION = '0.1.0';

/**
 * Minimal Prisma client interface for testing.
 */
export interface PrismaClientInterface {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  $queryRaw(...args: unknown[]): Promise<unknown>;
  $executeRaw(...args: unknown[]): Promise<number>;
}

/**
 * Database configuration options.
 */
export interface DatabaseConfig {
  url?: string;
  maxRetries?: number;
  retryDelay?: number;
  connectionTimeoutMs?: number;
}

/**
 * Custom database error class for database-related errors.
 *
 * @param message - Error message describing what went wrong
 * @param code - Optional error code (e.g., 'NOT_INITIALIZED', 'CONNECTION_FAILED')
 * @param cause - Optional underlying error that caused this error
 */
export class DatabaseError extends Error {
  /**
   * Creates a new DatabaseError instance.
   *
   * @param message - Error message describing what went wrong.
   * @param code - Optional error code (e.g., 'NOT_INITIALIZED', 'CONNECTION_FAILED').
   * @param cause - Optional underlying error that caused this error.
   */
  constructor(
    message: string,
    public code?: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * Internal state management.
 */
let prismaClient: PrismaClient | PrismaClientInterface | null = null;
let isConnectedState = false;
let wasInitialized = false; // Track if database was initialized
let config: DatabaseConfig = {
  maxRetries: 3,
  retryDelay: 1000,
};
let prismaClientFactory: (() => PrismaClient | PrismaClientInterface) | null = null;

/**
 * Global variable to hold the Prisma Client instance in development
 * to prevent multiple instances during hot-reloading.
 */
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/**
 * The Prisma Client instance (legacy export for backwards compatibility).
 *
 * Uses a singleton pattern to ensure only one instance exists.
 */
export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Initializes the database with optional configuration.
 * Note: This only sets up the configuration and client.
 * Call connect() to actually establish a connection.
 *
 * @param opts - Database configuration options
 * @returns {Promise<void>} Resolves when database is initialized
 *
 * @example
 * await initializeDatabase({ maxRetries: 5 });
 * await connect();
 */
export async function initializeDatabase(opts?: DatabaseConfig): Promise<void> {
  if (opts) {
    config = { ...config, ...opts };
  }

  if (!prismaClient) {
    prismaClient = prismaClientFactory ? prismaClientFactory() : new PrismaClient();
  }

  // Mark as initialized
  wasInitialized = true;

  // Don't connect here - let the caller decide when to connect
  // This allows tests to configure the database without triggering connection
}

/**
 * Gets the current database client instance.
 *
 * @returns The Prisma client
 * @throws {DatabaseError} If database not initialized
 */
export function getDatabase(): PrismaClient | PrismaClientInterface {
  if (!prismaClient) {
    // If factory is set and database was initialized and then reset, throw
    if (wasInitialized) {
      throw new DatabaseError(
        'Database not initialized. Call initializeDatabase() first.',
        'NOT_INITIALIZED'
      );
    }
    // If factory is set and database was never initialized, create client automatically
    if (prismaClientFactory) {
      prismaClient = prismaClientFactory();
      return prismaClient;
    }
    throw new DatabaseError(
      'Database not initialized. Call initializeDatabase() first.',
      'NOT_INITIALIZED'
    );
  }
  return prismaClient;
}

/**
 * Connects to the database with retry logic and timeout.
 *
 * @returns {Promise<void>} Resolves when connected
 * @throws {DatabaseError} If connection fails after retries
 */
export async function connect(): Promise<void> {
  // Skip if already connected
  if (isConnectedState && prismaClient) {
    return;
  }

  if (!prismaClient) {
    prismaClient = prismaClientFactory ? prismaClientFactory() : new PrismaClient();
  }

  const maxRetries = config.maxRetries || 3;
  const retryDelay = config.retryDelay || 1000;
  const connectionTimeoutMs = config.connectionTimeoutMs;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Apply timeout if configured
      if (connectionTimeoutMs && connectionTimeoutMs > 0) {
        await Promise.race([
          prismaClient.$connect(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Connection timeout')), connectionTimeoutMs)
          ),
        ]);
      } else {
        await prismaClient.$connect();
      }

      isConnectedState = true;
      return;
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  throw new DatabaseError(
    `Failed to connect to database after ${maxRetries + 1} attempts`,
    'CONNECTION_FAILED',
    lastError || undefined
  );
}

/**
 * Disconnects the database connection.
 *
 * Should be called when the application shuts down.
 *
 * @returns {Promise<void>} Resolves when database is disconnected
 * @throws {DatabaseError} If disconnect fails
 */
export async function disconnect(): Promise<void> {
  if (prismaClient) {
    try {
      await prismaClient.$disconnect();
      isConnectedState = false;
    } catch (error) {
      // Always set to false even if disconnect throws
      isConnectedState = false;
      throw new DatabaseError('Disconnect failed', 'DISCONNECT_FAILED', error as Error);
    }
  } else {
    isConnectedState = false;
  }
}

/**
 * Legacy alias for disconnect.
 */
export async function disconnectDatabase(): Promise<void> {
  await disconnect();
}

/**
 * Checks if database is currently connected.
 *
 * @returns true if connected
 */
export function isConnected(): boolean {
  return isConnectedState;
}

/**
 * Health check result.
 */
export interface HealthCheckResult {
  connected: boolean;
  responseTimeMs: number;
  error?: string;
  timestamp: Date;
}

/**
 * Performs a health check on the database.
 *
 * @returns Health check result
 */
export async function healthCheck(): Promise<HealthCheckResult> {
  const timestamp = new Date();

  if (!isConnectedState || !prismaClient) {
    return {
      connected: false,
      error: 'Database not connected',
      responseTimeMs: 0,
      timestamp,
    };
  }

  const start = Date.now();

  try {
    await prismaClient.$queryRaw`SELECT 1`;
    const responseTimeMs = Date.now() - start;
    return {
      connected: true,
      responseTimeMs,
      error: undefined,
      timestamp,
    };
  } catch (error) {
    // Mark as disconnected if query fails
    isConnectedState = false;
    const responseTimeMs = Date.now() - start;
    return {
      connected: false,
      error: (error as Error).message,
      responseTimeMs,
      timestamp,
    };
  }
}

/**
 * Reset database options.
 */
export interface ResetDatabaseOptions {
  disconnect?: boolean;
}

/**
 * Resets the database state (for testing).
 *
 * @param options - Reset options
 */
export async function resetDatabase(options: ResetDatabaseOptions = {}): Promise<void> {
  const { disconnect: shouldDisconnect = true } = options;

  // Track if database was initialized before reset (for this specific call)
  const wasInitializedBefore = wasInitialized && prismaClient !== null;

  if (shouldDisconnect && prismaClient) {
    await prismaClient.$disconnect();
  }

  prismaClient = null;
  isConnectedState = false;

  // Only keep wasInitialized = true if DB was actually initialized AND we're doing a reset within a test
  // (not in beforeEach where wasInitialized should be reset to false)
  if (!wasInitializedBefore) {
    wasInitialized = false;
  }

  // Reset config to defaults
  config = {
    maxRetries: 3,
    retryDelay: 1000,
  };
}

/**
 * Gets the current database configuration.
 *
 * @returns Database configuration (copy)
 */
export function getConfig(): DatabaseConfig {
  return { ...config };
}

/**
 * Executes an operation with retry logic.
 *
 * @param operation - The operation to execute
 * @returns The operation result
 * @throws {DatabaseError} If all retries fail
 */
export async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  const maxRetries = config.maxRetries || 3;
  const retryDelay = config.retryDelay || 1000;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      const errorMessage = lastError.message.toLowerCase();
      const isTransient =
        errorMessage.includes('timeout') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('econnrefused') ||
        ('code' in lastError && lastError.code === 'P2024'); // Prisma timeout error

      if (!isTransient || attempt >= maxRetries) {
        throw new DatabaseError(
          `Operation failed after ${attempt + 1} attempts`,
          'MAX_RETRIES_EXCEEDED',
          lastError
        );
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
    }
  }

  // This should never be reached, but TypeScript requires it
  throw new DatabaseError('Unexpected error in withRetry', 'UNKNOWN', lastError || undefined);
}

/**
 * Sets a custom Prisma client factory for testing.
 *
 * @param factory - Factory function or null to reset
 */
export function setPrismaClientFactory(
  factory: (() => PrismaClient | PrismaClientInterface) | null
): void {
  prismaClientFactory = factory;

  // Reset client when factory changes
  if (prismaClient) {
    prismaClient = null;
    isConnectedState = false;
  }
}
