/**
 * Tests for License Schema Extensions
 *
 * Tests that the License model supports stripeCustomerId and companyName fields
 * required for Stripe Customer Portal integration.
 *
 * @module tests/license-schema
 */

import { describe, it, expect } from 'vitest';
import { License, Prisma } from '../generated/server';

describe('License Schema - Stripe Customer Portal Support', () => {
  it('should have stripeCustomerId field in License type', () => {
    // This test verifies at compile-time that the field exists in Prisma-generated type
    const mockLicenseInput: Prisma.LicenseCreateInput = {
      licenseKey: 'VI-TEST-0001',
      status: 'ACTIVE',
      monthlyQuota: 500,
      currentUsage: 0,
      usageResetDate: new Date(),
      expiresAt: new Date(),
      tenant: {
        create: {
          name: 'Test Company GmbH',
        },
      },
      stripeCustomerId: 'cus_test123', // TypeScript will error if field doesn't exist
      companyName: 'Test Company GmbH', // TypeScript will error if field doesn't exist
    };

    // Verify the types exist
    expect(mockLicenseInput.stripeCustomerId).toBe('cus_test123');
    expect(mockLicenseInput.companyName).toBe('Test Company GmbH');
  });

  it('should allow null stripeCustomerId for trial licenses', () => {
    const mockLicenseInput: Prisma.LicenseCreateInput = {
      licenseKey: 'VI-TRIAL-0001',
      status: 'TRIAL',
      monthlyQuota: 100,
      currentUsage: 0,
      usageResetDate: new Date(),
      expiresAt: new Date(),
      tenant: {
        create: {
          name: 'Trial Company',
        },
      },
      stripeCustomerId: null, // Trial licenses may not have Stripe Customer ID yet
      companyName: 'Trial Company',
    };

    expect(mockLicenseInput.stripeCustomerId).toBeNull();
    expect(mockLicenseInput.companyName).toBe('Trial Company');
  });

  it('should have stripeCustomerId in License result type', () => {
    // Test that the License type (result type) has the fields
    const mockLicense: License = {
      id: 'test-id',
      licenseKey: 'VI-TEST-0001',
      status: 'ACTIVE',
      monthlyQuota: 500,
      currentUsage: 0,
      usageResetDate: new Date(),
      expiresAt: new Date(),
      tenantId: 'tenant-id',
      createdAt: new Date(),
      updatedAt: new Date(),
      stripeCustomerId: 'cus_test123', // TypeScript will error if field doesn't exist
      companyName: 'Test Company GmbH', // TypeScript will error if field doesn't exist
    };

    expect(mockLicense.stripeCustomerId).toBe('cus_test123');
    expect(mockLicense.companyName).toBe('Test Company GmbH');
  });
});
