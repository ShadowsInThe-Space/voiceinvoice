/**
 * Field Encryption Service
 *
 * Encrypts and decrypts sensitive database fields transparently.
 * Works with raw SQL queries by processing data before/after queries.
 *
 * @module lib/encryption/field-encryption
 */

import { globalEncryptionContext } from './encryption-context';

/**
 * Configuration of which fields to encrypt for each model.
 * Only sensitive PII fields are encrypted.
 */
export const ENCRYPTED_FIELDS: Record<string, string[]> = {
  Customer: ['name', 'email', 'phone', 'address', 'notes', 'taxId'],
  Invoice: ['transcription', 'notes'],
  InvoiceItem: ['description'],
  BankTransaction: ['counterparty', 'counterpartyIban', 'purpose'],
  Setting: ['value'], // Settings may contain sensitive config
};

/**
 * Type for a record with string keys and any values.
 */
type DataRecord = Record<string, unknown>;

/**
 * Encrypts sensitive fields in a data object before database write.
 *
 * @param modelName - The Prisma model name (e.g., 'Customer', 'Invoice')
 * @param data - The data object to encrypt
 * @returns New object with encrypted fields
 * @throws Error if encryption context not initialized
 *
 * @example
 * ```typescript
 * const customer = { name: 'Müller GmbH', email: 'info@mueller.de' };
 * const encrypted = encryptSensitiveFields('Customer', customer);
 * // encrypted.name is now base64-encoded ciphertext
 * ```
 */
export function encryptSensitiveFields<T extends DataRecord>(modelName: string, data: T): T {
  const fieldsToEncrypt = ENCRYPTED_FIELDS[modelName];

  // Return unchanged if no fields defined for this model
  if (!fieldsToEncrypt || fieldsToEncrypt.length === 0) {
    return data;
  }

  // Check encryption context
  if (!globalEncryptionContext.isInitialized()) {
    throw new Error('Encryption context not initialized');
  }

  // Create a copy to avoid mutating the original
  const result = { ...data } as T;

  for (const field of fieldsToEncrypt) {
    const value = data[field];

    // Only encrypt non-null string values
    if (value !== null && value !== undefined && typeof value === 'string') {
      (result as DataRecord)[field] = globalEncryptionContext.encryptField(value);
    }
  }

  return result;
}

/**
 * Decrypts sensitive fields in a data object after database read.
 *
 * @param modelName - The Prisma model name (e.g., 'Customer', 'Invoice')
 * @param data - The data object to decrypt
 * @returns New object with decrypted fields
 *
 * @example
 * ```typescript
 * const encrypted = await db.getCustomerById(id);
 * const customer = decryptSensitiveFields('Customer', encrypted);
 * // customer.name is now plaintext
 * ```
 */
export function decryptSensitiveFields<T extends DataRecord>(modelName: string, data: T): T {
  const fieldsToDecrypt = ENCRYPTED_FIELDS[modelName];

  // Return unchanged if no fields defined for this model
  if (!fieldsToDecrypt || fieldsToDecrypt.length === 0) {
    return data;
  }

  // If encryption context not initialized, return unchanged
  // (allows reading legacy unencrypted data)
  if (!globalEncryptionContext.isInitialized()) {
    return data;
  }

  // Create a copy to avoid mutating the original
  const result = { ...data } as T;

  for (const field of fieldsToDecrypt) {
    const value = data[field];

    // Only decrypt non-null string values
    if (value !== null && value !== undefined && typeof value === 'string') {
      try {
        (result as DataRecord)[field] = globalEncryptionContext.decryptField(value);
      } catch {
        // If decryption fails, the field might not be encrypted (legacy data)
        // Keep the original value
        (result as DataRecord)[field] = value;
      }
    }
  }

  return result;
}

/**
 * Decrypts sensitive fields in an array of data objects.
 *
 * @param modelName - The Prisma model name
 * @param dataArray - Array of data objects to decrypt
 * @returns New array with decrypted objects
 */
export function decryptSensitiveFieldsArray<T extends DataRecord>(
  modelName: string,
  dataArray: T[]
): T[] {
  return dataArray.map((item) => decryptSensitiveFields(modelName, item));
}

/**
 * Checks if a field value appears to be encrypted.
 * Encrypted values are base64-encoded with a minimum length.
 *
 * @param value - The value to check
 * @returns true if the value appears to be encrypted
 */
export function isEncrypted(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  // Encrypted values are base64 with [IV (12 bytes)][ciphertext][tag (16 bytes)]
  // Minimum length: 12 + 1 + 16 = 29 bytes = 40+ base64 chars
  if (value.length < 40) {
    return false;
  }

  // Check if it looks like base64
  return /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

/**
 * Gets the list of encrypted fields for a model.
 *
 * @param modelName - The model name
 * @returns Array of field names or empty array
 */
export function getEncryptedFields(modelName: string): string[] {
  return ENCRYPTED_FIELDS[modelName] || [];
}
