# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working Principles

### Skill Loading (MANDATORY)

**Always check and load relevant skills BEFORE any action or response:**
- If there is even a 1% chance a skill might apply, invoke it via the `Skill` tool
- Skills provide specialized workflows and domain knowledge
- Never skip skill loading - even for "simple" tasks
- Common skills: `brainstorming`, `test-driven-development`, `systematic-debugging`, `frontend-design`, `executing-plans`

**Red flags that mean STOP and load a skill:**
- "This is just a simple question" → Check for skills first
- "Let me explore the codebase first" → Skills tell you HOW to explore
- "I can do this quickly" → Skills prevent mistakes

### Task Management (MANDATORY)

**Always create a task list before starting any work**, regardless of task size:
1. Use `TaskCreate` to break down the work into discrete steps
2. Update task status with `TaskUpdate` (in_progress when starting, completed when done)
3. Check `TaskList` regularly to ensure no tasks are forgotten
4. Never claim completion without verifying ALL tasks are done

**Conductor Workflow:**
If a `conductor/` directory exists in this repository, use its workflow definitions for planning new tasks. Read the conductor files first to understand the established task planning patterns and phases before creating your task list.

### Code Search Strategy

**Always use Serena MCP tools for semantic code search** to save tokens:
- `mcp__serena__find_symbol` - Find symbols by name path
- `mcp__serena__get_symbols_overview` - Get file symbol structure
- `mcp__serena__find_referencing_symbols` - Find symbol usages
- `mcp__serena__search_for_pattern` - Pattern-based search

Avoid reading entire files. Use Serena's symbolic tools to read only the bodies of symbols you actually need.

### Parallel Subagent Usage

**Maximize parallel subagent execution:**
- Launch multiple Task agents simultaneously when tasks have no dependencies
- Use `run_in_background: true` for long-running tasks
- Never wait for one agent when others can run in parallel
- Verify all subagent results - they may not complete tasks fully

### Self-Verification (MANDATORY)

**Before claiming any task is complete:**
1. Re-read the original requirements
2. Verify all acceptance criteria are met
3. Run relevant tests (`pnpm test`)
4. Check for TypeScript errors (`pnpm typecheck`)
5. Review the actual code changes made
6. Ensure no tasks were forgotten or skipped

### Code Quality Standards

**CLEAN Code Principles:**
- Meaningful names (variables, functions, classes)
- Small functions with single responsibility
- No magic numbers or strings
- DRY (Don't Repeat Yourself)
- KISS (Keep It Simple, Stupid)

**SOLID Principles:**
- **S**ingle Responsibility - One reason to change per class/module
- **O**pen/Closed - Open for extension, closed for modification
- **L**iskov Substitution - Subtypes must be substitutable
- **I**nterface Segregation - Many specific interfaces over one general
- **D**ependency Inversion - Depend on abstractions, not concretions

**Documentation Requirements:**
- Every exported function, class, and interface MUST have JSDoc comments
- Include `@param`, `@returns`, `@throws`, `@example` tags
- Write documentation WHILE writing code, not after

## Build & Development Commands

```bash
# Install dependencies (requires pnpm 8.x)
pnpm install

# Start all dev servers (desktop + proxy)
pnpm dev

# Start Electron desktop app specifically
pnpm dev:electron

# Build all packages
pnpm build

# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Linting
pnpm lint

# TypeScript validation
pnpm typecheck

# Full CI validation (run before commits)
pnpm run ci:validate
```

### Running Single Tests

```bash
# Run single test file
pnpm --filter @voiceinvoice/desktop test -- apps/desktop/tests/pages/invoices-new.test.tsx

# Run tests matching pattern
pnpm test -- --grep "pattern"

# Run tests in watch mode for a package
pnpm --filter @voiceinvoice/desktop test -- --watch
```

### Package-Specific Commands

```bash
# Desktop app
pnpm --filter @voiceinvoice/desktop dev
pnpm --filter @voiceinvoice/desktop build:electron

# Proxy server
pnpm --filter @voiceinvoice/proxy-server dev

# Build a specific package
pnpm --filter @voiceinvoice/shared-types build
```

## Architecture Overview

**VoiceInvoice Enterprise** is a voice-first German accounting application (Electron + Next.js 14) that creates invoices through voice commands using Google Vertex AI.

### Monorepo Structure

- **apps/desktop/** - Electron + Next.js 14 desktop app (main UI)
- **apps/proxy-server/** - Fastify 5 backend (deployed on Hetzner Frankfurt)
- **packages/shared-types/** - TypeScript types + Zod validation schemas
- **packages/database/** - Prisma clients for both SQLite (desktop) and PostgreSQL (server)
- **packages/privacy-engine/** - Dual-layer GDPR-compliant anonymization
- **packages/ai-orchestrator/** - Gemini 2.5 Flash + Chirp 3 integration

### Voice-to-Invoice Pipeline

The core data flow follows this pattern:
1. Audio recording (browser MediaRecorder API)
2. Chirp 3 transcription with server-side privacy redaction
3. Client-side anonymization via fuzzy/phonetic matching
4. Intent classification (hybrid: rules + Gemini)
5. Gemini 2.5 Flash entity extraction
6. Confidence-based routing: ≥0.85 auto-save, <0.85 user preview

### Dual Database Strategy

- **Desktop (SQLite):** Local file-based storage at `./data/voiceinvoice.db`
- **Server (PostgreSQL):** Multi-tenant with license tracking

Key models: Customer, Invoice, Recording, Category, BankTransaction, AppSettings, AuditLog

### Desktop App Structure

```
apps/desktop/
├── electron/          # Electron main process, IPC handlers, preload API
├── src/
│   ├── pages/         # Next.js pages (index, dashboard, settings, invoices/)
│   ├── components/    # React components (InvoiceForm, VoiceRecorderButton, etc.)
│   ├── lib/           # Core services
│   │   ├── ai/        # AI integration
│   │   ├── database/  # Database service layer
│   │   ├── privacy/   # Privacy layer
│   │   ├── voice/     # Audio recording
│   │   ├── pipeline/  # Voice-to-invoice orchestration
│   │   └── export/    # PDF export (jsPDF)
│   └── hooks/         # React custom hooks
└── tests/             # Vitest tests
```

### Path Aliases

Desktop app uses these TypeScript path aliases:
- `@/*` → `./src/*`
- `@electron/*` → `./electron/*`

## Testing

Framework: Vitest with Testing Library. Coverage requirement: 80% for branches, functions, lines, statements.

Test files are located in `*/tests/**/*.{test,spec}.ts`.

## Documentation

Generate API docs with Doxygen:

```bash
pnpm run docs:generate
pnpm run docs:serve  # View at http://localhost:8080
```

JSDoc comments required for all exported functions, classes, and interfaces.

## Commit Convention

Follow Conventional Commits:
- `feat(scope): description`
- `fix(scope): description`
- `docs(scope): description`
- `test(scope): description`
- `refactor(scope): description`
- `chore(scope): description`

Pre-commit hooks (Husky + lint-staged) auto-run ESLint + Prettier on changed files.
