# PR: Task 08 – License Enforcement Middleware

## Summary

- Enforced JWT-based license auth for proxy server features
- `/api/license/validate` now returns a JWT + license payload
- Supabase RAG is gated by license token; local RAG remains available

## Scope

- Proxy server license validation and auth hook
- JWT signing/verification utilities
- Tenant ID derivation (server-side)
- Desktop RAG request now sends token when present
- Proxy `.env.example` updated with `LICENSE_JWT_SECRET`

## Test Plan (TDD)

- [x] Red: Added failing auth/validation tests
- [x] Green: Implemented JWT auth + validate endpoint changes
- [x] Refactor: Cleaned license service + tenant derivation

## Tests Run

- `pnpm --filter @voiceinvoice/proxy-server test -- license-auth.test.ts license.test.ts`

## Checklist

- [x] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Coverage meets thresholds (run full suite)
- [x] Docs updated where needed

## Security/Abuse Checks (Broken Auth)

- [x] Unauthorized requests blocked (missing/invalid token)
- [x] License validity enforced on every request
- [x] Tenant mismatch blocked when `x-tenant-id` provided
- [x] Error responses avoid leaking sensitive details

## Review

- Security/Architektur-Review: @claude
