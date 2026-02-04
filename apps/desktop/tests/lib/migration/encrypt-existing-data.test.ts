/**
 * Data Migration Script Tests
 *
 * Tests for migrating existing unencrypted data to encrypted format.
 *
 * @module tests/lib/migration/encrypt-existing-data
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock encryption context
vi.mock('../../../src/lib/encryption', () => ({
  globalEncryptionContext: {
    isInitialized: vi.fn(() => true),
  },
}));

// Mock field-encryption
vi.mock('../../../src/lib/encryption/field-encryption', () => ({
  encryptSensitiveFields: vi.fn((model: string, data: Record<string, unknown>) => {
    // Return data with 'encrypted_' prefix to simulate encryption
    const encrypted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        encrypted[key] = `encrypted_${value}`;
      } else {
        encrypted[key] = value;
      }
    }
    return encrypted;
  }),
  isEncrypted: vi.fn((value: unknown) => {
    if (typeof value !== 'string') return false;
    return value.startsWith('encrypted_') || value.startsWith('enc:');
  }),
  ENCRYPTED_FIELDS: {
    Customer: ['name', 'email', 'phone', 'address', 'notes', 'taxId'],
    Invoice: ['transcription', 'notes'],
    BankTransaction: ['counterparty', 'counterpartyIban', 'purpose'],
  },
}));

import {
  migrateExistingData,
  isMigrationNeeded,
  type MigrationProgressCallback,
} from '../../../src/lib/migration/encrypt-existing-data';
import { globalEncryptionContext } from '../../../src/lib/encryption';
import { isEncrypted } from '../../../src/lib/encryption/field-encryption';

// Create mock Prisma client
function createMockPrisma(overrides?: {
  customers?: Record<string, unknown>[];
  invoices?: Record<string, unknown>[];
  transactions?: Record<string, unknown>[];
  queryError?: Error;
  executeError?: Error;
}) {
  const customers = overrides?.customers ?? [];
  const invoices = overrides?.invoices ?? [];
  const transactions = overrides?.transactions ?? [];

  return {
    $queryRawUnsafe: vi.fn(async (sql: string) => {
      if (overrides?.queryError) throw overrides.queryError;

      if (sql.includes('FROM Customer')) {
        return customers;
      }
      if (sql.includes('FROM Invoice')) {
        return invoices;
      }
      if (sql.includes('FROM BankTransaction')) {
        return transactions;
      }
      return [];
    }),
    $executeRawUnsafe: vi.fn(async () => {
      if (overrides?.executeError) throw overrides.executeError;
      return 1;
    }),
  };
}

describe('Data Migration Script', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(globalEncryptionContext.isInitialized).mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('migrateExistingData', () => {
    it('should throw if encryption context not initialized', async () => {
      vi.mocked(globalEncryptionContext.isInitialized).mockReturnValue(false);
      const mockPrisma = createMockPrisma();

      await expect(migrateExistingData(mockPrisma as never)).rejects.toThrow(
        'Encryption context must be initialized before migration'
      );
    });

    it('should return empty result when no data exists', async () => {
      const mockPrisma = createMockPrisma({
        customers: [],
        invoices: [],
        transactions: [],
      });

      const result = await migrateExistingData(mockPrisma as never);

      expect(result.success).toBe(true);
      expect(result.customersEncrypted).toBe(0);
      expect(result.invoicesEncrypted).toBe(0);
      expect(result.bankTransactionsEncrypted).toBe(0);
      expect(result.totalRecordsProcessed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should encrypt unencrypted customer records', async () => {
      const mockPrisma = createMockPrisma({
        customers: [
          { id: 'cust-1', name: 'Müller GmbH', email: 'mueller@example.de' },
          { id: 'cust-2', name: 'Schmidt AG', email: 'schmidt@example.de' },
        ],
        invoices: [],
        transactions: [],
      });

      const result = await migrateExistingData(mockPrisma as never);

      expect(result.success).toBe(true);
      expect(result.customersEncrypted).toBe(2);
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledTimes(2);
    });

    it('should skip already encrypted customer records', async () => {
      const mockPrisma = createMockPrisma({
        customers: [{ id: 'cust-1', name: 'encrypted_Müller GmbH', email: 'encrypted_email' }],
        invoices: [],
        transactions: [],
      });

      const result = await migrateExistingData(mockPrisma as never);

      expect(result.customersEncrypted).toBe(0);
      expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });

    it('should encrypt unencrypted invoice records', async () => {
      const mockPrisma = createMockPrisma({
        customers: [],
        invoices: [
          { id: 'inv-1', number: 'INV-001', transcription: 'Some transcription', notes: null },
          { id: 'inv-2', number: 'INV-002', transcription: null, notes: 'Some notes' },
        ],
        transactions: [],
      });

      const result = await migrateExistingData(mockPrisma as never);

      expect(result.success).toBe(true);
      expect(result.invoicesEncrypted).toBe(2);
    });

    it('should skip invoices without sensitive fields', async () => {
      const mockPrisma = createMockPrisma({
        customers: [],
        invoices: [{ id: 'inv-1', number: 'INV-001', transcription: null, notes: null }],
        transactions: [],
      });

      const result = await migrateExistingData(mockPrisma as never);

      expect(result.invoicesEncrypted).toBe(0);
    });

    it('should encrypt unencrypted bank transactions', async () => {
      const mockPrisma = createMockPrisma({
        customers: [],
        invoices: [],
        transactions: [{ id: 'tx-1', counterparty: 'Müller GmbH', purpose: 'Rechnung 001' }],
      });

      const result = await migrateExistingData(mockPrisma as never);

      expect(result.success).toBe(true);
      expect(result.bankTransactionsEncrypted).toBe(1);
    });

    it('should handle mixed encrypted and unencrypted data', async () => {
      const mockPrisma = createMockPrisma({
        customers: [
          { id: 'cust-1', name: 'Unencrypted Name' },
          { id: 'cust-2', name: 'encrypted_Already Encrypted' },
        ],
        invoices: [{ id: 'inv-1', transcription: 'Unencrypted transcription' }],
        transactions: [{ id: 'tx-1', counterparty: 'encrypted_Already Encrypted' }],
      });

      const result = await migrateExistingData(mockPrisma as never);

      expect(result.customersEncrypted).toBe(1);
      expect(result.invoicesEncrypted).toBe(1);
      expect(result.bankTransactionsEncrypted).toBe(0);
      expect(result.totalRecordsProcessed).toBe(2);
    });

    it('should call progress callback during migration', async () => {
      const mockPrisma = createMockPrisma({
        customers: [
          { id: 'cust-1', name: 'Customer 1' },
          { id: 'cust-2', name: 'Customer 2' },
        ],
        invoices: [],
        transactions: [],
      });

      const progressCallback: MigrationProgressCallback = vi.fn();

      await migrateExistingData(mockPrisma as never, progressCallback);

      expect(progressCallback).toHaveBeenCalledTimes(2);
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'Customer',
          current: 1,
          total: 2,
        })
      );
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'Customer',
          current: 2,
          total: 2,
        })
      );
    });

    it('should continue migration even if one model fails', async () => {
      const mockPrisma = {
        $queryRawUnsafe: vi.fn(async (sql: string) => {
          if (sql.includes('FROM Customer')) {
            throw new Error('Customer query failed');
          }
          if (sql.includes('FROM Invoice')) {
            return [{ id: 'inv-1', transcription: 'Test' }];
          }
          return [];
        }),
        $executeRawUnsafe: vi.fn(async () => 1),
      };

      const result = await migrateExistingData(mockPrisma as never);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Customer migration error: Customer query failed');
      expect(result.invoicesEncrypted).toBe(1);
    });

    it('should record timestamps', async () => {
      const mockPrisma = createMockPrisma();
      const before = new Date();

      const result = await migrateExistingData(mockPrisma as never);

      const after = new Date();
      expect(result.startedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.completedAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(result.completedAt.getTime()).toBeGreaterThanOrEqual(result.startedAt.getTime());
    });

    it('should handle customers without name field gracefully', async () => {
      const mockPrisma = createMockPrisma({
        customers: [{ id: 'cust-1', name: null, email: 'test@example.de' }],
        invoices: [],
        transactions: [],
      });

      const result = await migrateExistingData(mockPrisma as never);

      // Should not try to encrypt record with null name
      expect(result.customersEncrypted).toBe(0);
    });
  });

  describe('isMigrationNeeded', () => {
    it('should return true when unencrypted customers exist', async () => {
      const mockPrisma = createMockPrisma({
        customers: [{ name: 'Unencrypted Name' }],
      });

      const result = await isMigrationNeeded(mockPrisma as never);

      expect(result).toBe(true);
    });

    it('should return false when customers are already encrypted', async () => {
      vi.mocked(isEncrypted).mockImplementation((value) => {
        if (typeof value !== 'string') return false;
        return value.startsWith('encrypted_');
      });

      const mockPrisma = createMockPrisma({
        customers: [{ name: 'encrypted_Name' }],
        invoices: [],
      });

      const result = await isMigrationNeeded(mockPrisma as never);

      expect(result).toBe(false);
    });

    it('should return true when unencrypted invoices exist', async () => {
      const mockPrisma = createMockPrisma({
        customers: [],
        invoices: [{ notes: 'Unencrypted notes', transcription: null }],
      });

      const result = await isMigrationNeeded(mockPrisma as never);

      expect(result).toBe(true);
    });

    it('should return true when unencrypted invoice transcription exists', async () => {
      const mockPrisma = createMockPrisma({
        customers: [],
        invoices: [{ notes: null, transcription: 'Unencrypted transcription' }],
      });

      const result = await isMigrationNeeded(mockPrisma as never);

      expect(result).toBe(true);
    });

    it('should return false when no data exists', async () => {
      const mockPrisma = createMockPrisma({
        customers: [],
        invoices: [],
      });

      const result = await isMigrationNeeded(mockPrisma as never);

      expect(result).toBe(false);
    });

    it('should return false when all data is encrypted', async () => {
      vi.mocked(isEncrypted).mockReturnValue(true);

      const mockPrisma = createMockPrisma({
        customers: [{ name: 'encrypted_Name' }],
        invoices: [{ notes: 'encrypted_Notes', transcription: 'encrypted_Transcription' }],
      });

      const result = await isMigrationNeeded(mockPrisma as never);

      expect(result).toBe(false);
    });
  });
});
