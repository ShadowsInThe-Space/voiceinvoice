import { gcm } from '@noble/ciphers/aes';
import { randomBytes } from '@noble/ciphers/webcrypto';

/**
 * Represents encrypted data with AES-256-GCM.
 * Includes ciphertext, initialization vector (IV), and authentication tag.
 */
export interface EncryptedData {
  /** The encrypted content (without auth tag) */
  ciphertext: Uint8Array;
  /** 12-byte initialization vector (unique per encryption) */
  iv: Uint8Array;
  /** 16-byte GCM authentication tag for tamper detection */
  tag: Uint8Array;
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Generates a random 12-byte IV for each encryption.
 *
 * @param plaintext - The string to encrypt
 * @param key - 32-byte (256-bit) encryption key
 * @returns Encrypted data with ciphertext, IV, and auth tag
 *
 * @example
 * ```typescript
 * const key = deriveEncryptionKey(licenseKey, deviceId);
 * const encrypted = encrypt('Sensitive data', key);
 * ```
 */
export function encrypt(plaintext: string, key: Uint8Array): EncryptedData {
  const iv = randomBytes(12);
  const plaintextBytes = new TextEncoder().encode(plaintext);

  const aes = gcm(key, iv);
  const ciphertext = aes.encrypt(plaintextBytes);

  // GCM appends 16-byte auth tag to ciphertext
  const tag = ciphertext.slice(-16);
  const ciphertextOnly = ciphertext.slice(0, -16);

  return { ciphertext: ciphertextOnly, iv, tag };
}

/**
 * Decrypts AES-256-GCM encrypted data.
 * Throws if authentication fails (tampered data or wrong key).
 *
 * @param encrypted - The encrypted data with ciphertext, IV, and tag
 * @param key - 32-byte (256-bit) encryption key (must match encryption key)
 * @returns Decrypted plaintext string
 * @throws Error if authentication fails (wrong key or tampered data)
 *
 * @example
 * ```typescript
 * const decrypted = decrypt(encrypted, key);
 * ```
 */
export function decrypt(encrypted: EncryptedData, key: Uint8Array): string {
  const { ciphertext, iv, tag } = encrypted;

  // Reconstruct ciphertext with tag appended (as GCM expects)
  const ciphertextWithTag = new Uint8Array(ciphertext.length + tag.length);
  ciphertextWithTag.set(ciphertext);
  ciphertextWithTag.set(tag, ciphertext.length);

  const aes = gcm(key, iv);
  const plaintext = aes.decrypt(ciphertextWithTag);

  return new TextDecoder().decode(plaintext);
}

/**
 * Serializes encrypted data to base64 for storage/transmission.
 * Format: [IV (12 bytes)][ciphertext][tag (16 bytes)] -> base64
 *
 * @param data - Encrypted data to serialize
 * @returns Base64-encoded string
 *
 * @example
 * ```typescript
 * const encrypted = encrypt('data', key);
 * const serialized = serializeEncrypted(encrypted);
 * // Store serialized string in database
 * ```
 */
export function serializeEncrypted(data: EncryptedData): string {
  const combined = new Uint8Array(data.iv.length + data.ciphertext.length + data.tag.length);
  combined.set(data.iv, 0);
  combined.set(data.ciphertext, data.iv.length);
  combined.set(data.tag, data.iv.length + data.ciphertext.length);

  return Buffer.from(combined).toString('base64');
}

/**
 * Deserializes base64 encrypted data back to EncryptedData.
 *
 * @param serialized - Base64-encoded encrypted data
 * @returns EncryptedData object with iv, ciphertext, and tag
 *
 * @example
 * ```typescript
 * const deserialized = deserializeEncrypted(storedData);
 * const plaintext = decrypt(deserialized, key);
 * ```
 */
export function deserializeEncrypted(serialized: string): EncryptedData {
  const combined = Buffer.from(serialized, 'base64');

  return {
    iv: new Uint8Array(combined.slice(0, 12)),
    ciphertext: new Uint8Array(combined.slice(12, -16)),
    tag: new Uint8Array(combined.slice(-16)),
  };
}
