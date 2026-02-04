import { describe, it, expect } from 'vitest';
import { deriveEncryptionKey, deriveTenantId } from '../src/key-derivation';

describe('Key Derivation', () => {
  const licenseKey = 'LIC-TEST-1234-5678';
  const deviceId = 'device-abc-123';

  describe('deriveEncryptionKey', () => {
    it('should derive deterministic encryption key', () => {
      const key1 = deriveEncryptionKey(licenseKey, deviceId);
      const key2 = deriveEncryptionKey(licenseKey, deviceId);

      expect(key1).toEqual(key2);
      expect(key1.length).toBe(32); // 256 bits
    });

    it('should derive different keys for different licenses', () => {
      const key1 = deriveEncryptionKey(licenseKey, deviceId);
      const key2 = deriveEncryptionKey('LIC-OTHER-9999', deviceId);

      expect(key1).not.toEqual(key2);
    });

    it('should derive different keys for different devices', () => {
      const key1 = deriveEncryptionKey(licenseKey, deviceId);
      const key2 = deriveEncryptionKey(licenseKey, 'device-other-456');

      expect(key1).not.toEqual(key2);
    });

    it('should return Uint8Array', () => {
      const key = deriveEncryptionKey(licenseKey, deviceId);

      expect(key).toBeInstanceOf(Uint8Array);
    });
  });

  describe('deriveTenantId', () => {
    it('should derive tenant ID from license key', () => {
      const tenantId = deriveTenantId(licenseKey);

      expect(tenantId).toMatch(/^[a-f0-9]{16}$/);
    });

    it('should derive deterministic tenant ID', () => {
      const tenantId1 = deriveTenantId(licenseKey);
      const tenantId2 = deriveTenantId(licenseKey);

      expect(tenantId1).toBe(tenantId2);
    });

    it('should derive different tenant IDs for different licenses', () => {
      const tenantId1 = deriveTenantId(licenseKey);
      const tenantId2 = deriveTenantId('LIC-OTHER-9999');

      expect(tenantId1).not.toBe(tenantId2);
    });
  });
});
