# 🎙️ VoiceInvoice

> **English TL;DR:** Voice-first invoicing platform for freelancers — dictate invoices, get automatic payment reminders. Electron + Next.js desktop app with Gemini 2.5 Flash STT/LLM, RAG chat over your own documents, dual-layer anonymization and a DSGVO/GDPR-first architecture hosted exclusively in Frankfurt.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Status: Production Beta](https://img.shields.io/badge/Status-Production%20Beta-success)](#status)

Rechnungen diktieren statt tippen: VoiceInvoice verwandelt gesprochene Beschreibungen in fertige Rechnungen, erinnert automatisch an Zahlungen und chattet per RAG über die eigenen Dokumente. Privacy by Design — alle KI-Aufrufe laufen über eine Dual-Layer-Anonymisierung, Hosting ausschließlich Frankfurt (Hetzner + Google Vertex AI, EU-Region).

## Features

- **Voice-to-Invoice** — Rechnungen per Sprache erstellen (Chirp 3 STT + Gemini 2.5 Flash Entity Extraction, Deutsch optimiert)
- **Dual-Layer Privacy** — On-Device-Masking + Server-Redaktion; öffentliche KI-Modelle sehen nur anonymisierte Daten (DSGVO)
- **RAG-Chat** — Fragen zu eigenen Rechnungen und Dokumenten stellen
- **Offline-First** — SQLite lokal, mTLS-Synchronisierung mit PostgreSQL-Cloud
- **Workflow-Automatisierung** — Zahlungserinnerungen und Business-Logik via n8n; Telefon-Agent vorbereitet
- **Lizenzierung** — Stripe-Integration mit automatischer Lizenzgenerierung

## Tech Stack

| Komponente | Technologie                                               |
| ---------- | --------------------------------------------------------- |
| Desktop    | Electron, Next.js, React, Tailwind, shadcn/ui             |
| Backend    | Fastify, Node.js                                          |
| KI         | Google Vertex AI (Frankfurt) — Gemini 2.5 Flash + Chirp 3 |
| Datenbank  | Prisma, SQLite (lokal), PostgreSQL (Cloud, mTLS-Sync)     |
| Workflow   | n8n, Stripe                                               |

## Struktur

```
apps/
├── desktop/           # Electron + Next.js Desktop-App
└── proxy-server/      # Fastify-Backend
packages/
├── ai-orchestrator/   # Gemini + Chirp-3-Integration
├── database/          # Prisma-Clients (SQLite + PostgreSQL)
├── privacy-engine/    # Dual-Layer-Anonymisierung
└── shared-types/      # Zod-Schemas + TypeScript-Typen
```

## Entwicklung

```bash
pnpm install
cp .env.example .env        # API-Keys eintragen
pnpm db:generate
pnpm db:migrate
pnpm dev                    # Desktop + Proxy-Server

pnpm test                   # Tests
pnpm typecheck              # TypeScript
pnpm --filter @voiceinvoice/desktop build:electron   # Release-Build
```

## Status

**Production Beta.** MVP abgeschlossen — Voice-Pipeline, Verschlüsselung, Sync und Lizenzierung laufen; der autonome Telefon-Agent ist vorbereitet, aber nicht aktiviert. Weitere Details in `docs/`.

## Lizenz

[MIT](LICENSE) — Shadows-In-The-Space
