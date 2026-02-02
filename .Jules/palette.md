# Palette's Journal

This journal records critical UX and accessibility learnings for the VoiceInvoice project.

## 2024-05-23 - Custom Modals
**Learning:** Custom modals (like delete confirmations) often miss basic a11y primitives: `role="alertdialog"`, `aria-modal="true"`, and focus management (Escape key, auto-focus).
**Action:** When creating custom modals, always implement a `useEscapeKey` effect and `autoFocus` on the safest action (Cancel).
