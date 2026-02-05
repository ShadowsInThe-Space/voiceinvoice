## 2026-02-05 - Missing Authentication on Critical Endpoints
**Vulnerability:** The `/transcribe` and `/enrich` endpoints in `proxy-server` were completely unauthenticated, allowing free use of paid AI services.
**Learning:** The auth hook `createLicenseAuthHook` was imported but not exported/implemented in `license.ts`, causing build failures and missing security. This suggests a refactor or merge conflict left the code in a broken state.
**Prevention:** Ensure CI/CD pipelines run `pnpm build` on every commit. Add integration tests that explicitly check for 401/403 on protected endpoints.
