# Refund Handling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Handle Stripe refunds (`refund.created`, `refund.updated`) with partial refunds and suspend licenses on full refunds.

**Architecture:** Add a payment record store keyed by `payment_intent` to link Stripe refunds to licenses. Add a refund service that idempotently tracks refund state and updates license status when the refunded total meets/exceeds the original payment amount. Wire webhook handler to invoke refund service and to store payment records when a license is created.

**Tech Stack:** Fastify 5, Stripe SDK, Vitest, TypeScript.

---

### Task 1: Add Payment Record Store (Mock)

**Files:**

- Create: `apps/proxy-server/src/services/payment-record-store.ts`
- Test: `apps/proxy-server/tests/services/payment-record-store.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockPaymentRecordStore,
  setPaymentRecordStore,
  getPaymentRecordStore,
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
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @voiceinvoice/proxy-server test -- tests/services/payment-record-store.test.ts`
Expected: FAIL with module not found or function missing.

**Step 3: Write minimal implementation**

```typescript
export interface PaymentRecord {
  /* fields */
}
export interface PaymentRecordStore {
  /* methods */
}
export function createMockPaymentRecordStore(): PaymentRecordStore {
  /* in-memory map */
}
export function getPaymentRecordStore(): PaymentRecordStore {
  /* singleton */
}
export function setPaymentRecordStore(store: PaymentRecordStore | null): void {
  /* setter */
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @voiceinvoice/proxy-server test -- tests/services/payment-record-store.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/proxy-server/src/services/payment-record-store.ts apps/proxy-server/tests/services/payment-record-store.test.ts
git commit -m "feat(proxy-server): add payment record store"
```

---

### Task 2: Add Refund Service (Idempotent Partial Refunds)

**Files:**

- Create: `apps/proxy-server/src/services/refund-service.ts`
- Test: `apps/proxy-server/tests/services/refund-service.test.ts`

**Step 1: Write the failing tests**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { applyRefundEvent } from '../../src/services/refund-service';
import {
  createMockPaymentRecordStore,
  setPaymentRecordStore,
} from '../../src/services/payment-record-store';
import { createMockLicenseStore, setLicenseStore } from '../../src/services/license-store';

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
  beforeEach(() => {
    const paymentStore = createMockPaymentRecordStore();
    const licenseStore = createMockLicenseStore();
    licenseStore.addLicense(license);
    paymentStore.addRecord(paymentRecord);
    setPaymentRecordStore(paymentStore);
    setLicenseStore(licenseStore);
  });

  it('should keep license ACTIVE for partial refund', async () => {
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
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @voiceinvoice/proxy-server test -- tests/services/refund-service.test.ts`
Expected: FAIL with module not found or function missing.

**Step 3: Write minimal implementation**

```typescript
export interface RefundEventInput {
  /* fields */
}
export interface RefundEventResult {
  /* fields */
}
export async function applyRefundEvent(input: RefundEventInput): Promise<RefundEventResult> {
  // load payment record
  // upsert refund by refundId
  // recompute refundedAmount from succeeded refunds
  // update record
  // suspend license if refundedAmount >= amountPaid
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @voiceinvoice/proxy-server test -- tests/services/refund-service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/proxy-server/src/services/refund-service.ts apps/proxy-server/tests/services/refund-service.test.ts
git commit -m "feat(proxy-server): add refund service"
```

---

### Task 3: Wire Refund Handling in Stripe Webhook + Payment Record Storage

**Files:**

- Modify: `apps/proxy-server/src/routes/stripe.ts`
- Modify: `docs/pr/task-10-refund-handling.md`
- (Optional) Modify: `apps/proxy-server/tests/routes/stripe.test.ts`

**Step 1: Write the failing test (if adding route tests)**

```typescript
it('should acknowledge refund.created event', async () => {
  // mock refund webhook event with valid signature (or bypass via service test)
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @voiceinvoice/proxy-server test -- tests/routes/stripe.test.ts`
Expected: FAIL (if test added).

**Step 3: Write minimal implementation**

```typescript
// On checkout.session.completed: store PaymentRecord
// On refund.created/refund.updated: call applyRefundEvent
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @voiceinvoice/proxy-server test -- tests/routes/stripe.test.ts`
Expected: PASS (if test added).

**Step 5: Update docs**

Edit `docs/pr/task-10-refund-handling.md` with summary, scope, and test plan.

**Step 6: Commit**

```bash
git add apps/proxy-server/src/routes/stripe.ts docs/pr/task-10-refund-handling.md apps/proxy-server/tests/routes/stripe.test.ts

# Commit message example
git commit -m "feat(proxy-server): handle stripe refunds"
```

---

### Task 4: Add Review Note Commit

**Files:**

- Modify: `docs/pr/task-10-refund-handling.md`

**Step 1: Add review note**

```markdown
## Review Notes

- @jules: Bitte Logik- und Edge-Case-Review der Refund-Handling-Implementierung.
- @claude: Bitte Security/Architektur-Review (Webhook-Events, Idempotenz, Lizenzstatus).
```

**Step 2: Commit**

```bash
git add docs/pr/task-10-refund-handling.md
git commit -m "docs(pr): add review notes for task 10"
```

---

### Task 5: Verification + PR

**Step 1: Run tests**

Run: `pnpm test`
Expected: PASS (or document baseline failures if present).

**Step 2: Push + PR + comment**

Run: `bash skills/git-pushing/scripts/smart_commit.sh` (as needed per commit)
Create PR to `main` and comment requesting @claude review.
