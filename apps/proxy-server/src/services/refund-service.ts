/**
 * Refund Service
 *
 * Handles Stripe refund events and updates license status when fully refunded.
 *
 * @module services/refund-service
 */

import { getLicenseStore } from './license-store';
import { getPaymentRecordStore, RefundEntry } from './payment-record-store';

/**
 * Refund event input payload.
 */
export interface RefundEventInput {
  /** Stripe refund ID */
  refundId: string;
  /** Stripe payment intent ID */
  paymentIntentId: string;
  /** Refund amount in minor units */
  amount: number;
  /** Currency code */
  currency: string;
  /** Refund status from Stripe */
  status: string;
}

/**
 * Refund event processing result.
 */
export interface RefundEventResult {
  /** Whether the event was handled (payment record found) */
  handled: boolean;
  /** Total refunded amount after processing */
  refundedAmount?: number;
  /** Whether a license status update occurred */
  licenseUpdated?: boolean;
}

/**
 * Apply a refund event to the payment record and update license status if needed.
 *
 * @param input - Refund event input data
 * @returns Processing result
 */
export async function applyRefundEvent(input: RefundEventInput): Promise<RefundEventResult> {
  const paymentStore = getPaymentRecordStore();
  const paymentRecord = await paymentStore.getByPaymentIntentId(input.paymentIntentId);

  if (!paymentRecord) {
    return { handled: false };
  }

  const now = new Date();
  const refunds: Record<string, RefundEntry> = {
    ...paymentRecord.refunds,
    [input.refundId]: {
      amount: input.amount,
      currency: input.currency,
      status: input.status,
      updatedAt: now,
    },
  };

  const refundedAmount = Object.values(refunds)
    .filter((refund) => refund.status === 'succeeded')
    .reduce((total, refund) => total + refund.amount, 0);

  const updatedRecord = {
    ...paymentRecord,
    refunds,
    refundedAmount,
    updatedAt: now,
  };

  await paymentStore.updateRecord(updatedRecord);

  let licenseUpdated = false;
  if (paymentRecord.amountPaid > 0 && refundedAmount >= paymentRecord.amountPaid) {
    const store = getLicenseStore();
    const updatedLicense = await store.updateStatus(paymentRecord.licenseKey, 'SUSPENDED');
    licenseUpdated = Boolean(updatedLicense);
  }

  return {
    handled: true,
    refundedAmount,
    licenseUpdated,
  };
}
