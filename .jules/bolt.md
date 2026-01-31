## 2024-05-23 - Component Testing Warnings
**Learning:** `apps/desktop` component tests (specifically `InvoiceList.test.tsx`) produce significant `act(...)` warnings. This suggests that state updates (likely from `useEffect` or async handlers) are not being properly awaited or wrapped in the test environment.
**Action:** When working on `apps/desktop` tests, be aware of these existing warnings. Future improvements should focus on properly wrapping interactions in `act` or awaiting state updates to clean up the test output.
