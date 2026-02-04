# AI Review Chain Design

> Unified Code Review System mit Jules, Claude und Copilot

**Erstellt:** 2026-02-04  
**Status:** Implementiert ✅

---

## Übersicht

Dreistufige AI-Review-Kette die automatisch basierend auf PR-Komplexität das richtige Review-Level auswählt.

```
┌─────────────────────────────────────────────────────────────────┐
│                    PR wird erstellt                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Größe ermitteln │
                    └─────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
    < 100 Zeilen        100-500 Zeilen      > 500 Zeilen
    ODER keine          ODER gemischte      ODER kritische
    kritischen Pfade    Pfade               Pfade
          │                   │                   │
          ▼                   ▼                   ▼
    ┌──────────┐        ┌──────────┐        ┌──────────┐
    │ Copilot  │        │  Jules   │        │  Jules   │
    │   only   │        │    +     │        │    ↓     │
    └──────────┘        │ Copilot  │        │  Claude  │
                        └──────────┘        │    ↓     │
                                            │ Copilot  │
                                            └──────────┘
```

---

## Review-Level

| Level      | Trigger                              | Agents                   | Kosten    |
| ---------- | ------------------------------------ | ------------------------ | --------- |
| **Light**  | < 100 Zeilen, keine kritischen Pfade | Copilot only             | Kostenlos |
| **Medium** | 100-500 Zeilen                       | Jules → Copilot          | ~$0.05    |
| **Full**   | > 500 Zeilen ODER kritische Pfade    | Jules → Claude → Copilot | ~$0.20    |

---

## Kritische Pfade

Diese Pfade triggern immer ein Full Review:

- `packages/privacy-engine/**` - GDPR/Datenschutz
- `packages/database/**` - Datenbankschema & Migrationen
- `packages/ai-orchestrator/**` - AI Pipeline
- `apps/desktop/src/lib/ai/**` - AI Integration
- `apps/desktop/src/lib/voice/**` - Voice Recording
- `apps/desktop/src/lib/pipeline/**` - Voice-to-Invoice

---

## Agent-Verantwortlichkeiten

### Jules (Bug-Analyse)

- Bug-Erkennung und Logic-Fehler
- Potenzielle Runtime-Exceptions
- Edge Cases die nicht behandelt werden
- Refactoring-Vorschläge für Code-Duplikation
- Erstellt strukturierte Pläne

**Konfiguration:** `AGENTS.md`

### Claude (Security & Architektur)

- Security-Vulnerabilities (XSS, Injection, Auth-Bypasses)
- Architektur-Entscheidungen und SOLID-Prinzipien
- Test-Coverage und Test-Qualität
- Business-Logik-Fehler
- GDPR/Datenschutz-Compliance

**Konfiguration:** `.github/workflows/ai-review.yml` (claude_args)

### Copilot (Code Style)

- TypeScript Best Practices
- Naming Conventions
- Code-Style gemäß ESLint/Prettier
- Quick-Fixes

**Konfiguration:** `.github/copilot-instructions.md`

---

## Implementierte Dateien

| Datei                             | Zweck                             |
| --------------------------------- | --------------------------------- |
| `.github/workflows/ai-review.yml` | Hauptworkflow mit Routing-Logik   |
| `.github/copilot-instructions.md` | Copilot Review Instructions       |
| `AGENTS.md`                       | Jules Instructions + Projekt-Doku |

---

## Secrets

| Secret                    | Quelle                          |
| ------------------------- | ------------------------------- |
| `JULES_API_KEY`           | jules.google → Account Settings |
| `CLAUDE_CODE_OAUTH_TOKEN` | `claude setup-token`            |

---

## Workflow-Ablauf

```yaml
jobs:
  analyze: # 1. PR-Größe und kritische Pfade ermitteln
  jules-review: # 2. Bug-Analyse (medium + full)
  claude-review: # 3. Deep Review (nur full)
  summary: # 4. Zusammenfassung posten
```

---

## Quellen

- [Jules GitHub Action](https://github.com/google-labs-code/jules-action)
- [Claude Code Action](https://github.com/anthropics/claude-code-action)
- [Copilot Instructions Guide](https://github.blog/ai-and-ml/unlocking-the-full-power-of-copilot-code-review-master-your-instructions-files/)
- [AGENTS.md Specification](https://agents.md/)

---

**Erstellt mit Claude Opus 4.5 via Brainstorming-Skill**
