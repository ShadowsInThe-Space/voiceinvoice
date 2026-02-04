/**
 * Data Migration Script for E2E Encryption
 *
 * Migrates existing unencrypted data to encrypted format.
 * Run this once after encryption is enabled for the first time.
 *
 * @module lib/migration/encrypt-existing-data
 */

import { PrismaClient } from '@/generated/prisma';
import { globalEncryptionContext } from '../encryption';
import {
  encryptSensitiveFields,
  isEncrypted,
  ENCRYPTED_FIELDS,
} from '../encryption/field-encryption';

/**
 * Migration result statistics.
 */
export interface MigrationResult {
  success: boolean;
  customersEncrypted: number;
  invoicesEncrypted: number;
  bankTransactionsEncrypted: number;
  totalRecordsProcessed: number;
  errors: string[];
  startedAt: Date;
  completedAt: Date;
}

/**
 * Progress callback for UI updates.
 */
export type MigrationProgressCallback = (progress: {
  model: string;
  current: number;
  total: number;
  message: string;
}) => void;

/**
 * Migrates existing unencrypted data to encrypted format.
 *
 * This function:
 * 1. Reads all records from Customer, Invoice, BankTransaction tables
 * 2. Checks if sensitive fields are already encrypted
 * 3. Encrypts unencrypted fields using the current encryption context
 * 4. Updates records in place
 *
 * @param prisma - PrismaClient instance
 * @param onProgress - Optional callback for progress updates
 * @returns Migration result with statistics
 * @throws Error if encryption context not initialized
 *
 * @example
 * ```typescript
 * // Initialize encryption first
 * globalEncryptionContext.initialize(licenseKey, deviceId);
 *
 * // Run migration
 * const result = await migrateExistingData(prisma, (progress) => {
 *   console.log(`${progress.model}: ${progress.current}/${progress.total}`);
 * });
 *
 * console.log(`Migrated ${result.totalRecordsProcessed} records`);
 * ```
 */
export async function migrateExistingData(
  prisma: PrismaClient,
  onProgress?: MigrationProgressCallback
): Promise<MigrationResult> {
  const startedAt = new Date();
  const errors: string[] = [];

  // Validate encryption context
  if (!globalEncryptionContext.isInitialized()) {
    throw new Error('Encryption context must be initialized before migration');
  }

  let customersEncrypted = 0;
  let invoicesEncrypted = 0;
  let bankTransactionsEncrypted = 0;

  // Migrate Customers
  try {
    const customers = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      'SELECT * FROM Customer WHERE deletedAt IS NULL'
    );

    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i];

      if (onProgress) {
        onProgress({
          model: 'Customer',
          current: i + 1,
          total: customers.length,
          message: `Verarbeite Kunde ${customer.name || customer.id}`,
        });
      }

      // Check if already encrypted (check the 'name' field)
      if (customer.name && !isEncrypted(customer.name)) {
        const encrypted = encryptSensitiveFields('Customer', customer);

        // Update record
        await updateCustomerFields(prisma, customer.id as string, encrypted);
        customersEncrypted++;
      }
    }
  } catch (error) {
    errors.push(`Customer migration error: ${(error as Error).message}`);
  }

  // Migrate Invoices
  try {
    const invoices = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      'SELECT * FROM Invoice WHERE deletedAt IS NULL'
    );

    for (let i = 0; i < invoices.length; i++) {
      const invoice = invoices[i];

      if (onProgress) {
        onProgress({
          model: 'Invoice',
          current: i + 1,
          total: invoices.length,
          message: `Verarbeite Rechnung ${invoice.number || invoice.id}`,
        });
      }

      // Check if already encrypted (check sensitive fields)
      const hasUnencryptedFields =
        (invoice.transcription && !isEncrypted(invoice.transcription)) ||
        (invoice.notes && !isEncrypted(invoice.notes));

      if (hasUnencryptedFields) {
        const encrypted = encryptSensitiveFields('Invoice', invoice);

        // Update record
        await updateInvoiceFields(prisma, invoice.id as string, encrypted);
        invoicesEncrypted++;
      }
    }
  } catch (error) {
    errors.push(`Invoice migration error: ${(error as Error).message}`);
  }

  // Migrate BankTransactions
  try {
    const transactions = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      'SELECT * FROM BankTransaction WHERE deletedAt IS NULL'
    );

    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i];

      if (onProgress) {
        onProgress({
          model: 'BankTransaction',
          current: i + 1,
          total: transactions.length,
          message: `Verarbeite Transaktion ${transaction.id}`,
        });
      }

      // Check if already encrypted
      const hasUnencryptedFields =
        (transaction.counterparty && !isEncrypted(transaction.counterparty)) ||
        (transaction.purpose && !isEncrypted(transaction.purpose));

      if (hasUnencryptedFields) {
        const encrypted = encryptSensitiveFields('BankTransaction', transaction);

        // Update record
        await updateBankTransactionFields(prisma, transaction.id as string, encrypted);
        bankTransactionsEncrypted++;
      }
    }
  } catch (error) {
    errors.push(`BankTransaction migration error: ${(error as Error).message}`);
  }

  const completedAt = new Date();

  return {
    success: errors.length === 0,
    customersEncrypted,
    invoicesEncrypted,
    bankTransactionsEncrypted,
    totalRecordsProcessed: customersEncrypted + invoicesEncrypted + bankTransactionsEncrypted,
    errors,
    startedAt,
    completedAt,
  };
}

/**
 * Updates encrypted fields for a Customer record.
 * @param prisma
 * @param id
 * @param data
 */
async function updateCustomerFields(
  prisma: PrismaClient,
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  const fields = ENCRYPTED_FIELDS.Customer;
  const now = new Date().toISOString();

  // Build SET clause dynamically
  const setClauses = fields
    .filter((field) => data[field] !== undefined)
    .map((field) => `${field} = ?`)
    .concat(['updatedAt = ?', 'syncVersion = syncVersion + 1']);

  const values = fields.filter((field) => data[field] !== undefined).map((field) => data[field]);
  values.push(now);
  values.push(id);

  await prisma.$executeRawUnsafe(
    `UPDATE Customer SET ${setClauses.join(', ')} WHERE id = ?`,
    ...values
  );
}

/**
 * Updates encrypted fields for an Invoice record.
 * @param prisma
 * @param id
 * @param data
 */
async function updateInvoiceFields(
  prisma: PrismaClient,
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  const fields = ENCRYPTED_FIELDS.Invoice;
  const now = new Date().toISOString();

  const setClauses = fields
    .filter((field) => data[field] !== undefined)
    .map((field) => `${field} = ?`)
    .concat(['updatedAt = ?', 'syncVersion = syncVersion + 1']);

  const values = fields.filter((field) => data[field] !== undefined).map((field) => data[field]);
  values.push(now);
  values.push(id);

  await prisma.$executeRawUnsafe(
    `UPDATE Invoice SET ${setClauses.join(', ')} WHERE id = ?`,
    ...values
  );
}

/**
 * Updates encrypted fields for a BankTransaction record.
 * @param prisma
 * @param id
 * @param data
 */
async function updateBankTransactionFields(
  prisma: PrismaClient,
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  const fields = ENCRYPTED_FIELDS.BankTransaction;
  const now = new Date().toISOString();

  const setClauses = fields
    .filter((field) => data[field] !== undefined)
    .map((field) => `${field} = ?`)
    .concat(['updatedAt = ?', 'syncVersion = syncVersion + 1']);

  const values = fields.filter((field) => data[field] !== undefined).map((field) => data[field]);
  values.push(now);
  values.push(id);

  await prisma.$executeRawUnsafe(
    `UPDATE BankTransaction SET ${setClauses.join(', ')} WHERE id = ?`,
    ...values
  );
}

/**
 * Checks if migration is needed by sampling records.
 *
 * @param prisma - PrismaClient instance
 * @returns true if there are unencrypted records
 */
export async function isMigrationNeeded(prisma: PrismaClient): Promise<boolean> {
  // Check a sample Customer
  const customers = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    'SELECT name FROM Customer WHERE deletedAt IS NULL LIMIT 1'
  );

  if (customers.length > 0 && customers[0].name && !isEncrypted(customers[0].name)) {
    return true;
  }

  // Check a sample Invoice with notes/transcription
  const invoices = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    'SELECT notes, transcription FROM Invoice WHERE deletedAt IS NULL AND (notes IS NOT NULL OR transcription IS NOT NULL) LIMIT 1'
  );

  if (invoices.length > 0) {
    if (
      (invoices[0].notes && !isEncrypted(invoices[0].notes)) ||
      (invoices[0].transcription && !isEncrypted(invoices[0].transcription))
    ) {
      return true;
    }
  }

  return false;
}
