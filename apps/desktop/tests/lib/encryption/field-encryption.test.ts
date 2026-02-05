/**
 * Field Encryption Service Tests
 *
 * Tests for encrypting and decrypting database fields.
 * Uses the globalEncryptionContext for key management.
 *
 * @module tests/lib/encryption/field-encryption
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { globalEncryptionContext } from '../../../src/lib/encryption';
import {
  encryptSensitiveFields,
  decryptSensitiveFields,
  ENCRYPTED_FIELDS,
} from '../../../src/lib/encryption/field-encryption';

describe('Field Encryption Service', () => {
  const testLicenseKey = 'LIC-TEST-1234-5678-ABCD';
  const testDeviceId = 'device-test-123';

  beforeEach(() => {
    globalEncryptionContext.initialize(testLicenseKey, testDeviceId);
  });

  afterEach(() => {
    globalEncryptionContext.clear();
  });

  describe('ENCRYPTED_FIELDS configuration', () => {
    it('should define encrypted fields for Customer', () => {
      expect(ENCRYPTED_FIELDS.Customer).toBeDefined();
      expect(ENCRYPTED_FIELDS.Customer).toContain('name');
      expect(ENCRYPTED_FIELDS.Customer).toContain('email');
      expect(ENCRYPTED_FIELDS.Customer).toContain('phone');
      expect(ENCRYPTED_FIELDS.Customer).toContain('address');
    });

    it('should define encrypted fields for Invoice', () => {
      expect(ENCRYPTED_FIELDS.Invoice).toBeDefined();
      expect(ENCRYPTED_FIELDS.Invoice).toContain('transcription');
      expect(ENCRYPTED_FIELDS.Invoice).toContain('notes');
    });

    it('should define encrypted fields for BankTransaction', () => {
      expect(ENCRYPTED_FIELDS.BankTransaction).toBeDefined();
      expect(ENCRYPTED_FIELDS.BankTransaction).toContain('counterparty');
      expect(ENCRYPTED_FIELDS.BankTransaction).toContain('purpose');
    });
  });

  describe('encryptSensitiveFields', () => {
    it('should encrypt sensitive fields in Customer data', () => {
      const customer = {
        id: 'cust-123',
        name: 'Müller GmbH',
        email: 'kontakt@mueller.de',
        phone: '+49 30 12345',
        address: 'Berliner Str. 42',
        country: 'DE',
      };

      const encrypted = encryptSensitiveFields('Customer', customer);

      // Encrypted fields should be base64 strings
      expect(encrypted.name).not.toBe(customer.name);
      expect(encrypted.email).not.toBe(customer.email);
      expect(encrypted.phone).not.toBe(customer.phone);
      expect(encrypted.address).not.toBe(customer.address);

      // Non-encrypted fields should remain unchanged
      expect(encrypted.id).toBe(customer.id);
      expect(encrypted.country).toBe(customer.country);

      // Encrypted values should be base64-like strings
      expect(typeof encrypted.name).toBe('string');
      expect(encrypted.name.length).toBeGreaterThan(customer.name.length);
    });

    it('should handle null values without encryption', () => {
      const customer = {
        id: 'cust-123',
        name: 'Test',
        email: null,
        phone: undefined,
      };

      const encrypted = encryptSensitiveFields('Customer', customer);

      expect(encrypted.email).toBeNull();
      expect(encrypted.phone).toBeUndefined();
    });

    it('should throw if encryption context not initialized', () => {
      globalEncryptionContext.clear();

      const customer = { name: 'Test' };

      expect(() => encryptSensitiveFields('Customer', customer)).toThrow(
        'Encryption context not initialized'
      );
    });

    it('should return unchanged object for unknown model', () => {
      const data = { name: 'Test', value: 123 };

      const result = encryptSensitiveFields('UnknownModel', data);

      expect(result).toEqual(data);
    });
  });

  describe('decryptSensitiveFields', () => {
    it('should decrypt sensitive fields in Customer data', () => {
      const original = {
        id: 'cust-123',
        name: 'Müller GmbH',
        email: 'kontakt@mueller.de',
        phone: '+49 30 12345',
        address: 'Berliner Str. 42',
        country: 'DE',
      };

      // First encrypt
      const encrypted = encryptSensitiveFields('Customer', original);

      // Then decrypt
      const decrypted = decryptSensitiveFields('Customer', encrypted);

      // Should match original
      expect(decrypted.name).toBe(original.name);
      expect(decrypted.email).toBe(original.email);
      expect(decrypted.phone).toBe(original.phone);
      expect(decrypted.address).toBe(original.address);
      expect(decrypted.id).toBe(original.id);
      expect(decrypted.country).toBe(original.country);
    });

    it('should handle German umlauts and special characters', () => {
      const original = {
        name: 'Größe & Fläche: 5m², Preis: 1.234,56€',
        notes: 'Sonderzeichen: äöüß ÄÖÜ',
      };

      const encrypted = encryptSensitiveFields('Customer', original);
      const decrypted = decryptSensitiveFields('Customer', encrypted);

      expect(decrypted.name).toBe(original.name);
      expect(decrypted.notes).toBe(original.notes);
    });

    it('should handle null values without decryption', () => {
      const data = {
        id: 'cust-123',
        name: null,
        email: undefined,
      };

      const decrypted = decryptSensitiveFields('Customer', data);

      expect(decrypted.name).toBeNull();
      expect(decrypted.email).toBeUndefined();
    });

    it('should handle already-unencrypted data gracefully', () => {
      const plaintext = {
        id: 'cust-123',
        name: 'Plain Text Name',
        country: 'DE',
      };

      // This should not throw, but return the data as-is if decryption fails
      // (for backwards compatibility with legacy unencrypted data)
      const result = decryptSensitiveFields('Customer', plaintext);

      // Either decrypted or original value
      expect(result.name).toBeDefined();
      expect(result.country).toBe('DE');
    });
  });

  describe('Roundtrip encryption/decryption', () => {
    it('should correctly roundtrip Invoice data', () => {
      const invoice = {
        id: 'inv-123',
        number: 'INV-000001',
        customerId: 'cust-456',
        transcription: 'Rechnung an Firma Müller über 500 Euro',
        notes: 'Zahlungsziel 30 Tage',
        total: 500.0,
        status: 'DRAFT',
      };

      const encrypted = encryptSensitiveFields('Invoice', invoice);
      const decrypted = decryptSensitiveFields('Invoice', encrypted);

      expect(decrypted.transcription).toBe(invoice.transcription);
      expect(decrypted.notes).toBe(invoice.notes);
      expect(decrypted.total).toBe(invoice.total);
      expect(decrypted.status).toBe(invoice.status);
    });

    it('should correctly roundtrip BankTransaction data', () => {
      const transaction = {
        id: 'tx-123',
        counterparty: 'Max Mustermann',
        counterpartyIban: 'DE89370400440532013000',
        purpose: 'Rechnung INV-000001',
        amount: 595.0,
      };

      const encrypted = encryptSensitiveFields('BankTransaction', transaction);
      const decrypted = decryptSensitiveFields('BankTransaction', encrypted);

      expect(decrypted.counterparty).toBe(transaction.counterparty);
      expect(decrypted.counterpartyIban).toBe(transaction.counterpartyIban);
      expect(decrypted.purpose).toBe(transaction.purpose);
      expect(decrypted.amount).toBe(transaction.amount);
    });
  });
});
