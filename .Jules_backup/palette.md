# Palette's Journal

## 2024-05-23 - Inline Modal Accessibility Gaps

**Learning:** Inline modal implementations (like in `InvoiceList.tsx`) consistently miss critical accessibility features: focus management (autoFocus), keyboard navigation (Escape key), and ARIA roles (`alertdialog`).
**Action:** When auditing lists with actions, specifically check custom delete confirmations for `aria-modal="true"`, `autoFocus` on safe actions, and Escape key support.
