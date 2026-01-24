# 📋 Offene Aufgaben: VoiceInvoice Enterprise

Dieses Dokument listet alle noch nicht implementierten Features und Platzhalter auf, die im Codebase-Audit identifiziert wurden.

## 🏗️ Backend & Infrastruktur

- [x] **Proxy-Server Implementierung**: Fastify-Server mit CORS, Helmet, Rate-Limiting (18 Tests).
- [x] **API-Endpunkte**: `/transcribe` (Gemini 2.0 Flash), `/enrich` (Gemini 2.5 Flash), `/health`.
- [x] **Hetzner Deployment**: Docker-Files, docker-compose.yml, deploy.sh erstellt und auf Server deployed (Port 3001).
- [ ] **Lizenz-Validierung**: Implementierung der serverseitigen Prüfung von Lizenzschlüsseln.

## 🤖 KI & Orchestrierung (`ai-orchestrator`)

- [x] **Intent Classification**: Regelbasierte Klassifikation für INVOICE/ANALYTICS mit Confidence-Score (49 Tests).
- [x] **Confidence-basiertes Routing**: Auto-Save (>=0.85), Preview (>=0.60), Manual (<0.60) mit PipelineOrchestrator (98 Tests).
- [ ] **Entity Extraction**: Verknüpfung mit Gemini Function Calling zur strukturierten Datengewinnung.

## 🔒 Privacy & Compliance (`privacy-engine`)

- [x] **Anonymisierungs-Logik**: PII-Erkennung (Email, Telefon, IBAN, Steuer-IDs) mit mask/redact/hash Strategien (48 Tests).
- [ ] **Dual-Layer Ansatz**: Integration der server-seitigen Chirp-Redaktion mit der client-seitigen Maskierung.

## 💾 Datenbank-Layer

- [ ] **Zentrale Initialisierung**: Prisma Client Setup und Verbindungsmanagement in `packages/database` finalisieren (Subagent #4).
- [ ] **Multi-Tenant Schema**: Anpassung des PostgreSQL-Schemas für den Server-Betrieb.

## 🔗 Integrationen & Automatisierung

- [ ] **n8n Integration**:
  - [ ] UI-Felder für Webhook-URLs in `settings.tsx` hinzufügen.
  - [ ] Logik zum Senden von Rechnungsdaten an n8n bei Statusänderungen.
- [ ] **Bank-Synchronisation**:
  - [ ] Import-Funktion für Kontoauszüge (CSV/MT940).
  - [ ] Matching-Algorithmus zum Abgleich von Zahlungen mit offenen Rechnungen.

## 🖥️ Desktop-App Verfeinerungen

- [x] **Export-Funktion**: CSV/JSON Export mit Dropdown-UI, Click-Outside-Handling (7 Tests).
- [ ] **PDF-Branding**: Unterstützung für den Upload und die Einbindung von echten Firmenlogos im PDF-Header.
- [ ] **Offline-Sync**: Logik zur Synchronisation der lokalen SQLite-Daten mit dem PostgreSQL-Backend, sobald eine Verbindung besteht.

---

_Status: Stand 24. Januar 2026 - Core-Features implementiert (551+ Tests bestanden)._
