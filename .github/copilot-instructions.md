# Copilot Code Review Instructions

## Sprache

Antworte immer auf Deutsch.

## Fokus-Bereiche

- TypeScript Best Practices und strikte Typisierung
- Naming Conventions: camelCase für Variablen, PascalCase für Komponenten/Klassen
- Code-Style gemäß ESLint/Prettier Konfiguration
- Keine verschachtelten Ternary-Operatoren
- Prefer `const` über `let`, vermeide `var`
- Async/await statt verschachtelte Promises

## Projekt-spezifische Regeln

- Alle React-Komponenten als Functional Components mit TypeScript
- Hooks in `src/hooks/` Verzeichnis
- Zod für Runtime-Validierung bei API-Grenzen
- Electron IPC Handler in `electron/` Verzeichnis

## Ignorieren

Diese Bereiche werden von anderen Agents geprüft:

- Security-Vulnerabilities → Claude
- Architektur-Entscheidungen → Claude
- Test-Coverage und Test-Qualität → Claude
- Bug-Erkennung → Jules
- Refactoring-Vorschläge → Jules

## Quick-Fixes

Schlage Quick-Fixes vor für:

- Fehlende Typen
- Unused imports
- Inkonsistente Formatierung
- Fehlende Error-Boundaries in React
