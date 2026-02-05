# Pull Request Analysis Report

**Commit:** `e14bbaf7d4b36602475b59d267654196576c5d16`
**Review-Level:** full

## 1. Kritische Bugs & Logik-Fehler (High Severity)

### 1.1 Fehlende Implementierung von `getAllCustomerNames`
- **Beschreibung:** Der PR behauptet, `getAllCustomerNames` in `DatabaseService` implementiert zu haben, aber die Methode fehlt in der Datei komplett. Der Code in `VoiceInvoicePipeline` nutzt stattdessen weiterhin `getAllCustomers()` und mappt das Ergebnis manuell. Dies widerspricht der behaupteten Optimierung.
- **Betroffene Datei:** `apps/desktop/src/lib/database/database-service.ts`
- **Vorgeschlagener Fix:** Methode implementieren:
  ```typescript
  async getAllCustomerNames(): Promise<string[]> {
    // Falls Prisma Client verwendet wird:
    // return this.prisma.customer.findMany({ select: { name: true }, where: { deletedAt: null } }).then(res => res.map(c => c.name));
    // Oder via raw query analog zum Rest der Datei:
    const results = await this.prisma.$queryRawUnsafe<{ name: string }[]>('SELECT name FROM Customer WHERE deletedAt IS NULL');
    return results.map(r => r.name);
  }
  ```

### 1.2 Compilation Error in Tests
- **Beschreibung:** Die Tests in `voice-invoice-pipeline.test.ts` (Test Case: "should NOT save invoice and return parsed data when confidence is low") greifen auf `result.requiresReview` und `result.parsedInvoice` zu. Diese Properties sind jedoch im `PipelineResult` Interface nicht definiert. Die Tests sind aktiv (nicht geskipped), was zu Build/Type-Check-Fehlern führt.
- **Betroffene Datei:** `apps/desktop/tests/pipeline/voice-invoice-pipeline.test.ts`, `apps/desktop/src/lib/pipeline/voice-invoice-pipeline.ts`
- **Vorgeschlagener Fix:** `PipelineResult` Interface in `voice-invoice-pipeline.ts` erweitern um `requiresReview?: boolean` und `parsedInvoice?: ParsedInvoice`.

### 1.3 Inkonsistente Anonymisierung (Security Risk)
- **Beschreibung:** In der Methode `createInvoiceFromParsed` wird `anonymize(transcription, { strategy: 'redact' })` aufgerufen. Da hierbei keine `knownEntities` übergeben werden (das zweite Argument ist das Options-Objekt), werden **Kundennamen nicht maskiert**. Die gespeicherte Transkription enthält somit potenziell Klarnamen, obwohl diese vorher für die KI-Verarbeitung maskiert wurden. Dies verletzt potenziell Privacy-Anforderungen.
- **Betroffene Datei:** `apps/desktop/src/lib/pipeline/voice-invoice-pipeline.ts` (in `createInvoiceFromParsed`)
- **Vorgeschlagener Fix:** Entweder das bereits anonymisierte Ergebnis aus `processTranscriptionInternal` durchreichen oder `knownEntities` beim zweiten `anonymize`-Aufruf übergeben.
- **Hinweis:** Für Security-Review: @claude

## 2. Potenzielle Runtime-Exceptions & Performance (Medium Severity)

### 2.1 Ineffiziente Anonymisierung (Performance)
- **Beschreibung:** Die Klasse `Anonymizer` nutzt einen Brute-Force Ansatz ($O(N \cdot M)$), um alle möglichen Substrings zu generieren und gegen `knownEntities` zu prüfen (via Fuse.js). Bei längeren Texten und vielen Kunden führt dies zu erheblichen Performance-Problemen.
- **Betroffene Datei:** `packages/privacy-engine/src/anonymizer.ts`
- **Vorgeschlagener Fix:** Verwendung der in `src/index.ts` exportierten `anonymizeCustomers`-Funktion, welche einen effizienteren Ansatz implementiert, oder Optimierung der Substring-Generierung.

### 2.2 Unnötiger Data-Fetch
- **Beschreibung:** `VoiceInvoicePipeline` ruft `getAllCustomers()` auf und mappt dann auf Namen. Das lädt alle Kundendaten (inkl. Adressen, E-Mails, Notizen) in den Speicher, nur um die Namen zu extrahieren.
- **Betroffene Datei:** `apps/desktop/src/lib/pipeline/voice-invoice-pipeline.ts`
- **Vorgeschlagener Fix:** Nutzung der (zu implementierenden) `getAllCustomerNames()` Methode.

## 3. Edge Cases

### 3.1 Redundante Logik
- **Beschreibung:** Es existieren zwei parallele Implementierungen für Fuzzy-Matching von Kundennamen: Einmal in `Anonymizer` (Fuse.js) und einmal in `anonymizeCustomers` (custom Levenshtein). Dies führt zu Wartbarkeitsproblemen und inkonsistentem Verhalten.
- **Betroffene Datei:** `packages/privacy-engine/src/index.ts`, `packages/privacy-engine/src/anonymizer.ts`

---
**Zusammenfassung:** Der PR ist in diesem Zustand **nicht stabil**. Die Tests kompilieren nicht, eine versprochene Optimierung fehlt, und es gibt eine Sicherheitslücke bei der Persistierung von Transkriptionen.
