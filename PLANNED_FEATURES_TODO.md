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
- [x] **Entity Extraction**: Regelbasierte Extraktion von Kundennamen, Beträgen, Datum, MwSt, Zahlungsbedingungen (69 Tests).

## 🔒 Privacy & Compliance (`privacy-engine`)

- [x] **Anonymisierungs-Logik**: PII-Erkennung (Email, Telefon, IBAN, Steuer-IDs) mit mask/redact/hash Strategien (48 Tests).
- [ ] **Dual-Layer Ansatz**: Integration der server-seitigen Chirp-Redaktion mit der client-seitigen Maskierung.

## 💾 Datenbank-Layer

- [x] **Zentrale Initialisierung**: Prisma Client Singleton mit Connection Management, Retry-Logik, Health Check (41 Tests).
- [ ] **Multi-Tenant Schema**: Anpassung des PostgreSQL-Schemas für den Server-Betrieb.

## 🔗 Integrationen & Automatisierung

- [x] **n8n Integration**: Webhook-URLs in Settings, Retry-Logik mit exponential backoff, Backup-URL Support (28 Tests).
- [ ] **Bank-Synchronisation**:
  - [ ] Import-Funktion für Kontoauszüge (CSV/MT940).
  - [ ] Matching-Algorithmus zum Abgleich von Zahlungen mit offenen Rechnungen.

## 🖥️ Desktop-App Verfeinerungen

- [x] **Export-Funktion**: CSV/JSON Export mit Dropdown-UI, Click-Outside-Handling (7 Tests).
- [x] **PDF-Branding**: Logo-Upload mit Drag&Drop, Base64-Speicherung, Integration in PDF-Export (27 Tests).
- [ ] **Offline-Sync**: Logik zur Synchronisation der lokalen SQLite-Daten mit dem PostgreSQL-Backend, sobald eine Verbindung besteht.

---

_Status: Stand 24. Januar 2026 - Core-Features implementiert (560 Tests bestanden)._
