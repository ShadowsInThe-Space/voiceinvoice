# Sentinel's Journal

## 2024-05-22 - Missing Authentication on Sensitive Endpoints
**Vulnerability:** Core AI endpoints (`/transcribe`, `/enrich`) were completely exposed without authentication.
**Learning:** Routes in Fastify are public by default unless explicitly protected. `createLicenseAuthHook` existed but was not applied to these routes.
**Prevention:** Always verify `preHandler` hooks when adding new routes. Consider a default-secure approach where auth is applied globally and public routes are opted-out, or use a linter rule to ensure auth hooks are present.
