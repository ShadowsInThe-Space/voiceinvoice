## 2024-05-22 - [Accessible Delete Modal]
**Learning:** Custom modals (divs) often lack focus management. Users tabbing through the interface can get "lost" behind the modal. Adding `role="dialog"`, `aria-modal="true"`, and `autoFocus` on the primary action (or cancel) is critical for keyboard users.
**Action:** When creating or spotting custom modals, always check for: 1) Focus trap or auto-focus, 2) Escape key to close, 3) Correct ARIA roles.
