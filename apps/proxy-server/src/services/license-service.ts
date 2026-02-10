/**
 * License Service
 *
 * Handles license validation and retrieval.
 *
 * @module services/license-service
 */

import { getLicenseStore } from './license-store';

export interface LicenseValidationResult {
  isValid: boolean;
  error?: 'INVALID_KEY' | 'EXPIRED' | 'INACTIVE';
  details?: {
    companyName: string;
    expiresAt: Date;
    monthlyQuota: number;
    currentUsage: number;
  };
}

export interface LicenseTokenPayload {
  licenseKey: string;
  tenantId: string;
  companyName: string;
  expiresAt: Date;
  monthlyQuota: number;
  currentUsage: number;
}

/**
 * Standard license error messages.
 */
export const LICENSE_ERRORS = {
  LICENSE_NOT_FOUND: 'License not found',
  QUOTA_EXCEEDED: 'Monthly quota exceeded',
  EXPIRED: 'License has expired',
  INACTIVE: 'License is inactive',
  INVALID_KEY: 'Invalid license key',
} as const;

/**
 * Validates a license key.
 * checks existence, status, and expiration.
 *
 * @param licenseKey - The license key to validate
 * @returns Validation result
 */
export async function validateLicense(licenseKey: string): Promise<LicenseValidationResult> {
  try {
    const store = getLicenseStore();
    const license = await store.getLicense(licenseKey);

    if (!license) {
      return { isValid: false, error: 'INVALID_KEY' };
    }

    if (license.status !== 'ACTIVE') {
      return { isValid: false, error: 'INACTIVE' };
    }

    if (new Date() > license.expiresAt) {
      return { isValid: false, error: 'EXPIRED' };
    }

    return {
      isValid: true,
      details: {
        companyName: license.companyName,
        expiresAt: license.expiresAt,
        monthlyQuota: license.monthlyQuota,
        currentUsage: license.currentUsage,
      },
    };
  } catch (error) {
    console.error('License validation error:', error);
    // In case of DB error, we return invalid or throw?
    // Let's return invalid with generic error or rethrow.
    throw error;
  }
}
