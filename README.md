# VoiceInvoice Enterprise

Voice-First Buchhaltungsanwendung mit AI-Powered Features für den 72h-Contest.

## Übersicht

VoiceInvoice Enterprise ermöglicht die Erstellung von Rechnungen durch Spracheingabe. Die Anwendung nutzt modernste KI-Technologie (Google Gemini 2.5 Flash + Chirp 3) für Transkription und intelligente Datenextraktion.

## 🚀 Production-Ready SaaS-Infrastruktur

**Wichtig:** Dies ist eine Demo-Version, die jedoch **vollständig für Production-SaaS vorbereitet** ist.

### Vorhandene Infrastruktur

✅ **Hetzner Server (Frankfurt):** api.shadowsinthe.space
✅ **Stripe-Integration:** Kompletter Checkout-Flow + Webhook-Verarbeitung
✅ **Lizenzserver:** JWT-Auth + Quota-Tracking + PostgreSQL Multi-Tenant
✅ **n8n Workflows:** RAG Chat, Document Ingestion, Email Automation
✅ **Supabase Vector DB:** Für RAG-basierte Dokumentensuche

### Demo vs. Production

| Aspekt            | Demo (aktuell)          | Production-Ready                              |
| ----------------- | ----------------------- | --------------------------------------------- |
| **API-Key**       | User bereitgestellt     | Zentral am Server (bereits implementiert)     |
| **Transkription** | Desktop → Google direkt | Desktop → Proxy → Google (Endpoint vorhanden) |
| **Quota-System**  | ✅ Implementiert        | ✅ Middleware vorhanden                       |
| **Lizenzierung**  | ✅ Stripe + Webhooks    | ✅ Vollständig funktional                     |
| **Multi-Tenant**  | ✅ PostgreSQL           | ✅ Ready                                      |

**Für Production-Migration:** Siehe [`docs/LICENSE_AND_API_KEY_FLOW.md`](docs/LICENSE_AND_API_KEY_FLOW.md)
→ Detaillierte Anleitung, wie das System in 3 Phasen zu echtem SaaS wird (1-4 Tage Aufwand)

**Server-Endpoints (bereits implementiert):**

- `POST /api/license/validate` - Lizenz validieren
- `POST /api/stripe/checkout` - Stripe Checkout Session erstellen
- `POST /api/stripe/webhook` - Payments verarbeiten
- `POST /transcribe` - Audio transkribieren (Chirp 3, zentral)
- `GET /health` - Health Check

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

## 📦 Desktop-App Bauen

### Fertige Downloads (Linux)

Die Linux-Version ist als fertige Installationsdatei verfügbar:

- **AppImage:** `VoiceInvoice Enterprise-0.1.0-x86_64.AppImage`
- **Debian/Ubuntu:** `VoiceInvoice Enterprise-0.1.0-amd64.deb`

### Selbst Bauen

> **⚠️ Wichtig:** Die Desktop-App muss auf dem jeweiligen Zielbetriebssystem gebaut werden.
> Cross-Platform-Builds (z.B. Windows von Linux aus) werden nicht unterstützt.

#### Voraussetzungen (alle Plattformen)

```bash
# Node.js 20 LTS installieren (https://nodejs.org/)
# pnpm installieren
npm install -g pnpm

# Repository klonen
git clone https://github.com/YOUR_ORG/voiceinvoice-enterprise.git
cd voiceinvoice-enterprise

# Dependencies installieren
pnpm install
```

---

### 🪟 Windows Build

**Voraussetzungen:**

- Windows 10/11
- Node.js 20 LTS
- Visual Studio Build Tools (für native Module)

```powershell
# 1. Visual Studio Build Tools installieren (falls nicht vorhanden)
# Download: https://visualstudio.microsoft.com/visual-cpp-build-tools/
# Bei der Installation "Desktop development with C++" auswählen

# 2. Repository klonen und Dependencies installieren
git clone https://github.com/YOUR_ORG/voiceinvoice-enterprise.git
cd voiceinvoice-enterprise
npm install -g pnpm
pnpm install

# 3. Desktop-App bauen
pnpm --filter @voiceinvoice/desktop build:electron

# 4. Fertige Installer findest du in:
# apps/desktop/release/VoiceInvoice Enterprise Setup 0.1.0.exe
# apps/desktop/release/VoiceInvoice Enterprise-0.1.0-win.zip
```

**Troubleshooting Windows:**

- Falls `node-gyp` Fehler: `npm install -g windows-build-tools` (als Admin)
- Falls Electron-Download fehlschlägt: Proxy-Einstellungen prüfen

---

### 🍎 macOS Build

**Voraussetzungen:**

- macOS 11 Big Sur oder neuer
- Xcode Command Line Tools
- Node.js 20 LTS

```bash
# 1. Xcode Command Line Tools installieren
xcode-select --install

# 2. Repository klonen und Dependencies installieren
git clone https://github.com/YOUR_ORG/voiceinvoice-enterprise.git
cd voiceinvoice-enterprise
npm install -g pnpm
pnpm install

# 3. Desktop-App bauen
pnpm --filter @voiceinvoice/desktop build:electron

# 4. Fertige App findest du in:
# apps/desktop/release/VoiceInvoice Enterprise-0.1.0.dmg
# apps/desktop/release/VoiceInvoice Enterprise-0.1.0-mac.zip
```

**Für Apple Silicon (M1/M2/M3):**

```bash
# Universal Binary (Intel + ARM)
pnpm --filter @voiceinvoice/desktop build:electron -- --mac --universal
```

**Code Signing (optional, für Verteilung):**

```bash
# Umgebungsvariablen setzen
export CSC_LINK="path/to/certificate.p12"
export CSC_KEY_PASSWORD="your-password"
export APPLE_ID="your@apple.id"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"

# Mit Signierung bauen
pnpm --filter @voiceinvoice/desktop build:electron
```

---

### 🐧 Linux Build

**Voraussetzungen:**

- Ubuntu 20.04+ / Debian 11+ / Fedora 35+
- Node.js 20 LTS
- Build-Tools

```bash
# 1. Build-Tools installieren
# Ubuntu/Debian:
sudo apt update
sudo apt install -y build-essential git

# Fedora:
sudo dnf groupinstall "Development Tools"

# 2. Repository klonen und Dependencies installieren
git clone https://github.com/YOUR_ORG/voiceinvoice-enterprise.git
cd voiceinvoice-enterprise
npm install -g pnpm
pnpm install

# 3. Desktop-App bauen
pnpm --filter @voiceinvoice/desktop build:electron

# 4. Fertige Pakete findest du in:
# apps/desktop/release/VoiceInvoice Enterprise-0.1.0-x86_64.AppImage
# apps/desktop/release/VoiceInvoice Enterprise-0.1.0-amd64.deb
```

**AppImage ausführen:**

```bash
chmod +x "VoiceInvoice Enterprise-0.1.0-x86_64.AppImage"
./"VoiceInvoice Enterprise-0.1.0-x86_64.AppImage"
```

**Debian-Paket installieren:**

```bash
sudo dpkg -i "VoiceInvoice Enterprise-0.1.0-amd64.deb"
```

---

### 🤖 Automatisierte Builds mit GitHub Actions

Das Repository enthält einen GitHub Actions Workflow, der automatisch für alle Plattformen baut:

**Workflow-Datei:** `.github/workflows/build-desktop.yml`

**Automatischer Trigger:**

- Bei Version-Tags (`v*`) wird automatisch gebaut und ein Release erstellt

**Manueller Trigger:**

1. Gehe zu **Actions** → **Build Desktop App**
2. Klicke auf **Run workflow**
3. Wähle den Branch und starte den Build

**Downloads:**
Nach erfolgreichem Build findest du die Installer unter:

- **Actions** → Letzter Build → **Artifacts**
- Oder unter **Releases** (bei Tag-Trigger)

**Neues Release erstellen:**

```bash
git tag v0.2.0
git push origin v0.2.0
# GitHub Actions baut automatisch für Windows, macOS, Linux
```

---

### Build-Konfiguration anpassen

Die Electron-Builder Konfiguration befindet sich in `apps/desktop/package.json` unter dem `"build"` Schlüssel:

```json
{
  "build": {
    "appId": "com.voiceinvoice.enterprise",
    "productName": "VoiceInvoice Enterprise",
    "win": {
      "target": ["nsis", "zip"]
    },
    "mac": {
      "target": ["dmg", "zip"],
      "category": "public.app-category.business"
    },
    "linux": {
      "target": ["AppImage", "deb"],
      "category": "Office"
    }
  }
}
```

---

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

## Dokumentation

### Interne Dokumentation

- [`CLAUDE.md`](CLAUDE.md) - Entwicklungs-Guidelines für Claude Code
- [`docs/LICENSE_AND_API_KEY_FLOW.md`](docs/LICENSE_AND_API_KEY_FLOW.md) - Vollständige Lizenz- und SaaS-Dokumentation
- [`docs/BUGFIX_VERIFICATION_REPORT.md`](docs/BUGFIX_VERIFICATION_REPORT.md) - E2E-Testing Ergebnisse

### Notion Links

- [Notion Documentation Hub](https://www.notion.so/2f2463490002816594abedf1f117d1d4)
- [Architektur-Spezifikation](https://www.notion.so/2f2463490002819f90aee95c866005ff)
- [Development Log](https://www.notion.so/66175b5cb8504cf8811fe9805cda7f39)

### Hetzner Server

- **API:** https://api.shadowsinthe.space
- **n8n:** https://n8n.shadowsinthe.space
- **Supabase Studio:** https://supabase-studio.shadowsinthe.space
- **IP:** 138.199.166.219
