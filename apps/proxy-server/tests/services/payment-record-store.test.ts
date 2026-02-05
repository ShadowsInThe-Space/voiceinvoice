/**
 * Tests for Payment Record Store.
 *
 * @module tests/services/payment-record-store
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockPaymentRecordStore,
  getPaymentRecordStore,
  setPaymentRecordStore,
} from '../../src/services/payment-record-store';

const baseRecord = {
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

describe('Payment Record Store', () => {
  beforeEach(() => {
    const store = createMockPaymentRecordStore();
    setPaymentRecordStore(store);
  });

  it('should add and retrieve a payment record by paymentIntentId', async () => {
    const store = getPaymentRecordStore();
    await store.addRecord(baseRecord);

    const record = await store.getByPaymentIntentId('pi_test');

    expect(record).not.toBeNull();
    expect(record?.licenseKey).toBe('VI-TEST-KEY');
  });
});
