# VoiceInvoice Enterprise - Produkthandbuch & Jury-Dokumentation

> **Eingereicht für:** Innovation Contest 2026
> **Kategorie:** Enterprise AI / FinTech
> **Version:** 2.0 (Production Candidate)

---

## 📑 Inhaltsverzeichnis

1.  [Executive Summary: Die Vision](#1-executive-summary-die-vision)
2.  [Das EVA-Prinzip 2.0 (Core Philosophy)](#2-das-eva-prinzip-20-core-philosophy)
3.  [Architektur & Technische Exzellenz](#3-architektur--technische-exzellenz)
4.  [Kerntechnologie: Dual-Layer Privacy Engine](#4-kerntechnologie-dual-layer-privacy-engine)
5.  [Feature Deep-Dive: Der Finance Assistant (RAG)](#5-feature-deep-dive-der-finance-assistant-rag)
6.  [Benutzerhandbuch: Workflow](#6-benutzerhandbuch-workflow)
7.  [Infrastruktur & Sicherheit (Hetzner)](#7-infrastruktur--sicherheit-hetzner)
8.  [Roadmap & Ausblick](#8-roadmap--ausblick)

---

## 1. Executive Summary: Die Vision

**VoiceInvoice Enterprise** ist der Paradigmenwechsel in der Buchhaltung. Wir ersetzen formulardiagnostische Klick-Arbeit durch **natürliche, sprachgesteuerte Interaktion**.

Wir lösen das größte Problem kleiner und mittlerer Unternehmen: **Zeitverlust durch Administration.**
Statt Daten abzutippen, die sie bereits im Kopf haben, diktieren Unternehmer ihre Rechnungen on-the-fly. Und statt in Excel-Listen nach Antworten zu suchen, fragen sie einfach ihren **KI-Finanzassistenten**.

**Warum dieses Projekt gewinnen muss:**

- **Innovation:** Die erste "Voice-First" Buchhaltung, die unstrukturierte Sprache in valide Finanzdaten verwandelt.
- **Datenschutz:** Eine weltweit einzigartige **Dual-Layer Privacy Engine**, die KI-Nutzung DSGVO-konform macht.
- **Technologie:** Ein High-Performance Stack auf europäischer Infrastruktur (Hetzner).

---

## 2. Das EVA-Prinzip 2.0 (Core Philosophy)

Unsere gesamte Architektur basiert auf einer radikalen Modernisierung des klassischen **EVA-Prinzips** der Informatik (**E**ingabe - **V**erarbeitung - **A**usgabe).

### 🗣️ EINGABE (Input): Voice-First

Weg von der Tastatur, hin zum Mikrofon.
Klassische Systeme verlangen strukturierte Eingaben (Formulare). VoiceInvoice akzeptiert **unstrukturierte Daten** (natürliche Sprache) und entfernt so die Hürde zwischen Gedanke und Erfassung.

> _"Rechnung an Müller, 3 Stunden Beratung à 100 Euro."_

### ⚙️ VERARBEITUNG (Process): Privacy & AI Orchestration

Hier geschieht die Magie.

1.  **Anonymisierung:** Die **Dual-Layer Privacy Engine** maskiert sensible Daten lokal (Layer 1) und auf dem Proxy (Layer 2).
2.  **Strukturierung:** Das LLM (Gemini 2.5) extrahiert Entitäten, berechnet Summen und validiert Steuerlogik.
3.  **Persistierung:** Speicherung in einer lokalen Vektordatenbank (SQLite/Prisma) für Offline-Verfügbarkeit.

### 💬 AUSGABE (Output): Der Finance Assistant (RAG)

Daten sollen nicht nur gedruckt, sondern genutzt werden.
Die Ausgabe ist nicht nur ein PDF, sondern **Wissen**.
Der integrierte **Finance Assistant** nutzt Retrieval Augmented Generation (RAG), um Fragen zu beantworten:

> _"Wie viel Umsatz haben wir diesen Monat mit Kunde Müller gemacht?"_

---

## 3. Architektur & Technische Exzellenz

VoiceInvoice setzt auf eine hybride "Local-First" Architektur.

### Der Tech-Stack (Monorepo)

- **Frontend (Client):** Electron, Next.js 14, React Server Components (RSC).
- **Design:** Tailwind CSS & shadcn/ui.
- **Data Layer:** Prisma & SQLite (Lokal) für Offline-Capability & Vektor-Search.
- **Backend (Proxy):** Fastify (Node.js) auf **Hetzner Cloud (Frankfurt)**.
- **Orchestrator:** Intelligentes Routing zwischen Gemini 2.5 Flash (Speed) und GPT-4o (Reasoning).

---

## 4. Kerntechnologie: Dual-Layer Privacy Engine

Der Einsatz von US-basierten KI-Modellen ist in Europa oft problematisch. Wir haben das gelöst.

**Das Problem:** KI muss Daten verstehen, darf sie aber nicht "sehen".
**Unsere Lösung:** Die Dual-Layer Privacy Engine.

### Layer 1: Client-Side Redaction (On-Device)

Bevor Daten das Gerät verlassen, analysiert eine lokale Logik (Regex & Wortlisten) den Input.

- Erkennt IBANs, E-Mail-Adressen, Telefonnummern.
- Ersetzt diese durch Tokens: `[EMAIL_REDACTED]`.

### Layer 2: Server-Side Deep Masking (In-Flight)

Unser Hetzner-Proxy nutzt NER (Named Entity Recognition), um Namen und Adressen im Kontext zu erkennen und zu maskieren, bevor der Prompt an Google/OpenAI geht.

**Das Ergebnis:** Die KI sieht nur die Struktur ("Erstelle Rechnung für [PERSON] über [BETRAG]"). **100% DSGVO-konform.**

---

## 5. Feature Deep-Dive: Der Finance Assistant (RAG)

Während traditionelle Software nur "Datenfriedhöfe" erzeugt, macht VoiceInvoice Daten sprechfähig.

### Die Technologie dahinter (RAG)

1.  **Vektorisierung:** Jede erstellte Rechnung und jeder Kunde wird lokal "eingebettet" (Embeddings).
2.  **Retrieval:** Wenn der Nutzer eine Frage stellt ("Welche Rechnungen sind überfällig?"), sucht das System semantisch passende Einträge in der lokalen Datenbank.
3.  **Generation:** Die gefundenen Daten werden (anonymisiert) an das LLM gesendet, welches eine natürlichsprachliche Antwort generiert.

### Use-Case Szenario

- **Nutzer:** "Wie läuft der Umsatz im Vergleich zum letzten Monat?"
- **System (SQL-Query):** `SELECT sum(total) FROM invoices WHERE ...`
- **System (Antwort):** "Dein Umsatz ist um 15% gestiegen, hauptsächlich durch das große Projekt mit der 'Design Agentur Schmidt'."

---

## 6. Benutzerhandbuch: Workflow

### Schritt 1: Diktieren (Eingabe)

Drücken Sie die "n". Sprechen Sie natürlich:

> "Rechnung an die Musterfirma GmbH in Berlin. Wir haben drei Tage Beratung geleistet, Tagessatz 800 Euro. Bitte sofort zahlbar."

### Schritt 2: KI-Vorschau (Verarbeitung)

Das System zeigt in Millisekunden eine Vorschau.

- Erkannte Entitäten werden hervorgehoben.
- Unsichere Werte werden gelb markiert.

### Schritt 3: Interaktion (Ausgabe)

Nach dem Speichern können Sie sofort Fragen stellen:

> "Haben wir diesem Kunden schon eine Mahnung geschickt?"

---

## 7. Infrastruktur & Sicherheit (Hetzner)

Wir setzen bewusst auf **Digital Sovereignty**.

- **Standort:** Alle verarbeitenden Server stehen in Deutschland (Falkenstein/Nürnberg).
- **Provider:** Hetzner Online GmbH.
- **Lizenzierung:** Vollautomatisiert via **Stripe**. Nach dem Kauf wird der Lizenzschlüssel auf unserem Hetzner-Server generiert und aktiviert.
- **Verschlüsselung:** Datenbanken sind via LUKS auf Volume-Ebene verschlüsselt.

---

## 8. Roadmap & Ausblick

Wir sind erst am Anfang.

- **Q3 2026:** Autonomous Phone Agent (KI ruft Kunden für Mahnungen an - _Architektur bereits in n8n vorbereitet_).
- **Q4 2026:** "Voice-Biometrie" für Login.
- **2027:** "Tax-Advisor-Mode": Proaktive Steuertipps.

VoiceInvoice Enterprise verändert die Arbeit.
**Weg von der Tastatur. Zurück zum Wesentlichen.**
