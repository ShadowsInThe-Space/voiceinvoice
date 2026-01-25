import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DATABASE_VERSION,
  initializeDatabase,
  getDatabase,
  connect,
  disconnect,
  isConnected,
  healthCheck,
  resetDatabase,
  getConfig,
  withRetry,
  setPrismaClientFactory,
  DatabaseError,
  type PrismaClientInterface,
  type DatabaseConfig,
} from '../src/index';

/**
 * Create a mock Prisma client for testing.
 * @param overrides
 */
function createMockPrismaClient(overrides?: Partial<PrismaClientInterface>): PrismaClientInterface {
  return {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $queryRaw: vi.fn().mockResolvedValue([{ result: 1 }]),
    $executeRaw: vi.fn().mockResolvedValue(1),
    ...overrides,
  };
}

describe('Database Package', () => {
  beforeEach(async () => {
    // Reset state before each test
    await resetDatabase({ disconnect: false });
  });

  afterEach(async () => {
    // Clean up after each test
    await resetDatabase({ disconnect: false });
  });

  describe('DATABASE_VERSION', () => {
    it('should export version constant', () => {
      expect(DATABASE_VERSION).toBe('0.1.0');
    });

    it('should be a valid semver string', () => {
      expect(DATABASE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('initializeDatabase', () => {
    it('should resolve without error', async () => {
      await expect(initializeDatabase()).resolves.toBeUndefined();
    });

    it('should accept custom configuration', async () => {
      const config: DatabaseConfig = {
        maxRetries: 5,
        connectionTimeoutMs: 15000,
        logging: true,
      };

      await initializeDatabase(config);
      const currentConfig = getConfig();

      expect(currentConfig.maxRetries).toBe(5);
      expect(currentConfig.connectionTimeoutMs).toBe(15000);
      expect(currentConfig.logging).toBe(true);
    });

    it('should use default values for unspecified options', async () => {
      await initializeDatabase({ maxRetries: 10 });
      const config = getConfig();

      expect(config.maxRetries).toBe(10);
      expect(config.initialRetryDelayMs).toBe(100); // default
      expect(config.maxRetryDelayMs).toBe(5000); // default
      expect(config.connectionTimeoutMs).toBe(10000); // default
    });
  });

  describe('getDatabase', () => {
    it('should throw error when no client factory is set', () => {
      expect(() => getDatabase()).toThrow(DatabaseError);
      expect(() => getDatabase()).toThrow('Prisma client not available');
    });

    it('should return client when factory is set', () => {
      const mockClient = createMockPrismaClient();
      setPrismaClientFactory(() => mockClient);

      const db = getDatabase();
      expect(db).toBe(mockClient);
    });

    it('should return the same instance on subsequent calls (singleton)', () => {
      const mockClient = createMockPrismaClient();
      setPrismaClientFactory(() => mockClient);

      const db1 = getDatabase();
      const db2 = getDatabase();

      expect(db1).toBe(db2);
    });

    it('should create new client when factory is changed', () => {
      const mockClient1 = createMockPrismaClient();
      const mockClient2 = createMockPrismaClient();

      setPrismaClientFactory(() => mockClient1);
      const db1 = getDatabase();

      setPrismaClientFactory(() => mockClient2);
      const db2 = getDatabase();

      expect(db1).not.toBe(db2);
    });
  });

  describe('connect', () => {
    it('should connect successfully with mock client', async () => {
      const mockClient = createMockPrismaClient();
      setPrismaClientFactory(() => mockClient);

      await connect();

      expect(mockClient.$connect).toHaveBeenCalledOnce();
      expect(isConnected()).toBe(true);
    });

    it('should not reconnect if already connected', async () => {
      const mockClient = createMockPrismaClient();
      setPrismaClientFactory(() => mockClient);

      await connect();
      await connect();

      expect(mockClient.$connect).toHaveBeenCalledOnce();
    });

    it('should retry on connection failure', async () => {
      let attempts = 0;
      const mockClient = createMockPrismaClient({
        $connect: vi.fn().mockImplementation(() => {
          attempts++;
          if (attempts < 3) {
            return Promise.reject(new Error('Connection failed'));
          }
          return Promise.resolve();
        }),
      });

      setPrismaClientFactory(() => mockClient);
      await initializeDatabase({
        maxRetries: 3,
        initialRetryDelayMs: 10,
        maxRetryDelayMs: 50,
      });

      await connect();

      expect(attempts).toBe(3);
      expect(isConnected()).toBe(true);
    });

    it('should throw DatabaseError after max retries exceeded', async () => {
      const mockClient = createMockPrismaClient({
        $connect: vi.fn().mockRejectedValue(new Error('Connection refused')),
      });

      setPrismaClientFactory(() => mockClient);
      await initializeDatabase({
        maxRetries: 2,
        initialRetryDelayMs: 10,
        maxRetryDelayMs: 50,
      });

      await expect(connect()).rejects.toThrow(DatabaseError);
      await expect(connect()).rejects.toThrow('Failed to connect to database after 3 attempts');
    });

    it('should handle connection timeout', async () => {
      const mockClient = createMockPrismaClient({
        $connect: vi.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
      });

      setPrismaClientFactory(() => mockClient);
      await initializeDatabase({
        maxRetries: 0,
        connectionTimeoutMs: 100,
      });

      try {
        await connect();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(DatabaseError);
        expect((error as DatabaseError).code).toBe('CONNECTION_FAILED');
        expect((error as DatabaseError).cause?.message).toContain('timeout');
      }
    });
  });

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      const mockClient = createMockPrismaClient();
      setPrismaClientFactory(() => mockClient);

      await connect();
      await disconnect();

      expect(mockClient.$disconnect).toHaveBeenCalledOnce();
      expect(isConnected()).toBe(false);
    });

    it('should be idempotent when not connected', async () => {
      await expect(disconnect()).resolves.toBeUndefined();
    });

    it('should set connected to false even if disconnect throws', async () => {
      const mockClient = createMockPrismaClient({
        $disconnect: vi.fn().mockRejectedValue(new Error('Disconnect failed')),
      });

      setPrismaClientFactory(() => mockClient);
      await connect();

      // Should not throw, but should mark as disconnected
      await expect(disconnect()).rejects.toThrow('Disconnect failed');
      expect(isConnected()).toBe(false);
    });
  });

  describe('isConnected', () => {
    it('should return false initially', () => {
      expect(isConnected()).toBe(false);
    });

    it('should return true after successful connection', async () => {
      const mockClient = createMockPrismaClient();
      setPrismaClientFactory(() => mockClient);

      await connect();
      expect(isConnected()).toBe(true);
    });

    it('should return false after disconnect', async () => {
      const mockClient = createMockPrismaClient();
      setPrismaClientFactory(() => mockClient);

      await connect();
      await disconnect();
      expect(isConnected()).toBe(false);
    });
  });

  describe('healthCheck', () => {
    it('should return unhealthy when not connected', async () => {
      const health = await healthCheck();

      expect(health.connected).toBe(false);
      expect(health.error).toBe('Database not connected');
      expect(health.timestamp).toBeInstanceOf(Date);
      expect(health.responseTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should return healthy when connected and query succeeds', async () => {
      const mockClient = createMockPrismaClient();
      setPrismaClientFactory(() => mockClient);

      await connect();
      const health = await healthCheck();

      expect(health.connected).toBe(true);
      expect(health.error).toBeUndefined();
      expect(health.timestamp).toBeInstanceOf(Date);
      expect(health.responseTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy when query fails', async () => {
      const mockClient = createMockPrismaClient({
        $queryRaw: vi.fn().mockRejectedValue(new Error('Query failed')),
      });

      setPrismaClientFactory(() => mockClient);
      await connect();

      const health = await healthCheck();

      expect(health.connected).toBe(false);
      expect(health.error).toBe('Query failed');
      expect(isConnected()).toBe(false); // Should mark as disconnected
    });

    it('should measure response time', async () => {
      const mockClient = createMockPrismaClient({
        $queryRaw: vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return [{ result: 1 }];
        }),
      });

      setPrismaClientFactory(() => mockClient);
      await connect();

      const health = await healthCheck();

      expect(health.responseTimeMs).toBeGreaterThanOrEqual(50);
    });
  });

  describe('resetDatabase', () => {
    it('should reset all state', async () => {
      const mockClient = createMockPrismaClient();
      setPrismaClientFactory(() => mockClient);

      await initializeDatabase({ maxRetries: 10 });
      await connect();

      await resetDatabase();

      expect(isConnected()).toBe(false);
      expect(getConfig().maxRetries).toBe(3); // Default value
      expect(() => getDatabase()).toThrow(DatabaseError);
    });

    it('should call disconnect by default', async () => {
      const mockClient = createMockPrismaClient();
      setPrismaClientFactory(() => mockClient);

      await connect();
      await resetDatabase();

      expect(mockClient.$disconnect).toHaveBeenCalled();
    });

    it('should skip disconnect when option is false', async () => {
      const mockClient = createMockPrismaClient();
      setPrismaClientFactory(() => mockClient);

      await connect();
      await resetDatabase({ disconnect: false });

      expect(mockClient.$disconnect).not.toHaveBeenCalled();
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = getConfig();

      expect(config.maxRetries).toBe(3);
      expect(config.initialRetryDelayMs).toBe(100);
      expect(config.maxRetryDelayMs).toBe(5000);
      expect(config.connectionTimeoutMs).toBe(10000);
      expect(config.logging).toBe(false);
    });

    it('should return a copy (not mutable)', async () => {
      const config = getConfig();
      // @ts-expect-error - Testing mutation protection
      config.maxRetries = 999;

      expect(getConfig().maxRetries).toBe(3);
    });
  });

  describe('withRetry', () => {
    it('should execute operation successfully on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await withRetry(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledOnce();
    });

    it('should retry on transient errors', async () => {
      let attempts = 0;
      const operation = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          const error = new Error('Connection timeout');
          return Promise.reject(error);
        }
        return Promise.resolve('success');
      });

      const result = await withRetry(operation, {
        maxRetries: 3,
        initialDelayMs: 10,
        maxDelayMs: 50,
      });

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should not retry on non-transient errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Invalid query syntax'));

      await expect(
        withRetry(operation, { maxRetries: 3, initialDelayMs: 10, maxDelayMs: 50 })
      ).rejects.toThrow('Operation failed');

      expect(operation).toHaveBeenCalledOnce();
    });

    it('should throw DatabaseError after max retries', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Connection refused ECONNREFUSED'));

      await expect(
        withRetry(operation, { maxRetries: 2, initialDelayMs: 10, maxDelayMs: 50 })
      ).rejects.toThrow(DatabaseError);
    });

    it('should include original error as cause', async () => {
      const originalError = new Error('Connection timeout');
      const operation = vi.fn().mockRejectedValue(originalError);

      try {
        await withRetry(operation, { maxRetries: 0 });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(DatabaseError);
        expect((error as DatabaseError).cause).toBe(originalError);
      }
    });

    it('should retry on Prisma error codes', async () => {
      let attempts = 0;
      const operation = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          const error = new Error('Timeout') as Error & { code: string };
          error.code = 'P1008'; // Operations timed out
          return Promise.reject(error);
        }
        return Promise.resolve('success');
      });

      const result = await withRetry(operation, {
        maxRetries: 2,
        initialDelayMs: 10,
      });

      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });
  });

  describe('DatabaseError', () => {
    it('should create error with message and code', () => {
      const error = new DatabaseError('Test error', 'TEST_CODE');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('DatabaseError');
      expect(error.cause).toBeUndefined();
    });

    it('should create error with cause', () => {
      const cause = new Error('Original error');
      const error = new DatabaseError('Wrapped error', 'WRAPPED', cause);

      expect(error.cause).toBe(cause);
    });

    it('should be instance of Error', () => {
      const error = new DatabaseError('Test', 'CODE');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DatabaseError);
    });
  });

  describe('setPrismaClientFactory', () => {
    it('should allow setting custom factory', () => {
      const mockClient = createMockPrismaClient();
      const factory = vi.fn().mockReturnValue(mockClient);

      setPrismaClientFactory(factory);
      const db = getDatabase();

      expect(factory).toHaveBeenCalled();
      expect(db).toBe(mockClient);
    });

    it('should reset client when factory is set to null', async () => {
      const mockClient = createMockPrismaClient();
      setPrismaClientFactory(() => mockClient);

      getDatabase(); // Create client

      setPrismaClientFactory(null);

      expect(() => getDatabase()).toThrow(DatabaseError);
    });

    it('should reset connection state when factory changes', async () => {
      const mockClient1 = createMockPrismaClient();
      setPrismaClientFactory(() => mockClient1);
      await connect();

      expect(isConnected()).toBe(true);

      const mockClient2 = createMockPrismaClient();
      setPrismaClientFactory(() => mockClient2);

      expect(isConnected()).toBe(false);
    });
  });
});
