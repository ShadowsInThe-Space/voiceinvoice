/**
 * Tests for PrivacyEngine.
 *
 * Tests GDPR/DSGVO compliance features including
 * encryption, consent management, data export, and deletion.
 *
 * @module tests/privacy/privacy-engine
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrivacyEngine, ConsentType, DataExportFormat } from '../../src/lib/privacy/privacy-engine';

describe('PrivacyEngine', () => {
  let engine: PrivacyEngine;
  let mockStorage: Map<string, string>;

  const createMockStorageProvider = (): {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<void>;
    delete: (key: string) => Promise<void>;
    getAll: () => Promise<Record<string, string>>;
  } => ({
    get: vi.fn(async (key: string) => mockStorage.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      mockStorage.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      mockStorage.delete(key);
    }),
    getAll: vi.fn(async () => Object.fromEntries(mockStorage)),
  });

  beforeEach(() => {
    mockStorage = new Map();
    engine = new PrivacyEngine({
      storageProvider: createMockStorageProvider(),
      encryptionKey: 'test-encryption-key-32-chars-xx',
    });
  });

  describe('Encryption', () => {
    describe('encrypt', () => {
      it('should encrypt plaintext data', () => {
        const plaintext = 'sensitive data';

        const encrypted = engine.encrypt(plaintext);

        expect(encrypted).not.toBe(plaintext);
        expect(encrypted.length).toBeGreaterThan(plaintext.length);
      });

      it('should produce different ciphertext for same plaintext (IV)', () => {
        const plaintext = 'same data';

        const encrypted1 = engine.encrypt(plaintext);
        const encrypted2 = engine.encrypt(plaintext);

        // Due to random IV, encrypted values should differ
        expect(encrypted1).not.toBe(encrypted2);
      });

      it('should handle empty string', () => {
        const encrypted = engine.encrypt('');

        expect(encrypted).toBeDefined();
        expect(typeof encrypted).toBe('string');
      });

      it('should handle unicode characters', () => {
        const plaintext = 'Müller GmbH - Hauptstraße 42 €';

        const encrypted = engine.encrypt(plaintext);

        expect(encrypted).not.toBe(plaintext);
      });
    });

    describe('decrypt', () => {
      it('should decrypt encrypted data back to original', () => {
        const original = 'test data';
        const encrypted = engine.encrypt(original);

        const decrypted = engine.decrypt(encrypted);

        expect(decrypted).toBe(original);
      });

      it('should handle unicode after round-trip', () => {
        const original = 'Büro München €100,00';
        const encrypted = engine.encrypt(original);

        const decrypted = engine.decrypt(encrypted);

        expect(decrypted).toBe(original);
      });

      it('should throw on invalid encrypted data', () => {
        expect(() => engine.decrypt('invalid-data')).toThrow();
      });
    });

    describe('hashData', () => {
      it('should produce consistent hash for same input', () => {
        const data = 'test@email.com';

        const hash1 = engine.hashData(data);
        const hash2 = engine.hashData(data);

        expect(hash1).toBe(hash2);
      });

      it('should produce different hash for different input', () => {
        const hash1 = engine.hashData('email1@test.com');
        const hash2 = engine.hashData('email2@test.com');

        expect(hash1).not.toBe(hash2);
      });

      it('should be one-way (cannot recover original)', () => {
        const original = 'secret data';
        const hash = engine.hashData(original);

        expect(hash).not.toContain(original);
        expect(hash.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Consent Management', () => {
    describe('grantConsent', () => {
      it('should record consent with timestamp', async () => {
        const result = await engine.grantConsent(ConsentType.DATA_PROCESSING);

        expect(result.success).toBe(true);
        expect(result.consentId).toBeDefined();
      });

      it('should store consent details', async () => {
        await engine.grantConsent(ConsentType.VOICE_RECORDING, {
          purpose: 'Invoice dictation',
        });

        const status = await engine.getConsentStatus(ConsentType.VOICE_RECORDING);

        expect(status.granted).toBe(true);
        expect(status.grantedAt).toBeInstanceOf(Date);
      });

      it('should record metadata like IP and user agent', async () => {
        await engine.grantConsent(ConsentType.ANALYTICS, {
          ipAddress: '192.168.1.1',
          userAgent: 'Test Browser',
        });

        const consent = await engine.getConsentRecord(ConsentType.ANALYTICS);

        expect(consent?.ipAddress).toBe('192.168.1.1');
        expect(consent?.userAgent).toBe('Test Browser');
      });
    });

    describe('revokeConsent', () => {
      it('should mark consent as revoked', async () => {
        await engine.grantConsent(ConsentType.DATA_PROCESSING);

        await engine.revokeConsent(ConsentType.DATA_PROCESSING);

        const status = await engine.getConsentStatus(ConsentType.DATA_PROCESSING);
        expect(status.granted).toBe(false);
        expect(status.revokedAt).toBeInstanceOf(Date);
      });

      it('should preserve grant history after revocation', async () => {
        await engine.grantConsent(ConsentType.MARKETING);
        await engine.revokeConsent(ConsentType.MARKETING);

        const consent = await engine.getConsentRecord(ConsentType.MARKETING);

        expect(consent?.grantedAt).toBeDefined();
        expect(consent?.revokedAt).toBeDefined();
      });
    });

    describe('getConsentStatus', () => {
      it('should return not granted for new consent type', async () => {
        const status = await engine.getConsentStatus(ConsentType.DATA_PROCESSING);

        expect(status.granted).toBe(false);
        expect(status.grantedAt).toBeUndefined();
      });

      it('should correctly reflect current state', async () => {
        await engine.grantConsent(ConsentType.DATA_PROCESSING);
        const statusAfterGrant = await engine.getConsentStatus(ConsentType.DATA_PROCESSING);

        await engine.revokeConsent(ConsentType.DATA_PROCESSING);
        const statusAfterRevoke = await engine.getConsentStatus(ConsentType.DATA_PROCESSING);

        expect(statusAfterGrant.granted).toBe(true);
        expect(statusAfterRevoke.granted).toBe(false);
      });
    });

    describe('getAllConsents', () => {
      it('should return all consent records', async () => {
        await engine.grantConsent(ConsentType.DATA_PROCESSING);
        await engine.grantConsent(ConsentType.VOICE_RECORDING);

        const consents = await engine.getAllConsents();

        expect(consents.length).toBe(2);
      });
    });

    describe('hasRequiredConsents', () => {
      it('should return true when all required consents granted', async () => {
        await engine.grantConsent(ConsentType.DATA_PROCESSING);

        const hasRequired = await engine.hasRequiredConsents([ConsentType.DATA_PROCESSING]);

        expect(hasRequired).toBe(true);
      });

      it('should return false when any required consent missing', async () => {
        await engine.grantConsent(ConsentType.DATA_PROCESSING);

        const hasRequired = await engine.hasRequiredConsents([
          ConsentType.DATA_PROCESSING,
          ConsentType.VOICE_RECORDING,
        ]);

        expect(hasRequired).toBe(false);
      });
    });
  });

  describe('Data Export (GDPR Art. 20)', () => {
    describe('exportUserData', () => {
      it('should export data in JSON format', async () => {
        const mockData = {
          customers: [{ id: '1', name: 'Test Customer' }],
          invoices: [{ id: '1', number: 'INV-001' }],
          settings: { theme: 'dark' },
        };

        const exported = await engine.exportUserData(mockData, DataExportFormat.JSON);

        expect(exported.format).toBe(DataExportFormat.JSON);
        expect(exported.data).toContain('customers');
        expect(exported.exportedAt).toBeInstanceOf(Date);
      });

      it('should export data in CSV format', async () => {
        const mockData = {
          customers: [
            { id: '1', name: 'Customer A', email: 'a@test.com' },
            { id: '2', name: 'Customer B', email: 'b@test.com' },
          ],
        };

        const exported = await engine.exportUserData(mockData, DataExportFormat.CSV);

        expect(exported.format).toBe(DataExportFormat.CSV);
        expect(exported.data).toContain('id,name,email');
        expect(exported.data).toContain('Customer A');
      });

      it('should include metadata in export', async () => {
        const mockData = { test: 'data' };

        const exported = await engine.exportUserData(mockData, DataExportFormat.JSON);

        const parsed = JSON.parse(exported.data);
        expect(parsed.metadata).toBeDefined();
        expect(parsed.metadata.exportedAt).toBeDefined();
        expect(parsed.metadata.format).toBe('GDPR_DATA_EXPORT');
      });
    });
  });

  describe('Data Deletion (Right to be Forgotten)', () => {
    describe('requestDataDeletion', () => {
      it('should create deletion request with confirmation', async () => {
        const request = await engine.requestDataDeletion('user@email.com');

        expect(request.requestId).toBeDefined();
        expect(request.status).toBe('PENDING');
        expect(request.confirmationRequired).toBe(true);
      });

      it('should require email confirmation before deletion', async () => {
        const request = await engine.requestDataDeletion('user@email.com');

        expect(request.confirmationCode).toBeDefined();
        expect(request.expiresAt).toBeInstanceOf(Date);
      });
    });

    describe('confirmDataDeletion', () => {
      it('should process deletion after confirmation', async () => {
        const request = await engine.requestDataDeletion('user@email.com');

        const result = await engine.confirmDataDeletion(
          request.requestId,
          request.confirmationCode
        );

        expect(result.success).toBe(true);
        expect(result.deletedItems).toBeDefined();
      });

      it('should fail with invalid confirmation code', async () => {
        const request = await engine.requestDataDeletion('user@email.com');

        const result = await engine.confirmDataDeletion(request.requestId, 'invalid-code');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid');
      });

      it('should fail if request expired', async () => {
        const request = await engine.requestDataDeletion('user@email.com');

        // Simulate expiration by manipulating the request
        engine.expireDeletionRequest(request.requestId);

        const result = await engine.confirmDataDeletion(
          request.requestId,
          request.confirmationCode
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('expired');
      });
    });

    describe('anonymizeData', () => {
      it('should replace PII with anonymous values', () => {
        const data = {
          name: 'Max Mustermann',
          email: 'max@example.com',
          phone: '+49 123 456789',
          address: 'Hauptstraße 1, Berlin',
        };

        const anonymized = engine.anonymizeData(data);

        expect(anonymized.name).not.toBe('Max Mustermann');
        expect(anonymized.email).not.toContain('@');
        expect(anonymized.phone).not.toContain('+49');
        expect(anonymized.address).not.toContain('Berlin');
      });

      it('should preserve non-PII fields', () => {
        const data = {
          id: '123',
          amount: 100.5,
          date: '2024-01-15',
          email: 'test@test.com',
        };

        const anonymized = engine.anonymizeData(data);

        expect(anonymized.id).toBe('123');
        expect(anonymized.amount).toBe(100.5);
        expect(anonymized.date).toBe('2024-01-15');
      });
    });
  });

  describe('Privacy Settings', () => {
    describe('getPrivacySettings', () => {
      it('should return default settings initially', async () => {
        const settings = await engine.getPrivacySettings();

        expect(settings.dataRetentionDays).toBeDefined();
        expect(settings.encryptionEnabled).toBe(true);
        expect(settings.analyticsEnabled).toBe(false);
      });
    });

    describe('updatePrivacySettings', () => {
      it('should update specified settings', async () => {
        await engine.updatePrivacySettings({
          dataRetentionDays: 90,
          analyticsEnabled: true,
        });

        const settings = await engine.getPrivacySettings();

        expect(settings.dataRetentionDays).toBe(90);
        expect(settings.analyticsEnabled).toBe(true);
      });

      it('should preserve unmodified settings', async () => {
        const originalSettings = await engine.getPrivacySettings();

        await engine.updatePrivacySettings({
          analyticsEnabled: true,
        });

        const newSettings = await engine.getPrivacySettings();

        expect(newSettings.encryptionEnabled).toBe(originalSettings.encryptionEnabled);
      });
    });

    describe('generatePrivacyReport', () => {
      it('should generate comprehensive privacy report', async () => {
        await engine.grantConsent(ConsentType.DATA_PROCESSING);
        await engine.grantConsent(ConsentType.VOICE_RECORDING);

        const report = await engine.generatePrivacyReport();

        expect(report.consents).toBeDefined();
        expect(report.settings).toBeDefined();
        expect(report.dataCategories).toBeDefined();
        expect(report.generatedAt).toBeInstanceOf(Date);
      });
    });
  });

  describe('Audit Trail', () => {
    describe('logPrivacyEvent', () => {
      it('should log privacy-related events', async () => {
        await engine.logPrivacyEvent({
          type: 'CONSENT_GRANTED',
          details: { consentType: ConsentType.DATA_PROCESSING },
        });

        const logs = await engine.getPrivacyAuditLog();

        expect(logs.length).toBe(1);
        expect(logs[0].type).toBe('CONSENT_GRANTED');
      });
    });

    describe('getPrivacyAuditLog', () => {
      it('should return events in chronological order', async () => {
        await engine.logPrivacyEvent({ type: 'CONSENT_GRANTED', details: {} });
        await engine.logPrivacyEvent({ type: 'DATA_EXPORTED', details: {} });
        await engine.logPrivacyEvent({ type: 'CONSENT_REVOKED', details: {} });

        const logs = await engine.getPrivacyAuditLog();

        expect(logs.length).toBe(3);
        expect(logs[0].timestamp.getTime()).toBeLessThanOrEqual(logs[1].timestamp.getTime());
      });

      it('should filter by date range', async () => {
        await engine.logPrivacyEvent({ type: 'EVENT_1', details: {} });

        const logs = await engine.getPrivacyAuditLog({
          from: new Date(Date.now() - 1000),
          to: new Date(Date.now() + 1000),
        });

        expect(logs.length).toBe(1);
      });
    });
  });
});
