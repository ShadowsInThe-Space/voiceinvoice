# VoiceInvoice Enterprise - Agent Development Guide

> AI-agent focused documentation for the VoiceInvoice Enterprise codebase.
> This is a German voice-first accounting application with AI-powered features.

## Project Overview

VoiceInvoice Enterprise is a voice-first accounting platform for freelancers and businesses. It allows users to dictate invoices naturally, automates payment reminders through an AI phone agent, and ensures GDPR compliance through a dual-layer privacy architecture.

**Key Features:**

- Voice-to-Invoice Engine (Google Chirp 3 + Gemini 2.5 Flash)
- Autonomous Phone Agent for overdue invoices
- Dual-Layer Privacy Engine (client-side + server-side anonymization)
- Offline-first with SQLite, cloud sync to PostgreSQL
- Desktop application built with Electron + Next.js

**Language Note:** Documentation and comments are primarily in German. User-facing features are optimized for German language.

---

## Technology Stack

| Component         | Technology                                   | Purpose                                    |
| ----------------- | -------------------------------------------- | ------------------------------------------ |
| **Monorepo**      | pnpm workspaces + Turbo                      | Package management and build orchestration |
| **Desktop App**   | Electron + Next.js 14 + React 18             | Cross-platform desktop application         |
| **Proxy Server**  | Fastify 5 + Node.js 20 LTS                   | Backend API on Hetzner Frankfurt           |
| **AI Services**   | Google Vertex AI (europe-west3)              | Gemini 2.5 Flash + Chirp 3 transcription   |
| **Database**      | Prisma + SQLite (local) + PostgreSQL (cloud) | Offline-first data with cloud sync         |
| **Styling**       | Tailwind CSS 3 + shadcn/ui                   | Component styling and UI                   |
| **Testing**       | Vitest + Testing Library                     | Unit and integration tests                 |
| **Documentation** | Doxygen + JSDoc                              | API documentation generation               |
| **Workflows**     | n8n                                          | Business process automation                |

---

## Project Structure

```
invoice_finance_app/
├── apps/
│   ├── desktop/              # Electron + Next.js Desktop App
│   │   ├── electron/         # Electron main process code
│   │   ├── src/
│   │   │   ├── components/   # React components
│   │   │   ├── lib/          # Business logic modules
│   │   │   ├── pages/        # Next.js pages
│   │   │   └── hooks/        # React hooks
│   │   ├── prisma/           # SQLite schema and migrations
│   │   └── tests/            # Test files
│   └── proxy-server/         # Fastify Backend (Hetzner)
│       ├── src/
│       │   ├── routes/       # API route handlers
│       │   └── services/     # Business services
│       └── prisma/           # PostgreSQL schema
├── packages/
│   ├── ai-orchestrator/      # Gemini integration, intent classification
│   ├── database/             # Prisma clients (SQLite + PostgreSQL)
│   ├── privacy-engine/       # Dual-layer anonymization
│   └── shared-types/         # Zod schemas + TypeScript types
├── docs/                     # Documentation
├── ops/n8n/                  # n8n workflows and deployment
└── tools/                    # Build and utility scripts
```

---

## Development Setup

### Prerequisites

- **Node.js** 20 LTS or higher
- **pnpm** 8.x or higher
- **Docker** (optional, for local DB and n8n)
- **Google Cloud Credentials** (for Chirp 3 and Gemini)

### Initial Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment variables
cp .env.example .env
# Edit .env and add your API keys

# 3. Initialize database
pnpm db:generate
pnpm db:migrate

# 4. Start development servers
pnpm dev
```

### Available Commands

```bash
# Development
pnpm dev                    # Start all dev servers (desktop + proxy)
pnpm dev:electron          # Desktop app only
pnpm --filter @voiceinvoice/proxy-server dev  # Proxy server only

# Build
pnpm build                 # Build all packages and apps
pnpm --filter @voiceinvoice/desktop build:electron  # Build Electron app

# Testing
pnpm test                  # Run all tests
pnpm test:coverage         # Run tests with coverage report
pnpm --filter @voiceinvoice/desktop test -- --watch  # Watch mode

# Code Quality
pnpm lint                  # Run ESLint
pnpm typecheck             # TypeScript type checking
pnpm run ci:validate       # Full CI validation (run before commits)

# Database
pnpm db:migrate            # Run migrations
pnpm db:push               # Push schema changes
pnpm db:studio             # Open Prisma Studio

# Documentation
pnpm run docs:generate     # Generate Doxygen docs
pnpm run docs:serve        # Serve docs locally on :8080
pnpm run docs:check        # Check for documentation warnings
```

---

## Code Style Guidelines

### TypeScript Configuration

- **Target:** ES2022
- **Module:** ESNext with bundler resolution
- **Strict mode:** Enabled with exact optional property types
- **No implicit returns** or overrides

### Code Formatting (Prettier)

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "tabWidth": 2,
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### Documentation Standards (JSDoc)

**Every exported function, class, and interface must have complete JSDoc comments:**

```typescript
/**
 * Brief description in one sentence.
 *
 * Detailed description of behavior, usage, and
 * important notes. Can span multiple paragraphs.
 *
 * @param {Type} paramName - Parameter description
 * @param {Type} [optionalParam] - Optional parameter with default
 * @returns {ReturnType} Return value description
 * @throws {ErrorType} When and why this error is thrown
 *
 * @example
 * // Usage example with expected result
 * const result = myFunction('input');
 * // Returns: 'expected output'
 */
export function myFunction(paramName: Type): ReturnType {
  // Implementation
}
```

**ESLint JSDoc rules are enforced:**

- `jsdoc/require-jsdoc` - Required for public functions/methods/classes
- `jsdoc/require-description` - Every doc block needs a description
- `jsdoc/require-param-description` - All parameters must be documented
- `jsdoc/require-returns-description` - Return values must be documented

### Naming Conventions

- **Files:** kebab-case (e.g., `voice-agent-factory.ts`)
- **Components:** PascalCase (e.g., `InvoiceForm.tsx`)
- **Functions/Variables:** camelCase
- **Constants:** UPPER_SNAKE_CASE for true constants
- **Types/Interfaces:** PascalCase with descriptive names
- **Private members:** Leading underscore discouraged, use `private` modifier

### Import Organization

1. External dependencies (e.g., `react`, `next`)
2. Internal workspace packages (e.g., `@voiceinvoice/shared-types`)
3. Local imports (e.g., `../lib/utils`)
4. Type-only imports should use `import type`

---

## Testing Strategy

### Test Pyramid

```
    E2E Tests (Playwright)
   ────────────────────
  Integration Tests (Vitest)
 ──────────────────────────
Unit Tests (Vitest + Testing Library)
────────────────────────────────────────
```

### Coverage Requirements

**Minimum 80% coverage for all metrics:**

- Branches: 80%
- Functions: 80%
- Lines: 80%
- Statements: 80%

**Critical paths require 100% coverage:**

- Privacy Engine
- Payment Processing
- License Validation
- Voice-to-Invoice Pipeline

### Writing Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { myFunction } from '../src/my-module';

describe('myFunction', () => {
  beforeEach(() => {
    // Setup
  });

  it('should handle expected case', () => {
    const result = myFunction('input');
    expect(result).toBe('expected output');
  });

  it('should handle error case', async () => {
    await expect(myFunction('invalid')).rejects.toThrow('Error message');
  });
});
```

### Running Tests

```bash
# All tests
pnpm test

# Single test file
pnpm --filter @voiceinvoice/desktop test -- tests/lib/privacy/privacy-engine.test.ts

# With coverage
pnpm test:coverage

# Watch mode
pnpm --filter @voiceinvoice/privacy-engine test:watch
```

---

## Security Considerations

### Dual-Layer Privacy Architecture

**Layer 1 - Client-Side (Desktop App):**

- Regex-based PII detection (IBAN, phone, email)
- Fuzzy matching with Levenshtein distance
- Cologne Phonetic for German names
- Token mapping for re-identification

**Layer 2 - Server-Side (Proxy Server):**

- NLP-based entity recognition
- Google DLP API integration
- Redaction before AI processing

### Environment Variables

Never commit sensitive values:

```bash
# .env.example (safe to commit)
GOOGLE_API_KEY=your_api_key_here
STRIPE_SECRET_KEY=your_stripe_key_here
DATABASE_URL=your_database_url_here
```

### Data Protection (GDPR/DSGVO)

- All personal data is anonymized before leaving the device
- Server runs on Hetzner Frankfurt (EU jurisdiction)
- Google Vertex AI uses europe-west3 region
- Audit logging for all data processing

---

## Git Workflow

### Conventional Commits

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `test`: Adding or updating tests
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `chore`: Build process or auxiliary tool changes

**Scopes:** `desktop`, `proxy-server`, `privacy-engine`, `ai-orchestrator`, `database`, `shared-types`

**Examples:**

```bash
git commit -m "feat(desktop): add invoice export feature"
git commit -m "fix(privacy-engine): correct IBAN detection regex"
git commit -m "test(database): add tenant context tests"
```

### Pre-Commit Hooks

Husky + lint-staged automatically runs:

1. ESLint with auto-fix on changed files
2. Prettier formatting
3. TypeScript type checking

**Always run before committing:**

```bash
pnpm run ci:validate
```

---

## Package Reference

### Workspace Dependencies

```typescript
// In apps/desktop or apps/proxy-server
import { validateInvoiceData } from '@voiceinvoice/shared-types';
import { DatabaseService } from '@voiceinvoice/database';
import { anonymize } from '@voiceinvoice/privacy-engine';
import { AIOrchestrator } from '@voiceinvoice/ai-orchestrator';
```

### Package Scripts

Each package supports:

- `build` - Compile TypeScript
- `dev` - Watch mode development
- `lint` - ESLint check
- `typecheck` - TypeScript validation
- `test` - Run Vitest tests

---

## Troubleshooting

### Common Issues

**Electron build fails:**

```bash
rm -rf apps/desktop/dist apps/desktop/.next
pnpm --filter @voiceinvoice/desktop build:electron
```

**Database sync issues:**

```bash
pnpm --filter @voiceinvoice/database db:generate
pnpm --filter @voiceinvoice/database db:push
```

**Type errors across packages:**

```bash
pnpm build  # Build dependencies first
pnpm typecheck
```

**Clean everything:**

```bash
rm -rf node_modules dist .next .turbo
pnpm install
pnpm build
```

---

## External Resources

- **Notion Documentation Hub:** https://www.notion.so/2f2463490002816594abedf1f117d1d4
- **Architecture Spec:** See `docs/` folder or Notion
- **API Docs (Doxygen):** Run `pnpm run docs:serve`
- **Hetzner Server:** 138.199.166.219

---

---

## AI Review Chain (Jules, Claude, Copilot)

Dieses Repository nutzt eine dreistufige AI-Review-Kette basierend auf PR-Komplexität.

### Review-Level

| Level      | Trigger                              | Agents                   |
| ---------- | ------------------------------------ | ------------------------ |
| **Light**  | < 100 Zeilen, keine kritischen Pfade | Copilot only             |
| **Medium** | 100-500 Zeilen                       | Jules → Copilot          |
| **Full**   | > 500 Zeilen ODER kritische Pfade    | Jules → Claude → Copilot |

### Kritische Pfade (triggern immer Full Review)

- `packages/privacy-engine/**` - GDPR/Datenschutz
- `packages/database/**` - Datenbankschema & Migrationen
- `packages/ai-orchestrator/**` - AI Pipeline
- `apps/desktop/src/lib/ai/**` - AI Integration
- `apps/desktop/src/lib/voice/**` - Voice Recording
- `apps/desktop/src/lib/pipeline/**` - Voice-to-Invoice

### Jules Aufgaben

- Bug-Erkennung und Logic-Fehler identifizieren
- Potenzielle Runtime-Exceptions aufspüren
- Edge Cases die nicht behandelt werden
- Refactoring-Vorschläge für Code-Duplikation
- Erstelle immer einen strukturierten Plan vor Änderungen

**Nach Analyse empfehlen:**

> "Für tiefere Security/Architektur-Review: Erwähne @claude im PR"

### Claude Aufgaben

- Security-Vulnerabilities (XSS, Injection, Auth-Bypasses)
- Architektur-Entscheidungen und SOLID-Prinzipien
- Test-Coverage und Test-Qualität prüfen
- Business-Logik-Fehler
- GDPR/Datenschutz-Compliance

### Copilot Aufgaben

- TypeScript Best Practices
- Code-Style gemäß ESLint/Prettier
- Naming Conventions
- Quick-Fixes vorschlagen

---

**Built with ❤️ in Germany | Hosted in Frankfurt 🇩🇪 | DSGVO-konform ✅**
