# Implementation Plan: Remaining Features

**Branch:** feature/remaining-features
**Created:** 2026-01-25
**Status:** In Progress

## Overview

This plan covers the implementation of the four remaining features for VoiceInvoice Enterprise:

1. License Validation (Server-side)
2. Multi-Tenant Schema (PostgreSQL)
3. Dual-Layer Privacy (Chirp + Client)
4. Offline-Sync (SQLite ↔ PostgreSQL)

## Task Dependencies

```
Task 1: License Validation     ─┐
Task 2: Multi-Tenant Schema    ─┼─→ Task 4: Offline-Sync
Task 3: Dual-Layer Privacy     ─┘
```

Tasks 1, 2, 3 can run in parallel. Task 4 depends on Task 2.

## Task Details

### Task 1: License Validation [IN PROGRESS]

**Location:** `apps/proxy-server/src/`

**Scope:**
- JWT-based license token generation/validation
- POST /api/license/validate endpoint
- GET /api/license/status endpoint
- Rate-limiting per license key
- Integration with AppSettings model

**Tests:** Minimum 10 tests

### Task 2: Multi-Tenant Schema [IN PROGRESS]

**Location:** `packages/database/prisma/`

**Scope:**
- New schema-server.prisma for PostgreSQL
- tenantId column in all tables
- Index on tenantId
- TenantContext helper for scoped queries
- Prisma client for server

**Tests:** Minimum 8 tests

### Task 3: Dual-Layer Privacy [IN PROGRESS]

**Location:** `packages/privacy-engine/src/`

**Scope:**
- Server Layer: Chirp 3 API integration
- Client Layer: Extended fuzzy/phonetic matching
- DualLayerPrivacy orchestrator class
- Privacy token management

**Tests:** Minimum 12 tests

### Task 4: Offline-Sync [BLOCKED by Task 2]

**Location:** `apps/desktop/src/lib/sync/`

**Scope:**
- Sync queue for offline changes
- Conflict resolution strategy
- Background sync on connection restore
- Sync status UI indicator

**Tests:** Minimum 10 tests

## Acceptance Criteria

- [ ] All tasks completed
- [ ] All tests passing (target: 650+ total)
- [ ] TypeScript compiles without errors
- [ ] JSDoc documentation for all exports
- [ ] Code reviewed via spec compliance + quality review
- [ ] Committed with conventional commit messages
- [ ] PR created for merge

## Progress Log

| Time | Event |
|------|-------|
| 03:45 | Plan created, Tasks 1-3 started in parallel |
