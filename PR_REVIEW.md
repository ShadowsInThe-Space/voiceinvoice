# PR Review Report: Privacy Engine & Sync Updates

## Zusammenfassung
Der Pull Request führt eine "Dual-Layer Privacy" Strategie ein, implementiert Sync-Services und Banking-Importe.
Es wurden kritische Fehler in der Privacy-Logik gefunden, die die Kernfunktionalität (Rechnungsextraktion) beeinträchtigen, sowie Compliance-Lücken bei der Datenspeicherung.

## Gefundene Probleme

### 1. Kritische Bugs & Logik-Fehler (Critical)

**[Bug] Betrags-Maskierung bricht Rechnungsextraktion**
- **Datei**: `packages/privacy-engine/src/anonymizer.ts` (Zeile ~30 in `process()`)
- **Beschreibung**: Die Methode `maskAmounts()` maskiert pauschal alle Geldbeträge (z.B. "100 EUR" -> `[AMOUNT_1]`). Da `VoiceInvoicePipeline` die *anonymisierte* Transkription an Gemini sendet (`parseInvoiceData`), kann die KI keine numerischen Werte für `unitPrice` oder `total` extrahieren.
- **Folge**: Alle erstellten Rechnungen haben fehlende oder fehlerhafte Beträge, was das Feature unbrauchbar macht.
- **Fix**: `maskAmounts` muss konfigurierbar sein (z.B. via Option `maskMonetaryValues: false`) und für die Extraktions-Pipeline deaktiviert werden.

**[Logic] Anonymisierungs-Strategie wird ignoriert**
- **Datei**: `packages/privacy-engine/src/index.ts` (Zeile ~100)
- **Beschreibung**: Die Funktion `anonymize` akzeptiert ein Options-Objekt (`{ strategy: 'redact' }`), gibt dieses aber nicht an die `Anonymizer`-Klasse weiter. Der Konstruktor von `Anonymizer` wertet keine Strategie aus.
- **Folge**: Die erwartete Redaktion ("Schwärzung") findet nicht statt; Daten werden stattdessen immer maskiert (tokenisiert).
- **Fix**: `strategy`-Option korrekt an `Anonymizer` übergeben und dort implementieren (Token vs. fester Platzhalter).

### 2. Datenschutz & Compliance (High)

**[Compliance] Unvollständige Anonymisierung bei Speicherung**
- **Datei**: `apps/desktop/src/lib/pipeline/voice-invoice-pipeline.ts` (Methode `createInvoiceFromParsed`)
- **Beschreibung**: Bei der Speicherung der Transkription in der Datenbank wird `anonymize(transcription, { strategy: 'redact' })` aufgerufen. Da hierbei die Liste `knownEntities` nicht übergeben wird, werden Kundennamen (z.B. "Müller GmbH") im gespeicherten Text **nicht** erkannt und maskiert.
- **Folge**: DSGVO-Verstoß möglich, da PII (Namen) im Klartext in der DB verbleiben, obwohl "Anonymisierung" behauptet wird.
- **Fix**: `knownEntities` müssen auch beim zweiten `anonymize`-Aufruf übergeben werden.

### 3. Edge Cases & Datenintegrität (Medium)

**[Logic] Veränderung des Originaldokuments bei De-Anonymisierung**
- **Datei**: `packages/privacy-engine/src/index.ts` (in `anonymizeCustomers`) & `anonymizer.ts`
- **Beschreibung**: Die `tokenMap` speichert den *kanonischen* Namen der Entität (aus der Datenbank), nicht den *tatsächlich gefundenen* Text im Dokument (z.B. Tippfehler "Muller"). `deanonymize` ersetzt das Token mit dem kanonischen Namen ("Müller").
- **Folge**: Das Dokument wird bei der Wiederherstellung inhaltlich verändert ("korrigiert"). Dies verletzt das Prinzip der originalgetreuen Wiederherstellung (Faithfulness), was bei rechtlichen Dokumenten problematisch sein kann.
- **Fix**: `tokenMap` sollte den Original-Substring (`match.originalText`) speichern.

### 4. Performance & Runtime (Medium)

**[Performance] Skalierungsproblem bei Kundenliste**
- **Datei**: `apps/desktop/src/lib/pipeline/voice-invoice-pipeline.ts`
- **Beschreibung**: `databaseService.getAllCustomers()` lädt bei jeder Transkription **alle** Kunden in den Speicher. Zudem erstellt `Anonymizer` für jede Anfrage einen neuen `Fuse`-Index ($O(N)$).
- **Folge**: Signifikante Latenz und Speicherverbrauch bei wachsender Kundenzahl (>1000).
- **Fix**: Caching des Fuse-Index oder Limitierung der geladenen Kunden auf aktive/relevante Datensätze.

**[Performance] Blockierung des Main Process**
- **Datei**: `apps/desktop/electron/ipc/banking-handlers.ts` (`importCsvHandler`)
- **Beschreibung**: Der CSV-Import führt ein Fuzzy-Matching (Levenshtein) im Main-Thread aus. Bei einer Komplexität von $O(Transaktionen \times Rechnungen)$ blockiert dies die UI während des Imports.
- **Fix**: Auslagerung der Matching-Logik in einen Worker-Thread oder Nutzung von `setImmediate` zur Entlastung des Event Loops.

### 5. Code Quality (Low)

- **Redundanz**: Doppelte Implementierung von Fuzzy-Matching in `Anonymizer` (Fuse.js) und `anonymizeCustomers` (Levenshtein Custom).
- **Regex-Fehler**: In `maskEmails` wird `[A-Z|a-z]` verwendet, was das Pipe-Symbol `|` als erlaubtes Zeichen einschließt.

## Empfehlung

**Für Security-Review: @claude**
