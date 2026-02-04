# Review Report: Dual-Layer Privacy & Pipeline Integration

**Review-Level:** medium
**Target:** PR/Commit Dual-Layer Privacy (`71c774e`) & Pipeline Integration

## 1. Bugs und Logic-Fehler

### [CRITICAL] Anonymisierung verhindert Rechnungsdaten-Extraktion
**Datei:** `packages/privacy-engine/src/anonymizer.ts` (Zeilen 163-167)
**Problem:** Die Methode `maskAmounts` maskiert bedingungslos alle Geldbeträge (z.B. "100 EUR" -> `[AMOUNT_1]`). Dies geschieht im Pipeline-Prozess *bevor* der Text an die KI (Gemini) gesendet wird (`VoiceInvoicePipeline.processTranscriptionInternal`).
**Auswirkung:** Die KI erhält einen Text ohne konkrete Zahlenwerte für Preise und Summen. Die Extraktion von `unitPrice` und `quantity` wird fehlschlagen oder fehlerhafte Daten liefern. Dies bricht die Kernfunktionalität der Rechnungsstellung per Sprache.
**Fix:** Die `maskAmounts`-Funktion sollte während der Extraktionsphase deaktiviert sein (z.B. via Option `{ maskAmounts: false }`) oder die Anonymisierung sollte für die KI-Extraktion intelligenter gestaltet werden.

### [HIGH] Datenverlust bei E-Mail-Deanonymisierung
**Datei:** `apps/desktop/src/lib/pipeline/voice-invoice-pipeline.ts` (Zeilen 237-254)
**Problem:** Die Funktion `deanonymizeInvoice` stellt `customerName`, `customerAddress` und `notes` wieder her, ignoriert aber explizit `customerEmail`.
**Auswirkung:** Wenn eine E-Mail in der Transkription erkannt und anonymisiert wurde (z.B. "an bob@example.com" -> `[EMAIL_1]`), wird sie als `[EMAIL_1]` im erstellten Kunden-Datensatz gespeichert. Die echte E-Mail geht verloren.
**Fix:** Ergänzung in `deanonymizeInvoice`:
```typescript
if (result.customerEmail) {
  result.customerEmail = deanonymize(result.customerEmail, tokenMap);
}
```

### [MEDIUM] `anonymizeCustomers` ignoriert bessere Implementierung
**Datei:** `packages/privacy-engine/src/index.ts`
**Problem:** Die exportierte `anonymizeCustomers`-Funktion ist eine manuelle, minderwertige Implementierung (Inline-Loop), die die robustere `ClientPrivacyLayer`-Logik aus `src/anonymize-customers.ts` ignoriert.
**Auswirkung:** Die beworbene "Dual-Layer Privacy" (Client-Side Fuzzy Matching) wird im Hauptmodul nicht korrekt genutzt. Es wird eine weniger präzise Matching-Logik verwendet.
**Fix:** `index.ts` sollte die Implementierung aus `anonymize-customers.ts` exportieren anstatt sie neu zu definieren.

### [MEDIUM] Kunden-Namen nicht redigiert in Datenbank
**Datei:** `apps/desktop/src/lib/pipeline/voice-invoice-pipeline.ts` (Zeilen 317)
**Problem:** In `createInvoiceFromParsed` wird `anonymize(transcription, { strategy: 'redact' })` aufgerufen, um die Transkription für die Datenbank zu bereinigen. Dabei werden jedoch keine `knownEntities` (Kundenliste) übergeben.
**Auswirkung:** PII (Email, IBAN, Telefon) wird entfernt, aber Kundennamen bleiben im Klartext in der gespeicherten Transkription erhalten. Dies widerspricht potenziell den Datenschutzanforderungen für "anonymisierte Speicherung".
**Fix:** Übergeben der `knownEntities` an den `anonymize`-Aufruf in `createInvoiceFromParsed`.

## 2. Potenzielle Runtime-Exceptions

### [LOW] Regex-Verarbeitung bei Anonymisierung
**Datei:** `packages/privacy-engine/src/anonymizer.ts`
**Problem:** Die Regex für E-Mails enthält `[A-Z|a-z]`, was das Pipe-Zeichen `|` matcht. Dies ist vermutlich unbeabsichtigt (Typo für `[A-Za-z]`), führt aber selten zu Fehlern, es sei denn eine Email enthält `|`.

## 3. Edge Cases

### [MEDIUM] Skalierbarkeit der Kundensuche
**Datei:** `apps/desktop/src/lib/pipeline/voice-invoice-pipeline.ts` (Zeilen 180)
**Problem:** Es werden bei jeder Transkription *alle* Kunden aus der Datenbank geladen (`getAllCustomers`).
**Auswirkung:** Bei einer wachsenden Kundenbasis (>1000) führt dies zu Speicher- und Performance-Problemen (O(N) bei jedem Request).
**Fix:** Implementierung einer serverseitigen Suche oder Caching der Kundenliste/Indexe.

---
**Für Security-Review: @claude**
