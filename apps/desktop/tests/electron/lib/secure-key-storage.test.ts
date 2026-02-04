/**
 * Secure Key Storage Tests
 *
 * Tests for the SecureKeyStorage class.
 * Mocks Electron safeStorage and fs modules.
 *
 * @module tests/electron/lib/secure-key-storage
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock Electron modules before any imports - mocks are hoisted
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn(),
    decryptString: vi.fn(),
  },
  app: {
    getPath: vi.fn(() => '/mock/user/data'),
  },
}));

// Mock fs/promises
vi.mock('fs', () => ({
  promises: {
    writeFile: vi.fn(() => Promise.resolve(undefined)),
    readFile: vi.fn(),
    unlink: vi.fn(() => Promise.resolve(undefined)),
    access: vi.fn(),
    stat: vi.fn(),
  },
  constants: { F_OK: 0 },
}));

// Now import the modules
import { SecureKeyStorage } from '../../../electron/lib/secure-key-storage';
import { safeStorage, app } from 'electron';
import * as fs from 'fs';

describe('SecureKeyStorage', () => {
  let storage: SecureKeyStorage;
  const testKey = new Uint8Array(32).fill(1); // Valid 32-byte key

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
    vi.mocked(app.getPath).mockReturnValue('/mock/user/data');
    storage = new SecureKeyStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should use userData path for storage', () => {
      expect(app.getPath).toHaveBeenCalledWith('userData');
    });
  });

  describe('isAvailable', () => {
    it('should return true when safeStorage is available', () => {
      vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);

      expect(storage.isAvailable()).toBe(true);
    });

    it('should return false when safeStorage is not available', () => {
      vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false);

      expect(storage.isAvailable()).toBe(false);
    });
  });

  describe('storeKey', () => {
    it('should encrypt and store the key', async () => {
      const encryptedData = Buffer.from('encrypted-key-data');
      vi.mocked(safeStorage.encryptString).mockReturnValue(encryptedData);

      await storage.storeKey(testKey);

      expect(safeStorage.encryptString).toHaveBeenCalledWith(
        Buffer.from(testKey).toString('base64')
      );
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        '/mock/user/data/encryption-key.enc',
        encryptedData
      );
    });

    it('should throw if secure storage not available', async () => {
      vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false);

      await expect(storage.storeKey(testKey)).rejects.toThrow('Secure storage not available');
    });

    it('should throw if key length is invalid', async () => {
      const invalidKey = new Uint8Array(16); // Wrong size

      await expect(storage.storeKey(invalidKey)).rejects.toThrow('Invalid key length');
    });
  });

  describe('retrieveKey', () => {
    it('should decrypt and return the stored key', async () => {
      const encryptedData = Buffer.from('encrypted');
      const keyBase64 = Buffer.from(testKey).toString('base64');

      vi.mocked(fs.promises.readFile).mockResolvedValue(encryptedData);
      vi.mocked(safeStorage.decryptString).mockReturnValue(keyBase64);

      const result = await storage.retrieveKey();

      expect(result).toEqual(testKey);
      expect(safeStorage.decryptString).toHaveBeenCalledWith(encryptedData);
    });

    it('should return null if file does not exist', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      vi.mocked(fs.promises.readFile).mockRejectedValue(error);

      const result = await storage.retrieveKey();

      expect(result).toBeNull();
    });

    it('should return null if safeStorage not available', async () => {
      vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false);

      const result = await storage.retrieveKey();

      expect(result).toBeNull();
    });

    it('should return null if stored key has invalid length', async () => {
      const invalidKeyBase64 = Buffer.from(new Uint8Array(16)).toString('base64');

      vi.mocked(fs.promises.readFile).mockResolvedValue(Buffer.from('encrypted'));
      vi.mocked(safeStorage.decryptString).mockReturnValue(invalidKeyBase64);

      const result = await storage.retrieveKey();

      expect(result).toBeNull();
    });
  });

  describe('hasKey', () => {
    it('should return true if key file exists', async () => {
      vi.mocked(fs.promises.access).mockResolvedValue(undefined);

      const result = await storage.hasKey();

      expect(result).toBe(true);
    });

    it('should return false if key file does not exist', async () => {
      vi.mocked(fs.promises.access).mockRejectedValue(new Error('ENOENT'));

      const result = await storage.hasKey();

      expect(result).toBe(false);
    });
  });

  describe('deleteKey', () => {
    it('should securely overwrite and delete the key file', async () => {
      vi.mocked(fs.promises.access).mockResolvedValue(undefined);
      vi.mocked(fs.promises.stat).mockResolvedValue({ size: 100 } as fs.Stats);

      await storage.deleteKey();

      // Should overwrite with random data first
      expect(fs.promises.writeFile).toHaveBeenCalled();
      // Then delete
      expect(fs.promises.unlink).toHaveBeenCalledWith('/mock/user/data/encryption-key.enc');
    });

    it('should not throw if file does not exist', async () => {
      vi.mocked(fs.promises.access).mockRejectedValue(new Error('ENOENT'));

      await expect(storage.deleteKey()).resolves.not.toThrow();
    });
  });

  describe('getMetadata', () => {
    it('should return parsed metadata', async () => {
      const metadata = {
        createdAt: '2024-01-01T00:00:00Z',
        lastUsedAt: '2024-01-02T00:00:00Z',
        keyVersion: 1,
      };
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(metadata));

      const result = await storage.getMetadata();

      expect(result).toEqual(metadata);
    });

    it('should return null if metadata file does not exist', async () => {
      vi.mocked(fs.promises.readFile).mockRejectedValue(new Error('ENOENT'));

      const result = await storage.getMetadata();

      expect(result).toBeNull();
    });
  });
});
