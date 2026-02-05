import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';

/**
 * Salt for encryption key derivation.
 * Do not change this value after deployment as it would invalidate existing keys.
 */
const ENCRYPTION_SALT = 'voiceinvoice-e2e-v1';

/**
 * Salt for tenant ID derivation.
 * Do not change this value after deployment as it would break tenant isolation.
 */
const TENANT_SALT = 'voiceinvoice-tenant-v1';

/**
 * Derives a 256-bit encryption key from license key and device ID.
 * Uses HKDF-SHA256 for secure key derivation.
 *
 * @param licenseKey - The user's license key
 * @param deviceId - Unique device identifier
 * @returns 32-byte (256-bit) encryption key
 * @throws Error if licenseKey or deviceId is empty
 *
 * @example
 * ```typescript
 * const key = deriveEncryptionKey('LIC-1234-5678', 'device-abc');
 * // Returns Uint8Array(32) for use with AES-256-GCM
 * ```
 */
export function deriveEncryptionKey(licenseKey: string, deviceId: string): Uint8Array {
  if (!licenseKey || licenseKey.trim() === '' || !deviceId || deviceId.trim() === '') {
    throw new Error('licenseKey and deviceId must not be empty');
  }

  const inputKeyMaterial = new TextEncoder().encode(`${licenseKey}:${deviceId}`);
  const salt = new TextEncoder().encode(ENCRYPTION_SALT);
  const info = new TextEncoder().encode('encryption');

  return hkdf(sha256, inputKeyMaterial, salt, info, 32);
}

/**
 * Derives a tenant ID from the license key.
 * This is used for Supabase RLS isolation.
 *
 * The tenant ID is deterministic: the same license key always produces
 * the same tenant ID, enabling multi-device access to the same data.
 *
 * @param licenseKey - The user's license key
 * @returns 32-character hex string tenant ID (128-bit)
 * @throws Error if licenseKey is empty
 *
 * @example
 * ```typescript
 * const tenantId = deriveTenantId('LIC-1234-5678');
 * // Returns something like 'a1b2c3d4e5f67890a1b2c3d4e5f67890'
 * ```
 */
export function deriveTenantId(licenseKey: string): string {
  if (!licenseKey || licenseKey.trim() === '') {
    throw new Error('licenseKey must not be empty');
  }

  const hash = sha256(new TextEncoder().encode(`${TENANT_SALT}:${licenseKey}`));
  // Take first 16 bytes (128 bits) and convert to hex for 32-char tenant ID
  return Buffer.from(hash.slice(0, 16)).toString('hex');
}
