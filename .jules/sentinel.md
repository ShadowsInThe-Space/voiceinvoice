## 2026-05-27 - Unauthenticated AI Endpoints in Proxy Server
**Vulnerability:** The `/transcribe` and `/enrich` endpoints were accessible without authentication, allowing unauthorized use of costly AI services (Google STT, Gemini).
**Learning:** Routes added individually without a global authentication strategy are prone to being left unprotected.
**Prevention:** Implement a global `onRequest` hook that enforces authentication by default, requiring explicit opt-out for public routes (e.g., `/health`, `/login`).
