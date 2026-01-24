# VoiceInvoice Enterprise

Voice-First Buchhaltungsanwendung mit AI-Powered Features für den 72h-Contest.

## Übersicht

VoiceInvoice Enterprise ermöglicht die Erstellung von Rechnungen durch Spracheingabe. Die Anwendung nutzt modernste KI-Technologie (Google Gemini 2.5 Flash + Chirp 3) für Transkription und intelligente Datenextraktion.

## Tech-Stack

- **Monorepo:** Turborepo + pnpm Workspaces
- **Desktop App:** Electron + Next.js 14 + React 18 + Tailwind CSS
- **Backend:** Fastify 5 auf Hetzner (Frankfurt)
- **Datenbank:** SQLite (Client/Offline) + PostgreSQL (Server/Multi-Tenant)
- **AI:** Google Vertex AI (Gemini 2.5 Flash + Chirp 3)
- **Testing:** Vitest + Testing Library (TDD mit 80% Coverage)
- **Dokumentation:** Doxygen + Notion

## Projektstruktur

```
voiceinvoice-enterprise/
├── apps/
│   ├── desktop/           # Electron + Next.js Desktop-App
│   └── proxy-server/      # Fastify Backend (Hetzner)
├── packages/
│   ├── shared-types/      # TypeScript Types + Zod Schemas
│   ├── database/          # Prisma Clients (SQLite + PostgreSQL)
│   ├── privacy-engine/    # Dual-Layer Anonymisierung
│   └── ai-orchestrator/   # Gemini Integration + Intent Classification
├── tools/
│   └── scripts/           # Build- und CI-Scripts
├── docs/
│   └── api/               # Generierte Doxygen-Dokumentation
└── turbo.json             # Turborepo-Konfiguration
```

## Schnellstart

### Voraussetzungen

- Node.js 20 LTS
- pnpm 8.x (`npm install -g pnpm`)
- Git

### Installation

```bash
# Repository klonen
git clone <repo-url>
cd voiceinvoice-enterprise

# Dependencies installieren
pnpm install

# Entwicklungsserver starten
pnpm dev
```

### Entwicklungs-Commands

```bash
# Alle Packages bauen
pnpm build

# Tests ausführen
pnpm test

# Tests mit Coverage
pnpm test:coverage

# Linting
pnpm lint

# TypeScript-Check
pnpm typecheck
```

## Lokale CI-Pipeline

**WICHTIG:** Vor jedem Commit muss die lokale CI-Validierung erfolgreich durchlaufen.

```bash
# Vollständige CI-Validierung
pnpm run ci:validate
```

Dies führt aus:

1. `ci:lint` - ESLint über alle Workspaces
2. `ci:typecheck` - TypeScript-Validierung
3. `ci:test` - Test-Suite mit Coverage
4. `ci:build` - Kompilierung aller Packages

### Pre-Commit Hooks

Husky + Lint-Staged prüfen automatisch geänderte Dateien vor jedem Commit:

- ESLint-Fixes
- Prettier-Formatierung
- TypeScript-Checks
- Vitest für betroffene Tests

## Dokumentation generieren

```bash
# Doxygen API-Dokumentation generieren
pnpm run docs:generate

# Lokal ansehen (http://localhost:8080)
pnpm run docs:serve
```

## Git-Workflow

### Feature-Branches

```bash
# Neuen Feature-Branch erstellen
git checkout develop
git pull origin develop
git checkout -b feature/subagent-XX-description

# Nach Implementation
pnpm run ci:validate
git add .
git commit -m "feat(subagent-XX): description"
git push origin feature/subagent-XX-description
```

### Commit-Konvention

Wir folgen [Conventional Commits](https://www.conventionalcommits.org/):

- `feat(scope): description` - Neue Features
- `fix(scope): description` - Bugfixes
- `docs(scope): description` - Dokumentation
- `test(scope): description` - Tests
- `refactor(scope): description` - Refactoring
- `chore(scope): description` - Wartung

## Testing

Das Projekt folgt Test-Driven Development (TDD):

1. **Test schreiben** (Red)
2. **Minimale Implementation** (Green)
3. **Refactoring** (Refactor)

Coverage-Anforderungen:

- Branches: 80%
- Functions: 80%
- Lines: 80%
- Statements: 80%

## Architektur

### Voice-to-Invoice Pipeline

```
Audio-Aufnahme
      ↓
Chirp 3 Transkription (Privacy Layer 1)
      ↓
Client-seitige Anonymisierung (Privacy Layer 2)
      ↓
Intent Classification (Hybrid: Rules + Gemini)
      ↓
Gemini 2.5 Flash Entity Extraction
      ↓
Confidence-basierte Routing
      ↓
[≥0.85] → Direktes Speichern
[<0.85] → User Preview zur Bestätigung
```

### Privacy-Engine

Dual-Layer Ansatz für DSGVO-Konformität:

1. **Google Chirp 3 Redaction** - Server-seitige Anonymisierung
2. **Client-seitige Maskierung** - Fuzzy + Phonetic Matching für Kundennamen

## Lizenz

Proprietär - VoiceInvoice Enterprise

## Links

- [Notion Documentation Hub](https://www.notion.so/2f2463490002816594abedf1f117d1d4)
- [Architektur-Spezifikation](https://www.notion.so/2f2463490002819f90aee95c866005ff)
- [Development Log](https://www.notion.so/66175b5cb8504cf8811fe9805cda7f39)
