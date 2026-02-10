/**
 * License Store
 *
 * Data access layer for license management.
 * Provides both a production Prisma-based implementation and a mock for testing.
 *
 * @module services/license-store
 */

import { LICENSE_ERRORS } from './license-service';

/**
 * License data structure matching the Prisma schema.
 */
export interface License {
  /** Unique identifier */
  id: string;
  /** License key (unique) */
  licenseKey: string;
  /** Company name */
  companyName: string;
  /** License status: ACTIVE, SUSPENDED, REVOKED */
  status: string;
  /** Monthly API call quota */
  monthlyQuota: number;
  /** Current month usage count */
  currentUsage: number;
  /** When the usage counter resets */
  usageResetDate: Date;
  /** License expiration date */
  expiresAt: Date;
  /** Stripe customer ID for billing portal */
  stripeCustomerId?: string;
  /** Record creation timestamp */
  createdAt: Date;
  /** Record update timestamp */
  updatedAt: Date;
}

/**
 * Result of a usage increment operation.
 */
export interface UsageIncrementResult {
  /** Whether the increment was successful */
  success: boolean;
  /** Current usage after increment (if successful) */
  currentUsage?: number;
  /** Error message (if failed) */
  error?: string;
}

/**
 * License store interface for data access operations.
 */
export interface LicenseStore {
  /**
   * Get a license by its key.
   *
   * @param licenseKey - The unique license key
   * @returns License data or null if not found
   */
  getLicense(licenseKey: string): Promise<License | null>;

  /**
   * Increment usage for a license.
   *
   * @param licenseKey - The unique license key
   * @returns Result indicating success or failure
   */
  incrementUsage(licenseKey: string): Promise<UsageIncrementResult>;

  /**
   * Update license status.
   *
   * @param licenseKey - The unique license key
   * @param status - New status value
   * @returns Updated license or null if not found
   */
  updateStatus(licenseKey: string, status: string): Promise<License | null>;
}

/**
 * Mock license store for testing.
 * Stores licenses in memory with full functionality.
 */
export interface MockLicenseStore extends LicenseStore {
  /**
   * Add a license to the mock store.
   *
   * @param license - License data to add
   */
  addLicense(license: License): void;

  /**
   * Reset the mock store to empty state.
   */
  reset(): void;
}

/**
 * Create a mock license store for testing.
 *
 * @returns Mock license store instance
 *
 * @example
 * ```typescript
 * const store = createMockLicenseStore();
 * store.addLicense({
 *   id: 'test-id',
 *   licenseKey: 'TEST-KEY',
 *   // ... other fields
 * });
 *
 * const license = await store.getLicense('TEST-KEY');
 * ```
 */
export function createMockLicenseStore(): MockLicenseStore {
  const licenses = new Map<string, License>();

  /**
   * Check and reset usage if reset date has passed.
   *
   * @param license - License to check
   * @returns License with potentially reset usage
   */
  function checkAndResetUsage(license: License): License {
    const now = new Date();
    if (license.usageResetDate <= now) {
      // Reset usage and set new reset date (30 days from now)
      const updatedLicense: License = {
        ...license,
        currentUsage: 0,
        usageResetDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        updatedAt: now,
      };
      licenses.set(license.licenseKey, updatedLicense);
      return updatedLicense;
    }
    return license;
  }

  return {
    async getLicense(licenseKey: string): Promise<License | null> {
      const license = licenses.get(licenseKey);
      if (!license) {
        return null;
      }
      return checkAndResetUsage(license);
    },

    async incrementUsage(licenseKey: string): Promise<UsageIncrementResult> {
      const license = licenses.get(licenseKey);
      if (!license) {
        return { success: false, error: LICENSE_ERRORS.LICENSE_NOT_FOUND };
      }

      // Check and reset if needed
      const currentLicense = checkAndResetUsage(license);

      // Check quota
      if (currentLicense.currentUsage >= currentLicense.monthlyQuota) {
        return { success: false, error: LICENSE_ERRORS.QUOTA_EXCEEDED };
      }

      // Increment usage
      const updatedLicense: License = {
        ...currentLicense,
        currentUsage: currentLicense.currentUsage + 1,
        updatedAt: new Date(),
      };
      licenses.set(licenseKey, updatedLicense);

      return { success: true, currentUsage: updatedLicense.currentUsage };
    },

    async updateStatus(licenseKey: string, status: string): Promise<License | null> {
      const license = licenses.get(licenseKey);
      if (!license) {
        return null;
      }

      const updatedLicense: License = {
        ...license,
        status,
        updatedAt: new Date(),
      };
      licenses.set(licenseKey, updatedLicense);

      return updatedLicense;
    },

    addLicense(license: License): void {
      licenses.set(license.licenseKey, license);
    },

    reset(): void {
      licenses.clear();
    },
  };
}

// Singleton store instance
let storeInstance: LicenseStore | null = null;

/**
 * Get the license store instance.
 *
 * Returns the configured license store (production or mock).
 *
 * @returns License store instance
 * @throws Error if store has not been initialized
 *
 * @example
 * ```typescript
 * const store = getLicenseStore();
 * const license = await store.getLicense('MY-KEY');
 * ```
 */
export function getLicenseStore(): LicenseStore {
  if (!storeInstance) {
    // In production, this would be a Prisma-based implementation
    // For now, create a mock store as fallback
    storeInstance = createMockLicenseStore();
  }
  return storeInstance;
}

/**
 * Set the license store instance.
 *
 * Used for dependency injection, primarily in tests.
 *
 * @param store - License store instance to use
 *
 * @example
 * ```typescript
 * const mockStore = createMockLicenseStore();
 * setLicenseStore(mockStore);
 * ```
 */
export function setLicenseStore(store: LicenseStore | null): void {
  storeInstance = store;
}

/**
 * Prisma client interface for license operations.
 */
interface PrismaLicenseClient {
  /** License model operations */
  license: {
    /** Find a unique license by criteria */
    findUnique: (args: { where: { licenseKey: string } }) => Promise<License | null>;
    /** Update a license record */
    update: (args: { where: { licenseKey: string }; data: Partial<License> }) => Promise<License>;
  };
}

/**
 * Create a production Prisma-based license store.
 *
 * Note: This requires a generated Prisma client with the server schema.
 *
 * @param prisma - Prisma client instance with license model
 * @returns Production license store implementation
 *
 * @example
 * ```typescript
 * import { PrismaClient } from '../generated/client';
 *
 * const prisma = new PrismaClient();
 * const store = createPrismaLicenseStore(prisma);
 * setLicenseStore(store);
 * ```
 */
export function createPrismaLicenseStore(prisma: PrismaLicenseClient): LicenseStore {
  return {
    async getLicense(licenseKey: string): Promise<License | null> {
      const license = await prisma.license.findUnique({
        where: { licenseKey },
      });

      if (!license) {
        return null;
      }

      // Check and reset usage if reset date has passed
      const now = new Date();
      if (license.usageResetDate <= now) {
        const updatedLicense = await prisma.license.update({
          where: { licenseKey },
          data: {
            currentUsage: 0,
            usageResetDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        });
        return updatedLicense;
      }

      return license;
    },

    async incrementUsage(licenseKey: string): Promise<UsageIncrementResult> {
      const license = await this.getLicense(licenseKey);
      if (!license) {
        return { success: false, error: LICENSE_ERRORS.LICENSE_NOT_FOUND };
      }

      if (license.currentUsage >= license.monthlyQuota) {
        return { success: false, error: LICENSE_ERRORS.QUOTA_EXCEEDED };
      }

      const updated = await prisma.license.update({
        where: { licenseKey },
        data: { currentUsage: license.currentUsage + 1 },
      });

      return { success: true, currentUsage: updated.currentUsage };
    },

    async updateStatus(licenseKey: string, status: string): Promise<License | null> {
      try {
        return await prisma.license.update({
          where: { licenseKey },
          data: { status },
        });
      } catch {
        return null;
      }
    },
  };
}
