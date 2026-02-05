# PR: Task 10 – Refund Handling

## Summary

- Add payment record tracking linked to Stripe payment intents
- Handle `refund.created`/`refund.updated` webhook events with partial refunds
- Suspend license when refunds reach the paid amount

## Scope

- `apps/proxy-server/src/services/payment-record-store.ts`
- `apps/proxy-server/src/services/refund-service.ts`
- `apps/proxy-server/src/routes/stripe.ts`
- `apps/proxy-server/tests/services/payment-record-store.test.ts`
- `apps/proxy-server/tests/services/refund-service.test.ts`

## Test Plan (TDD)

- [x] Red: `tests/services/payment-record-store.test.ts`
- [x] Green: `tests/services/refund-service.test.ts`
- [ ] Integration: `tests/routes/stripe.test.ts` (refund events)

## Checklist

- [x] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Coverage meets thresholds
- [ ] Stripe Webhook Handling getestet

## Review Notes

- @jules: Bitte Logik- und Edge-Case-Review der Refund-Handling-Implementierung.
- @claude: Bitte Security/Architektur-Review (Webhook-Events, Idempotenz, Lizenzstatus).
