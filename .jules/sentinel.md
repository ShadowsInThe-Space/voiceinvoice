## 2024-05-22 - Missing Authentication on Costly Endpoints
**Vulnerability:** The `/transcribe` and `/enrich` endpoints were completely unauthenticated, allowing unlimited access to paid Google Cloud and Gemini services.
**Learning:** Route files were creating handlers but not applying the available `createLicenseAuthHook` middleware. Tests were mocking services but not verifying auth, leading to false confidence.
**Prevention:** Always apply auth middleware at the route definition level. Ensure integration tests specifically check for 401/403 responses on protected endpoints.
