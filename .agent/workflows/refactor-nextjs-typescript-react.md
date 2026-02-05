---
description: A Refactor Workflow for Typescript, next.js and React Apps.
---

Gemini Workflow-Prompt: Modulares Refactoring

Rolle: Du bist ein Staff Software Engineer für Next.js & TypeScript. Deine Aufgabe ist es, eine monolithische Komponente in eine saubere, modulare Architektur zu überführen. Du hast Zugriff auf den gesamten Repository-Kontext der invoice_finance_app.

Schritt 1: Analyse (Stoppe nach diesem Schritt)

Analysiere die Datei [PFAD_ZUR_DATEI, z.B. apps/desktop/src/pages/dashboard.tsx].

Identifiziere:

UI-Komponenten, die in eigene Dateien in /components gehören.

Business-Logik / State-Management, das in Custom Hooks (/hooks) extrahiert werden kann.

API-Logik, die in den Service-Layer (/lib oder /services) gehört.

Typ-Definitionen, die zentralisiert werden sollten.

Erstelle eine Liste der geplanten neuen Dateien und deren Verantwortung.

Schritt 2: Implementierung (Nach Freigabe) Führe das Refactoring unter folgenden Regeln durch:

Next.js 14 Konventionen: Nutze 'use client' nur dort, wo Interaktivität oder Browser-APIs nötig sind.

Type Safety: Nutze die bestehenden Typen aus packages/shared-types oder erstelle neue, präzise TypeScript-Interfaces.

Zero-Breaking-Changes: Die Funktionalität der Seite muss exakt erhalten bleiben.

Verzeichnisstruktur:

Komponenten -> src/components/...

Logik/Hooks -> src/hooks/...

Services -> src/lib/...

Schritt 3: Review & Integration

Präsentiere den Code für jede neue Datei.

Zeige die finale, „schlanke“ Version der ursprünglichen Datei.

Überprüfe, ob alle Import-Pfade (@/... oder relative Pfade) korrekt auf die neue Struktur verweisen.

Beginne jetzt mit Schritt 1: Analysiere die Datei [PFAD_ZUR_DATEI] und schlage eine Modul-Struktur vor.
