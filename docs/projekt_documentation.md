# Projekt-Dokumentation (Notion MCP Mirror)

Dieses Dokument fasst die wichtigsten Inhalte der Notion-MCP-Struktur zusammen und ergänzt sie mit konkreten Designentscheidungen, Vor/Nachteilen, Privacy- und Lizenzinformationen sowie der DSGVO-konformen Hosting-Strategie.

## Überblick & Notion-MCP-Seiten

1. **Projektziel & Kontext** – Ziel ist es, VoiceInvoice Enterprise als sprachaktiviertes Buchhaltungstool zu positionieren, das alles von Transkription über Entity-Extraktion bis zur Rechnungserstellung automatisiert.
2. **Architektur & Komponenten** – Übersicht über Electron/Next.js Desktop-App, Fastify-Backend auf Hetzner, Prisma/SQLite/ PostgreSQL, Privacy-Engine und die Gemini-Orchestrierung.
3. **Privacy-First-Ansatz** – Detaillierte Beschreibung der Dual-Layer-Anonymisierung (Chirp 3 Redaction + Client-Masking) und wie sie die DSGVO-Compliance stützt.
4. **Lizenz- & Hosting-Modell** – Erläuterung, wie Lizenzierung über dedizierte Hetzner-Server gesteuert wird.
5. **KI-Integration & Compliance** – Darstellung der Gemini-Modelle in Frankfurt und der damit verbundenen DSGVO-Gewährleistung.
6. **Designentscheidungen & Trade-offs** – Beispiele, warum bestimmte Technologien, Muster oder Abläufe gewählt wurden.

- **Electron + Next.js 14 Desktop-App**  
  _Begründung:_ Native Desktop-Erfahrung mit Web-UI erlaubt den Zugriff auf lokale Mikrofone/Dateisysteme ohne Browser-Limitationen.  
  _Beispiel:_ Der Transkript-Workflow nutzt Electron-IPC für Audioaufnahme, während das UI mit Next.js Server Components responsive bleibt.
- **Fastify Backend auf Hetzner Frankfurt**  
  _Begründung:_ Minimaler Overhead, native HTTP/2-Unterstützung und einfache Skalierung mit Konfiguration als Reverse Proxy.  
  _Beispiel:_ Die Privacy-Engine läuft als Fastify-Plugin mit Request-Scoped Loggern und verhindert das unbeabsichtigte Speichern roher Sprachaufnahmen.
- **Dual-Layer-Privacy-Engine**  
  _Begründung:_ Vermeidet, dass sensible Daten jemals unmaskiert auf Servern landen und schützt gleichzeitig gegen Rekonstruktion.  
  _Beispiel:_ Kundenname wird zuerst durch Cloud-Redaction (Chirp 3) anonymisiert, danach sorgt clientseitiger Fuzzy-Masking-Filter dafür, dass nicht einmal Synonyme übertragen werden.
- **Gemini 2.5 Flash in Frankfurt**  
  _Begründung:_ Kurzantwortzeit kombiniert mit regionalem Hosting sichert niedrige Latenz und DSGVO-Konformität.  
  _Beispiel:_ Die Entity-Extraction-Pipeline bleibt innerhalb Frankfurter Rechenzentren, das Routing erfolgt über Vertex AI Regions, die durch Hetzner-VPN mit dem Backend verbunden sind.

## Vor- und Nachteile

| Entscheidung                    | Vorteile                                          | Nachteile / Gegenmaßnahmen                                                       |
| ------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------- |
| Electron + Next.js Desktop      | Hardwarezugriff + Offline-Fähigkeit               | größeres Build, Update-Mechanismus nötig (aktualisiert per Auto-Updater)         |
| Fastify auf Hetzner             | Hohe Kontrolle, Kostenübersicht                   | Manuelle Skalierung, daher Monitoring + Autoscaler-Playbook erforderlich         |
| Privacy-First Pipeline          | DSGVO-Compliance + Vertrauen der Nutzer           | Höherer Entwicklungsaufwand (Masking-Regeln gepflegt durch Privacy-Engine-Tests) |
| Gemini über Vertex AI Frankfurt | Schnelle, kontextsensitive Antworten, lokalisiert | Kosten für Vertex AI + Regionenbindung (Budget-Tracking im Billing-Dashboard)    |

## Privacy-First-Konzept

1. **Client-seitig**
   - Audio wird lokal erfasst, vor der Übertragung durch Filter geleitet (Stimmenmaskierung, Noise Gate, PII-Regex).
   - Vor der Rückgabe an das Backend werden alle erkannten Entitäten pseudonymisiert (z. B. `Max Mustermann` → `[KUNDE#123]`), damit die Daten niemals roh gespeichert werden.
2. **Server-seitig**
   - Fastify verarbeitet nur bereits anonymisierte Daten. Die Privacy-Engine validiert jede Anfrage gegen eine Masken-Library, ehe sie gespeichert oder weiterverarbeitet wird.
   - Die Speicherung in PostgreSQL erfolgt mit Transparent Data Encryption (TDE) + Zugriffskontrolle per Rollen.
3. **Audit & Monitoring**
   - Logging nutzt Hash-Summen statt Klartext und enthält nur Meta-Informationen. Kontrollmechanismen warnen bei fehlerhaften Maskierungen.
   - Regelmäßige Privacy-Scans (z. B. SAST + manuelle Review Sessions) stellen sicher, dass Maskenregeln aktuell bleiben.

## Lizenzsystem über Hetzner-Server

Das Lizenzmanagement läuft auf einer dedizierten Hetzner-Infrastruktur (Frankfurt) und ist folgendermaßen strukturiert:

- **License Authority Service** (Fastify) auf einem Hetzner-Server:
  - Verbindet sich mit den Desktop-Clients per Mutual TLS (mTLS).
  - Prüft Lizenzschlüssel gegen ein PostgreSQL-Backend.
  - Steuert Feature-Flags (z. B. Multilingual-Modus, Team-Features, API-Access).
- **Monitoring & Auto-Scaling**
  - Hetzner-Monitoring überprüft Auslastung und startet bei Bedarf zusätzliche Serverinstanzen.
  - License-Service speichert nur minimal notwendigen Kontext (Client-ID, License-Status, letzte Prüfzeit).
- **Backup & Recovery**
  - Nightly-Snapshots der Lizenzdatenbank + multi-regionale Offsite-Kopien bei Hetzner.
  - Wiederherstellungstest dokumentiert im Notion-Backup-Playbook.

## Gemini Hosting in Frankfurt & DSGVO-Konformität

- **Regionale Bindung:** Gemini 2.5 Flash + Chirp 3 Modelle laufen ausschließlich in Vertex AI in Frankfurt (europe-west3).
- **Verbindungswege:** Fastify-Backend kommuniziert über private Peering-Schnittstelle und VPN mit Vertex AI, so dass Audiodaten niemals den öffentlichen Raum verlassen.
- **DSGVO-Maßnahmen:**
  - Datenminimierung: Nur notwendige Transkriptionsdaten werden nach der Privacy-Engine an Gemini weitergegeben.
  - Auftragsverarbeitung (AVV) mit Google und Hetzner liegt vor.
  - Data Residency Policies dokumentiert im Compliance-Board (Notion-Page verlinkt).
  - Rechte der Betroffenen (z. B. Löschanfragen) werden über den License-Service und Privacy-Engine-Logs nachvollziehbar gemacht.
