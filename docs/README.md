# 🎙️ VoiceInvoice Enterprise – Projektbeschreibung

## 🎯 Sinn und Zweck (Die "Mission")

**VoiceInvoice Enterprise** ist eine sprachgesteuerte ("Voice-First") Buchhaltungssoftware, die entwickelt wurde, um den Prozess der Rechnungserstellung radikal zu vereinfachen. Das Ziel ist es, administrative Aufgaben durch modernste KI-Technologie zu automatisieren.

Anstatt Formulare manuell auszufüllen, **diktieren** Nutzer ihre Rechnungen einfach. Die App übernimmt die Transkription, versteht den Kontext, extrahiert relevante Daten (Kunde, Leistung, Preis) und erstellt daraus eine fertige, professionelle Rechnung. Dabei liegt ein massiver Fokus auf **Privacy-First** und **DSGVO-Konformität**, da mit sensiblen Finanz- und Kundendaten gearbeitet wird.

---

## 👤 Wie funktioniert sie für den User? (User Experience)

Für den Endnutzer fühlt sich die App an wie ein intelligenter Assistent, der auf dem Desktop läuft.

1.  **Spracheingabe**:
    - Der User öffnet die Desktop-App und aktiviert die Aufnahme.
    - Er spricht natürlich: _"Erstelle eine Rechnung für Max Mustermann über 500 Euro für das Webdesign-Projekt im Januar."_
    - **Offline-Fähigkeit**: Dank der Electron-Basis kann die App auch genutzt werden, wenn gerade keine perfekte Internetverbindung besteht (wobei die KI-Verarbeitung eine Verbindung benötigt).

2.  **Intelligente Verarbeitung (Magie im Hintergrund)**:
    - Die App transkribiert das Gesprochene automatisch.
    - Sie erkennt **Entitäten**: Wer ist der Kunde? Was wurde verkauft? Welcher Betrag? Welches Datum?
    - Sie versteht den **Intent** (Absicht): Geht es um eine Rechnung, ein Angebot oder eine Mahnung?

3.  **Sicherheits- & Vertrauens-Check**:
    - **High Confidence (>85%)**: Wenn sich die KI sehr sicher ist, wird der Datensatz automatisch vorbereitet.
    - **Low Confidence (<85%)**: Bei Unsicherheiten (z.B. undeutliche Aussprache) zeigt die App eine Vorschau an, die der User bestätigen oder korrigieren muss. Dies verhindert Fehler in der Buchhaltung.

4.  **Verwaltung & SaaS-Features**:
    - Der User kann Lizenzen verwalten und Abonnements (via Stripe) abschließen.
    - Team-Features ermöglichen (in der Enterprise-Version) das gemeinsame Arbeiten.

---

## 🛠️ Wie funktioniert sie intern für Developer? (Architecture & Tech Stack)

Für Entwickler ist VoiceInvoice Enterprise ein modernes **Monorepo** mit einer klaren Trennung zwischen Client, Server und Shared Packages. Es ist auf **High-Performance**, **Security** und **Scalability** ausgelegt.

### 1. Technologie-Stack

- **Monorepo**: Verwaltet mit **Turborepo** und **pnpm Workspaces**.
- **Frontend / Desktop Client**:
  - **Frameworks**: **Next.js 14** + **React 18** verpackt in **Electron**.
  - **Styling**: Tailwind CSS.
  - **Besonderheit**: Nutzt IPC (Inter-Process Communication) für den Zugriff auf Hardware (Mikrofon) und Dateisystem.
- **Backend & Server**:
  - **Server**: **Fastify 5** läuft auf einem dedizierten **Hetzner Server** in Frankfurt (für DSGVO-Compliance).
  - **Datenbanken**:
    - **SQLite** für lokale Daten im Client (Offline-First).
    - **PostgreSQL** (auf Hetzner) für Multi-Tenant-Daten, Lizenzen und User-Accounts.
    - **Supabase Vector DB** für RAG (Retrieval Augmented Generation) und Dokumentensuche.
- **KI & Automatisierung**:
  - **Google Vertex AI**: Nutzt **Gemini 2.5 Flash** (schnell & smart) und **Chirp 3** (Sprachmodelle).
  - **n8n**: Workflow-Automatisierung für Hintergrundprozesse (z.B. E-Mail-Versand, Chat-Bots).

### 2. Die "Voice-to-Invoice" Pipeline (Der Kern-Prozess)

Das Herzstück der App ist die Datenverarbeitungspipeline:

1.  **Audio Aufnahme**: Findet lokal im Electron Client statt.
2.  **Privacy Layer 1 (Server-Side)**: Google Chirp 3 transkribiert, aber anonymisiert bereits erste Daten (Redaction).
3.  **Privacy Layer 2 (Client-Side)**: Ein "Fuzzy Masking Filter" im Client anonymisiert Kundennamen _bevor_ der Text weiterverarbeitet wird (z.B. wird "Max Mustermann" zu `[KUNDE#123]`).
4.  **KI-Analyse**: Das anonymisierte Transkript geht an Gemini 2.5 Flash zur Extraktion der Fakten.
5.  **Re-Identifikation**: Erst bei der Rückgabe an den Client werden die Platzhalter (`[KUNDE#123]`) lokal wieder mit den echten Namen aus der SQLite-Datenbank gefüllt. So verlassen Klarnamen nie als Rohdaten den Kontext des Users.

### 3. Infrastruktur & Deployment

- **Hosting**: Alles (API, DB, n8n) läuft in **Frankfurt** (Hetzner + Google Cloud Region europe-west3).
- **Licensing**: Ein eigener "License Authority Service" prüft via mTLS (Mutual TLS) die Echtheit der Desktop-Clients.
- **Testing**: Strenges TDD (Test Driven Development) mit **Vitest** und einer geforderten Coverage von >80%.
- **CI/CD**: Eine lokale CI-Pipeline (`pnpm run ci:validate`) stellt sicher, dass kein fehlerhafter Code committet wird (Pre-Commit Hooks mit Husky).

### Zusammenfassung für Entwickler

Es ist eine **Local-First** Desktop-Anwendung mit Cloud-Intelligence, die extremen Wert auf Datenschutz legt ("Dual-Layer Privacy") und eine vollwertige, eigenständige SaaS-Infrastruktur (eigene Lizenzserver, eigene Auth) statt fertiger BaaS-Lösungen nutzt.
