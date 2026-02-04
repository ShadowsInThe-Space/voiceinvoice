/**
 * Tenant ID derivation.
 *
 * @module services/tenant-id
 */

import { createHash } from 'crypto';

/**
 * Salt for tenant ID derivation.
 * Do not change this value after deployment as it would break tenant isolation.
 */
const TENANT_SALT = 'voiceinvoice-tenant-v1';

/**
 * Derives a tenant ID from the license key.
 *
 * @param licenseKey - The user's license key
 * @returns 32-character hex string tenant ID (128-bit)
 * @throws Error if licenseKey is empty
 */
export function deriveTenantId(licenseKey: string): string {
  if (!licenseKey || licenseKey.trim() === '') {
    throw new Error('licenseKey must not be empty');
  }

  const hash = createHash('sha256').update(`${TENANT_SALT}:${licenseKey}`).digest('hex');

  return hash.slice(0, 32);
}
