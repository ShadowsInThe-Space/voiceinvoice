/**
 * Encryption Context for E2E encrypted sync.
 *
 * Manages encryption keys derived from license key and device ID.
 * Must be initialized after successful license validation.
 *
 * @module lib/encryption/encryption-context
 */

import {
  deriveEncryptionKey,
  deriveTenantId,
  encrypt,
  decrypt,
  serializeEncrypted,
  deserializeEncrypted,
} from '@voiceinvoice/encryption-layer';

/**
 * Generates or retrieves a unique device ID.
 * Uses localStorage for persistence across sessions.
 */
function getDeviceId(): string {
  const DEVICE_ID_KEY = 'voiceinvoice_device_id';

  // Check localStorage first
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);

  if (!deviceId) {
    // Generate new UUID v4
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }

  return deviceId;
}

/**
 * Encryption Context for managing E2E encryption state.
 *
 * The context derives encryption keys from the license key and device ID
 * using HKDF-SHA256. Keys are stored in memory only and never persisted.
 *
 * @example
 * ```typescript
 * // After license validation
 * globalEncryptionContext.initialize(licenseKey, getDeviceId());
 *
 * // Encrypt data for sync
 * const encrypted = globalEncryptionContext.encryptForSync(invoiceData);
 *
 * // Get tenant ID for Supabase RLS
 * const tenantId = globalEncryptionContext.getTenantId();
 * ```
 */
export class EncryptionContext {
  private encryptionKey: Uint8Array | null = null;
  private tenantId: string | null = null;
  private licenseKey: string | null = null;

  /**
   * Initializes encryption context from license key and device ID.
   * Call this after successful license validation.
   *
   * @param licenseKey - The validated license key
   * @param deviceId - Unique device identifier (optional, auto-generated if not provided)
   * @throws Error if license key is empty
   */
  initialize(licenseKey: string, deviceId?: string): void {
    if (!licenseKey || licenseKey.trim() === '') {
      throw new Error('License key cannot be empty');
    }

    const effectiveDeviceId = deviceId || getDeviceId();

    this.encryptionKey = deriveEncryptionKey(licenseKey, effectiveDeviceId);
    this.tenantId = deriveTenantId(licenseKey);
    this.licenseKey = licenseKey;
  }

  /**
   * Checks if the encryption context has been initialized.
   *
   * @returns true if encryption is ready to use
   */
  isInitialized(): boolean {
    return this.encryptionKey !== null && this.tenantId !== null;
  }

  /**
   * Gets the tenant ID for Supabase RLS.
   *
   * @returns The derived tenant ID (16-char hex string)
   * @throws Error if context not initialized
   */
  getTenantId(): string {
    if (!this.tenantId) {
      throw new Error('Encryption context not initialized');
    }
    return this.tenantId;
  }

  /**
   * Gets the current license key.
   *
   * @returns The license key or null if not initialized
   */
  getLicenseKey(): string | null {
    return this.licenseKey;
  }

  /**
   * Encrypts data for sync to server.
   * Returns a base64-encoded string suitable for storage.
   *
   * @param data - Object to encrypt (will be JSON stringified)
   * @returns Base64-encoded encrypted data
   * @throws Error if context not initialized
   *
   * @example
   * ```typescript
   * const encrypted = context.encryptForSync({
   *   customerName: 'Müller GmbH',
   *   amount: 1234.56
   * });
   * // Returns: "base64encodedstring..."
   * ```
   */
  encryptForSync<T>(data: T): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption context not initialized');
    }

    const json = JSON.stringify(data);
    const encrypted = encrypt(json, this.encryptionKey);
    return serializeEncrypted(encrypted);
  }

  /**
   * Decrypts data received from server.
   *
   * @param encryptedData - Base64-encoded encrypted data
   * @returns Decrypted and parsed object
   * @throws Error if context not initialized or decryption fails
   *
   * @example
   * ```typescript
   * const invoice = context.decryptFromSync<Invoice>(encryptedBase64);
   * console.log(invoice.customerName); // "Müller GmbH"
   * ```
   */
  decryptFromSync<T>(encryptedData: string): T {
    if (!this.encryptionKey) {
      throw new Error('Encryption context not initialized');
    }

    const encrypted = deserializeEncrypted(encryptedData);
    const json = decrypt(encrypted, this.encryptionKey);
    return JSON.parse(json) as T;
  }

  /**
   * Encrypts a single field value.
   * Useful for encrypting individual database fields.
   *
   * @param value - String value to encrypt
   * @returns Base64-encoded encrypted value
   */
  encryptField(value: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption context not initialized');
    }

    const encrypted = encrypt(value, this.encryptionKey);
    return serializeEncrypted(encrypted);
  }

  /**
   * Decrypts a single field value.
   *
   * @param encryptedValue - Base64-encoded encrypted value
   * @returns Decrypted string
   */
  decryptField(encryptedValue: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption context not initialized');
    }

    const encrypted = deserializeEncrypted(encryptedValue);
    return decrypt(encrypted, this.encryptionKey);
  }

  /**
   * Clears encryption context (on logout/license revocation).
   * Securely wipes the encryption key from memory.
   */
  clear(): void {
    if (this.encryptionKey) {
      // Secure key erasure - overwrite with zeros
      this.encryptionKey.fill(0);
    }
    this.encryptionKey = null;
    this.tenantId = null;
    this.licenseKey = null;
  }
}

/**
 * Global singleton instance for app-wide encryption context.
 * Initialize after license validation, clear on logout.
 *
 * @example
 * ```typescript
 * import { globalEncryptionContext } from '@/lib/encryption';
 *
 * // After license validation
 * globalEncryptionContext.initialize(license.licenseKey);
 *
 * // Use throughout the app
 * if (globalEncryptionContext.isInitialized()) {
 *   const encrypted = globalEncryptionContext.encryptForSync(data);
 * }
 *
 * // On logout
 * globalEncryptionContext.clear();
 * ```
 */
export const globalEncryptionContext = new EncryptionContext();

/**
 * Re-export getDeviceId for use in other modules.
 */
export { getDeviceId };
