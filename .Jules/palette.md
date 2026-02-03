# Palette's Journal

## 2024-05-22 - Invoice List Accessibility
**Learning:** Tests matching localized ARIA labels must handle umlauts explicitly (e.g. `löschen` vs `loeschen`) even if previous code used ASCII fallback.
**Action:** When updating localized strings, always check corresponding test regex patterns for umlaut compatibility.
