## 2024-05-22 - Modal Dialog Accessibility
**Learning:** Simple overlay divs for modals are invisible to screen readers and trap keyboard users.
**Action:** Always use role='dialog' (or 'alertdialog'), aria-modal='true', and manage focus (trap & restore).
