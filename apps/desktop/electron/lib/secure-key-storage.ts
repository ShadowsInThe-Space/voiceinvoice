/**
 * Secure Key Storage for VoiceInvoice Enterprise.
 *
 * Uses Electron safeStorage to store encryption keys in the
 * operating system's keychain (macOS Keychain, Windows Credential Store,
 * Linux Secret Service).
 *
 * @module electron/lib/secure-key-storage
 */

import { safeStorage, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

/**
 * File name for storing encrypted key data.
 */
const KEY_FILE = 'encryption-key.enc';

/**
 * File name for storing key metadata (non-sensitive).
 */
const METADATA_FILE = 'key-metadata.json';

/**
 * Key metadata structure.
 */
interface KeyMetadata {
  createdAt: string;
  lastUsedAt: string;
  keyVersion: number;
}

/**
 * Secure Key Storage using OS keychain via Electron safeStorage.
 *
 * @example
 * ```typescript
 * const storage = new SecureKeyStorage();
 *
 * // Store key after license validation
 * await storage.storeKey(derivedKey);
 *
 * // Retrieve key on app startup
 * const key = await storage.retrieveKey();
 * if (key) {
 *   encryptionContext.initializeWithKey(key);
 * }
 *
 * // Clear on logout
 * await storage.deleteKey();
 * ```
 */
export class SecureKeyStorage {
  private keyPath: string;
  private metadataPath: string;

  /**
   * Creates a new SecureKeyStorage instance.
   * Uses Electron's userData path for storage.
   */
  constructor() {
    const userDataPath = app.getPath('userData');
    this.keyPath = path.join(userDataPath, KEY_FILE);
    this.metadataPath = path.join(userDataPath, METADATA_FILE);
  }

  /**
   * Checks if secure storage is available on this system.
   *
   * @returns true if safeStorage encryption is available
   */
  isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  /**
   * Stores the encryption key securely using OS keychain.
   *
   * @param key - The encryption key (32 bytes for AES-256)
   * @throws Error if secure storage not available
   */
  async storeKey(key: Uint8Array): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Secure storage not available on this system');
    }

    // Validate key length
    if (key.length !== 32) {
      throw new Error('Invalid key length: expected 32 bytes for AES-256');
    }

    // Encrypt the key using OS keychain
    const keyBase64 = Buffer.from(key).toString('base64');
    const encrypted = safeStorage.encryptString(keyBase64);

    // Write encrypted key to file
    await fs.promises.writeFile(this.keyPath, encrypted);

    // Update metadata
    const metadata = await this.getMetadata();
    const newMetadata: KeyMetadata = {
      createdAt: metadata?.createdAt || new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
      keyVersion: (metadata?.keyVersion || 0) + 1,
    };
    await this.saveMetadata(newMetadata);
  }

  /**
   * Retrieves the stored encryption key.
   *
   * @returns The encryption key or null if not stored
   */
  async retrieveKey(): Promise<Uint8Array | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      // Read encrypted key file
      const encrypted = await fs.promises.readFile(this.keyPath);

      // Decrypt using OS keychain
      const keyBase64 = safeStorage.decryptString(encrypted);
      const key = new Uint8Array(Buffer.from(keyBase64, 'base64'));

      // Validate key length
      if (key.length !== 32) {
        console.error('[SecureKeyStorage] Invalid stored key length');
        return null;
      }

      // Update last used timestamp
      const metadata = await this.getMetadata();
      if (metadata) {
        metadata.lastUsedAt = new Date().toISOString();
        await this.saveMetadata(metadata);
      }

      return key;
    } catch (error) {
      // File might not exist or decryption failed
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[SecureKeyStorage] Failed to retrieve key:', error);
      }
      return null;
    }
  }

  /**
   * Checks if a key is stored.
   *
   * @returns true if a key exists
   */
  async hasKey(): Promise<boolean> {
    try {
      await fs.promises.access(this.keyPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Deletes the stored key (on logout/license revocation).
   * Securely overwrites the file before deletion.
   */
  async deleteKey(): Promise<void> {
    try {
      // Check if file exists
      const exists = await this.hasKey();
      if (!exists) {
        return;
      }

      // Get file size for secure overwrite
      const stats = await fs.promises.stat(this.keyPath);
      const fileSize = stats.size;

      // Securely overwrite with random data before deletion
      const randomData = Buffer.alloc(fileSize);
      for (let i = 0; i < fileSize; i++) {
        randomData[i] = Math.floor(Math.random() * 256);
      }
      await fs.promises.writeFile(this.keyPath, randomData);

      // Delete the file
      await fs.promises.unlink(this.keyPath);

      // Delete metadata
      try {
        await fs.promises.unlink(this.metadataPath);
      } catch {
        // Metadata file might not exist
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[SecureKeyStorage] Failed to delete key:', error);
        throw error;
      }
    }
  }

  /**
   * Gets key metadata.
   *
   * @returns Key metadata or null if not available
   */
  async getMetadata(): Promise<KeyMetadata | null> {
    try {
      const data = await fs.promises.readFile(this.metadataPath, 'utf-8');
      return JSON.parse(data) as KeyMetadata;
    } catch {
      return null;
    }
  }

  /**
   * Saves key metadata.
   *
   * @param metadata - Metadata to save
   */
  private async saveMetadata(metadata: KeyMetadata): Promise<void> {
    await fs.promises.writeFile(this.metadataPath, JSON.stringify(metadata, null, 2));
  }
}

/**
 * Singleton instance for app-wide secure key storage.
 */
let secureKeyStorageInstance: SecureKeyStorage | null = null;

/**
 * Gets the global SecureKeyStorage instance.
 * Creates it on first call.
 *
 * @returns The SecureKeyStorage singleton
 */
export function getSecureKeyStorage(): SecureKeyStorage {
  if (!secureKeyStorageInstance) {
    secureKeyStorageInstance = new SecureKeyStorage();
  }
  return secureKeyStorageInstance;
}
