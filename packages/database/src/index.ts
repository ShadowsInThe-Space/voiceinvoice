/**
 * Database module for VoiceInvoice Enterprise.
 *
 * Provides Prisma client access with connection management,
 * retry logic, and health checks.
 *
 * @packageDocumentation
 * @module @voiceinvoice/database
 */

/**
 * Database module version for compatibility checking.
 */
export const DATABASE_VERSION = '0.1.0';

/**
 * Database health status information.
 */
export interface DatabaseHealth {
  /** Whether the database is connected and responsive */
  connected: boolean;
  /** Response time in milliseconds for the health check query */
  responseTimeMs: number;
  /** Timestamp of the health check */
  timestamp: Date;
  /** Error message if unhealthy */
  error?: string;
}

/**
 * Configuration options for database connection.
 */
export interface DatabaseConfig {
  /** Database URL (overrides environment variable) */
  databaseUrl?: string;
  /** Maximum number of connection retry attempts */
  maxRetries?: number;
  /** Initial retry delay in milliseconds */
  initialRetryDelayMs?: number;
  /** Maximum retry delay in milliseconds */
  maxRetryDelayMs?: number;
  /** Connection timeout in milliseconds */
  connectionTimeoutMs?: number;
  /** Enable query logging */
  logging?: boolean;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: Required<Omit<DatabaseConfig, 'databaseUrl'>> = {
  maxRetries: 3,
  initialRetryDelayMs: 100,
  maxRetryDelayMs: 5000,
  connectionTimeoutMs: 10000,
  logging: false,
};

/**
 * Error thrown when database operations fail.
 */
export class DatabaseError extends Error {
  public readonly code: string;
  public override readonly cause?: Error;

  /**
   *
   * @param message
   * @param code
   * @param cause
   */
  constructor(message: string, code: string, cause?: Error) {
    super(message, { cause });
    this.name = 'DatabaseError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Prisma client interface for type safety without requiring generated client.
 * This allows the module to be used and tested without Prisma generation.
 */
export interface PrismaClientInterface {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
}

/**
 * Factory function type for creating Prisma client instances.
 * Used for dependency injection in tests.
 */
export type PrismaClientFactory = (config?: DatabaseConfig) => PrismaClientInterface;

/**
 * Internal state for the database manager.
 */
interface DatabaseState {
  client: PrismaClientInterface | null;
  connected: boolean;
  config: Required<Omit<DatabaseConfig, 'databaseUrl'>> & { databaseUrl?: string };
  clientFactory: PrismaClientFactory | null;
}

/**
 * Singleton state for the database manager.
 */
let state: DatabaseState = {
  client: null,
  connected: false,
  config: { ...DEFAULT_CONFIG },
  clientFactory: null,
};

/**
 * Sleep utility for retry delays.
 * @param ms
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter.
 * @param attempt
 * @param initialDelay
 * @param maxDelay
 */
function calculateBackoffDelay(attempt: number, initialDelay: number, maxDelay: number): number {
  // Exponential backoff: initialDelay * 2^attempt
  const exponentialDelay = initialDelay * Math.pow(2, attempt);
  // Add jitter (0-25% of the delay)
  const jitter = exponentialDelay * Math.random() * 0.25;
  // Cap at maxDelay
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Initialize the database with custom configuration.
 *
 * @param config - Configuration options
 * @returns Resolves when configuration is applied
 *
 * @example
 * await initializeDatabase({
 *   maxRetries: 5,
 *   connectionTimeoutMs: 15000,
 * });
 */
export async function initializeDatabase(config?: DatabaseConfig): Promise<void> {
  state.config = {
    ...DEFAULT_CONFIG,
    ...config,
  };
}

/**
 * Set a custom Prisma client factory for dependency injection.
 * Primarily used for testing.
 *
 * @param factory - Factory function to create Prisma client instances
 */
export function setPrismaClientFactory(factory: PrismaClientFactory | null): void {
  state.clientFactory = factory;
  // Reset client when factory changes
  if (state.client) {
    state.client = null;
    state.connected = false;
  }
}

/**
 * Get the singleton database client instance.
 * Creates a new client if one doesn't exist.
 *
 * @returns The Prisma client instance
 * @throws {DatabaseError} If client cannot be created
 *
 * @example
 * const db = getDatabase();
 * const customers = await db.$queryRaw`SELECT * FROM Customer`;
 */
export function getDatabase(): PrismaClientInterface {
  if (!state.client) {
    if (state.clientFactory) {
      state.client = state.clientFactory(state.config);
    } else {
      // In production, we would create actual PrismaClient here
      // For now, throw an error indicating Prisma needs to be generated
      throw new DatabaseError(
        'Prisma client not available. Run "pnpm db:generate" or provide a client factory.',
        'PRISMA_NOT_GENERATED'
      );
    }
  }
  return state.client;
}

/**
 * Connect to the database with retry logic.
 *
 * @throws {DatabaseError} If connection fails after all retries
 *
 * @example
 * await connect();
 * console.log('Database connected');
 */
export async function connect(): Promise<void> {
  if (state.connected) {
    return;
  }

  const client = getDatabase();
  const { maxRetries, initialRetryDelayMs, maxRetryDelayMs, connectionTimeoutMs } = state.config;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Connection timeout after ${connectionTimeoutMs}ms`));
        }, connectionTimeoutMs);
      });

      // Race between connection and timeout
      await Promise.race([client.$connect(), timeoutPromise]);

      state.connected = true;
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = calculateBackoffDelay(attempt, initialRetryDelayMs, maxRetryDelayMs);
        await sleep(delay);
      }
    }
  }

  throw new DatabaseError(
    `Failed to connect to database after ${maxRetries + 1} attempts`,
    'CONNECTION_FAILED',
    lastError
  );
}

/**
 * Disconnect from the database gracefully.
 *
 * @example
 * await disconnect();
 * console.log('Database disconnected');
 */
export async function disconnect(): Promise<void> {
  if (!state.client) {
    return;
  }

  try {
    await state.client.$disconnect();
  } finally {
    state.connected = false;
  }
}

/**
 * Check if the database is currently connected.
 *
 * @returns True if connected, false otherwise
 *
 * @example
 * if (isConnected()) {
 *   console.log('Database is ready');
 * }
 */
export function isConnected(): boolean {
  return state.connected;
}

/**
 * Perform a health check on the database connection.
 *
 * @returns Health status information
 *
 * @example
 * const health = await healthCheck();
 * if (health.connected) {
 *   console.log(`Database OK, response time: ${health.responseTimeMs}ms`);
 * }
 */
export async function healthCheck(): Promise<DatabaseHealth> {
  const startTime = Date.now();
  const timestamp = new Date();

  if (!state.client || !state.connected) {
    return {
      connected: false,
      responseTimeMs: Date.now() - startTime,
      timestamp,
      error: 'Database not connected',
    };
  }

  try {
    // Execute a simple query to verify connection
    await state.client.$queryRaw`SELECT 1`;

    return {
      connected: true,
      responseTimeMs: Date.now() - startTime,
      timestamp,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Mark as disconnected if query fails
    state.connected = false;

    return {
      connected: false,
      responseTimeMs: Date.now() - startTime,
      timestamp,
      error: errorMessage,
    };
  }
}

/**
 * Reset the database manager state.
 * Primarily used for testing to ensure clean state between tests.
 *
 * @param options - Reset options
 *
 * @param options.disconnect
 * @example
 * // In test teardown
 * await resetDatabase();
 */
export async function resetDatabase(options?: { disconnect?: boolean }): Promise<void> {
  if (options?.disconnect !== false && state.client) {
    try {
      await state.client.$disconnect();
    } catch {
      // Ignore disconnect errors during reset
    }
  }

  state = {
    client: null,
    connected: false,
    config: { ...DEFAULT_CONFIG },
    clientFactory: null,
  };
}

/**
 * Get the current database configuration.
 *
 * @returns Current configuration (read-only copy)
 */
export function getConfig(): Readonly<typeof state.config> {
  return { ...state.config };
}

/**
 * Execute an operation with automatic retry on transient failures.
 *
 * @param operation - The database operation to execute
 * @param options - Retry options
 * @param options.maxRetries
 * @param options.initialDelayMs
 * @param options.maxDelayMs
 * @returns The result of the operation
 * @throws {DatabaseError} If operation fails after all retries
 *
 * @example
 * const result = await withRetry(
 *   () => db.$queryRaw`SELECT * FROM Customer WHERE id = ${id}`,
 *   { maxRetries: 3 }
 * );
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options?: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
  }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? state.config.maxRetries;
  const initialDelayMs = options?.initialDelayMs ?? state.config.initialRetryDelayMs;
  const maxDelayMs = options?.maxDelayMs ?? state.config.maxRetryDelayMs;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable (transient errors)
      const isRetryable = isTransientError(lastError);

      if (!isRetryable || attempt >= maxRetries) {
        break;
      }

      const delay = calculateBackoffDelay(attempt, initialDelayMs, maxDelayMs);
      await sleep(delay);
    }
  }

  throw new DatabaseError(
    `Operation failed after ${maxRetries + 1} attempts`,
    'OPERATION_FAILED',
    lastError
  );
}

/**
 * Check if an error is transient and should be retried.
 * @param error
 */
function isTransientError(error: Error): boolean {
  const transientCodes = [
    'P1001', // Can't reach database server
    'P1002', // Database server timeout
    'P1008', // Operations timed out
    'P1017', // Server has closed the connection
    'P2024', // Timed out fetching a new connection from the connection pool
  ];

  // Check for Prisma error codes
  const prismaCode = (error as { code?: string }).code;
  if (prismaCode && transientCodes.includes(prismaCode)) {
    return true;
  }

  // Check for common transient error messages
  const transientMessages = ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'connection', 'timeout'];

  const message = error.message.toLowerCase();
  return transientMessages.some((msg) => message.includes(msg.toLowerCase()));
}

/**
 * Register shutdown handlers for graceful termination.
 * Call this once during application startup.
 *
 * @example
 * // In your application entry point
 * registerShutdownHandlers();
 */
export function registerShutdownHandlers(): void {
  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, closing database connection...`);
    await disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
