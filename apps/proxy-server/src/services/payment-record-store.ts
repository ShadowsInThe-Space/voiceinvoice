/**
 * Payment Record Store
 *
 * Data access layer for payment and refund tracking.
 * Provides a mock in-memory implementation for tests.
 *
 * @module services/payment-record-store
 */

/**
 * Refund entry stored against a payment.
 */
export interface RefundEntry {
  /** Refund amount in minor units */
  amount: number;
  /** Refund currency */
  currency: string;
  /** Refund status from Stripe */
  status: string;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Payment record linked to a license.
 */
export interface PaymentRecord {
  /** Stripe checkout session ID */
  sessionId: string;
  /** Stripe payment intent ID */
  paymentIntentId: string;
  /** Associated license key */
  licenseKey: string;
  /** Amount paid in minor units */
  amountPaid: number;
  /** Currency code */
  currency: string;
  /** Total refunded amount in minor units */
  refundedAmount: number;
  /** Map of refunds by refund ID */
  refunds: Record<string, RefundEntry>;
  /** Record creation timestamp */
  createdAt: Date;
  /** Record update timestamp */
  updatedAt: Date;
}

/**
 * Payment record store interface.
 */
export interface PaymentRecordStore {
  /**
   * Retrieve a payment record by payment intent ID.
   *
   * @param paymentIntentId - Stripe payment intent ID
   * @returns Payment record or null if not found
   */
  getByPaymentIntentId(paymentIntentId: string): Promise<PaymentRecord | null>;

  /**
   * Add a payment record to the store.
   *
   * @param record - Payment record to store
   * @returns Stored record (existing record if already present)
   */
  addRecord(record: PaymentRecord): Promise<PaymentRecord>;

  /**
   * Update a payment record in the store.
   *
   * @param record - Updated payment record
   * @returns Updated record
   */
  updateRecord(record: PaymentRecord): Promise<PaymentRecord>;
}

/**
 * Create a mock payment record store for testing.
 *
 * @returns Mock store instance
 */
export function createMockPaymentRecordStore(): PaymentRecordStore {
  const records = new Map<string, PaymentRecord>();

  return {
    async getByPaymentIntentId(paymentIntentId: string): Promise<PaymentRecord | null> {
      return records.get(paymentIntentId) || null;
    },

    async addRecord(record: PaymentRecord): Promise<PaymentRecord> {
      const existing = records.get(record.paymentIntentId);
      if (existing) {
        return existing;
      }
      records.set(record.paymentIntentId, record);
      return record;
    },

    async updateRecord(record: PaymentRecord): Promise<PaymentRecord> {
      records.set(record.paymentIntentId, record);
      return record;
    },
  };
}

let storeInstance: PaymentRecordStore | null = null;

/**
 * Get the payment record store instance.
 *
 * @returns Store instance
 */
export function getPaymentRecordStore(): PaymentRecordStore {
  if (!storeInstance) {
    storeInstance = createMockPaymentRecordStore();
  }
  return storeInstance;
}

/**
 * Set the payment record store instance.
 *
 * @param store - Store instance or null to reset
 */
export function setPaymentRecordStore(store: PaymentRecordStore | null): void {
  storeInstance = store;
}
