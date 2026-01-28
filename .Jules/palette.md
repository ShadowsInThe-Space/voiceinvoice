## 2025-01-28 - Manual Focus Management in Modals
**Learning:** `apps/desktop` lacks a reusable focus trap hook (`useFocusTrap` mentioned in memory does not exist).
**Action:** Implement manual focus management using `useRef` and `useEffect` (capture focus on open, restore on close, listen for Escape) for any new modals until a shared hook is created.
