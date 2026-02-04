/**
 * License Service
 *
 * Handles license validation and retrieval.
 *
 * @module services/license-service
 */

import { getLicenseStore, type License } from './license-store';

export interface LicenseValidationResult {
  isValid: boolean;
  error?: 'INVALID_KEY' | 'EXPIRED' | 'INACTIVE';
  license?: License;
}

/**
 * Token payload for license-based authentication.
 */
export interface LicenseTokenPayload {
  licenseKey: string;
  tenantId: string;
}

/**
 * Validates a license key.
 * Checks existence, status, and expiration.
 *
 * @param licenseKey - The license key to validate
 * @returns Validation result
 */
export async function validateLicense(licenseKey: string): Promise<LicenseValidationResult> {
  const store = getLicenseStore();
  const license = await store.getLicense(licenseKey);

  if (!license) {
    return { isValid: false, error: 'INVALID_KEY' };
  }

  if (license.status !== 'ACTIVE') {
    return { isValid: false, error: 'INACTIVE', license };
  }

  if (new Date() > license.expiresAt) {
    return { isValid: false, error: 'EXPIRED', license };
  }

  return {
    isValid: true,
    license,
  };
}
