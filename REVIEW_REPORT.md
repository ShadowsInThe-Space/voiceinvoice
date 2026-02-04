# Review Report: Dual-Layer Privacy & Fuzzy Masking

## Zusammenfassung
Der PR führt zu einer **kritischen Regression** in der PII-Erkennung und beinhaltet **schwerwiegende Performance-Probleme**. Die ursprüngliche Regex-basierte PII-Erkennung (IBAN, E-Mail, Telefon) wurde versehentlich entfernt und durch eine ineffiziente Implementierung ersetzt.

## Gefundene Probleme

### 1. Kritische Regression: Entfernung der PII-Erkennung (High)
**Datei:** `packages/privacy-engine/src/index.ts`
**Beschreibung:** Die ursprüngliche `anonymize`-Funktion, die E-Mails, Telefonnummern und IBANs mittels Regex maskierte, wurde komplett durch die neue Fuzzy-Matching-Logik ersetzt.
**Auswirkung:** IBANs und Kontaktdaten werden nicht mehr maskiert, was ein Sicherheitsrisiko darstellt. Der PR sollte "Dual-Layer" sein, hat aber den ersten Layer entfernt.
**Empfehlung:** Die Regex-Logik muss wiederhergestellt und mit der Namensmaskierung kombiniert werden.

### 2. Performance: Ineffizienter Brute-Force Algorithmus (High)
**Datei:** `packages/privacy-engine/src/index.ts` (Zeilen 122-167)
**Beschreibung:** Die Implementierung nutzt eine Brute-Force "Sliding Window" Levenshtein-Berechnung (O(N*M*L)).
**Kontext:** In `apps/desktop/src/lib/pipeline/voice-invoice-pipeline.ts` werden **alle** Kunden (`getAllCustomers()`) geladen und übergeben. Bei 1.000+ Kunden führt dies zu massiven Latenzen oder Timeouts.
**Empfehlung:** Verwenden Sie stattdessen die optimierte `ClientPrivacyLayer`-Klasse (in `dual-layer-privacy.ts`), die effizientere Suchstrategien verwendet.

### 3. Code-Duplizierung und Verwirrung (Medium)
**Datei:** `packages/privacy-engine/src/anonymize-customers.ts` vs `index.ts`
**Beschreibung:** `anonymize-customers.ts` enthält eine ungenutzte Kopie der langsamen `anonymize`-Funktion sowie die optimierte `anonymizeCustomers`. Die Pipeline nutzt jedoch die langsame Version aus `index.ts`.
**Empfehlung:** `anonymize-customers.ts` bereinigen. `index.ts` sollte die optimierte Logik exportieren.

### 4. Logic/Integration Fehler (Medium)
**Datei:** `apps/desktop/src/lib/pipeline/voice-invoice-pipeline.ts`
**Beschreibung:** Die Pipeline importiert `anonymize` aus `index.ts`, welches nun die Signatur `(text, knownEntities)` hat. Dies bricht die Abwärtskompatibilität für andere Konsumenten, die `(text, options)` erwarten.

## Vorgeschlagene Fixes

1.  **Revert & Merge in `index.ts`:**
    Stellen Sie die PII-Regex-Erkennung wieder her. Integrieren Sie die Kunden-Maskierung als zusätzlichen Schritt (z.B. via Option `knownEntities` in `AnonymizeOptions`).

2.  **Nutzen der `ClientPrivacyLayer`:**
    Ersetzen Sie den manuellen Loop in `index.ts` durch:
    ```typescript
    const layer = new ClientPrivacyLayer({ fuzzyThreshold: 0.8, usePhoneticMatching: true });
    layer.addCustomerNames(knownEntities);
    const result = layer.maskCustomerNames(text);
    ```

3.  **Pipeline Optimierung:**
    Vermeiden Sie `getAllCustomers()` wenn möglich, oder stellen Sie sicher, dass die Matching-Logik performant genug für tausende Einträge ist (nur via `ClientPrivacyLayer` möglich).

Für Security-Review: @claude
