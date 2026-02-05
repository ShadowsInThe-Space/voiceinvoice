/**
 * Tests for Refund Service.
 *
 * @module tests/services/refund-service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/services/license-service', () => ({
  LICENSE_ERRORS: {
    LICENSE_NOT_FOUND: 'License not found',
    QUOTA_EXCEEDED: 'Monthly quota exceeded',
    EXPIRED: 'License has expired',
    INACTIVE: 'License is inactive',
    INVALID_KEY: 'Invalid license key',
  },
}));

const license = {
  id: 'lic-1',
  licenseKey: 'VI-TEST-KEY',
  companyName: 'Test GmbH',
  status: 'ACTIVE',
  monthlyQuota: 100,
  currentUsage: 0,
  usageResetDate: new Date('2025-02-01T00:00:00Z'),
  expiresAt: new Date('2026-02-01T00:00:00Z'),
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
};

const paymentRecord = {
  sessionId: 'cs_test',
  paymentIntentId: 'pi_test',
  licenseKey: 'VI-TEST-KEY',
  amountPaid: 1000,
  currency: 'eur',
  refundedAmount: 0,
  refunds: {},
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
};

describe('Refund Service', () => {
  beforeEach(async () => {
    const { createMockPaymentRecordStore, setPaymentRecordStore } =
      await import('../../src/services/payment-record-store');
    const { createMockLicenseStore, setLicenseStore } =
      await import('../../src/services/license-store');

    const paymentStore = createMockPaymentRecordStore();
    const licenseStore = createMockLicenseStore();
    licenseStore.addLicense(license);
    await paymentStore.addRecord(paymentRecord);
    setPaymentRecordStore(paymentStore);
    setLicenseStore(licenseStore);
  });

  it('should keep license ACTIVE for partial refund', async () => {
    const { applyRefundEvent } = await import('../../src/services/refund-service');

    const result = await applyRefundEvent({
      refundId: 're_1',
      paymentIntentId: 'pi_test',
      amount: 400,
      currency: 'eur',
      status: 'succeeded',
    });

    expect(result.handled).toBe(true);
    expect(result.refundedAmount).toBe(400);
    expect(result.licenseUpdated).toBe(false);
  });

  it('should suspend license on full refund', async () => {
    const { applyRefundEvent } = await import('../../src/services/refund-service');

    const result = await applyRefundEvent({
      refundId: 're_2',
      paymentIntentId: 'pi_test',
      amount: 1000,
      currency: 'eur',
      status: 'succeeded',
    });

    expect(result.handled).toBe(true);
    expect(result.refundedAmount).toBe(1000);
    expect(result.licenseUpdated).toBe(true);
  });

  it('should handle refund.updated without double counting', async () => {
    const { applyRefundEvent } = await import('../../src/services/refund-service');

    await applyRefundEvent({
      refundId: 're_3',
      paymentIntentId: 'pi_test',
      amount: 500,
      currency: 'eur',
      status: 'pending',
    });

    const result = await applyRefundEvent({
      refundId: 're_3',
      paymentIntentId: 'pi_test',
      amount: 500,
      currency: 'eur',
      status: 'succeeded',
    });

    expect(result.refundedAmount).toBe(500);
  });

  it('should return handled=false for unknown payment intent', async () => {
    const { applyRefundEvent } = await import('../../src/services/refund-service');

    const result = await applyRefundEvent({
      refundId: 're_4',
      paymentIntentId: 'pi_unknown',
      amount: 500,
      currency: 'eur',
      status: 'succeeded',
    });

    expect(result.handled).toBe(false);
  });
});
