# Review Summary for Pull Request (Task 10 & E2E Sync)

**Status:** Request Changes
**Reviewer:** Jules

## Critical Issues (Must Fix)

1.  **IDOR in Sync Endpoints (`apps/proxy-server/src/routes/sync.ts`)**
    - The endpoints trust `x-tenant-id` header.
    - **Fix:** Verify `tenantId` against the authenticated license token.

2.  **Irreversible Recovery Phrase (`apps/desktop/src/lib/encryption/recovery-phrase.ts`)**
    - `generateRecoveryPhrase` uses `sha256Sync` (hashing) instead of encoding.
    - **Fix:** Use BIP39 or reversible encoding.

3.  **Data Loss (`apps/proxy-server/src/services/payment-record-store.ts`)**
    - Uses in-memory `Map`. Data is lost on restart.
    - **Fix:** Use a database-backed store (Prisma).

## High Priority

1.  **Race Condition (`apps/proxy-server/src/services/refund-service.ts`)**
    - `applyRefundEvent` has read-modify-write race condition.
    - **Fix:** Use atomic updates or locking.

2.  **Data Corruption (`apps/desktop/src/lib/encryption/field-encryption.ts`)**
    - Returns ciphertext on decryption failure.
    - **Fix:** Throw error or handle failure without returning ciphertext as plaintext.

## Recommendation
Address these issues before merging.
