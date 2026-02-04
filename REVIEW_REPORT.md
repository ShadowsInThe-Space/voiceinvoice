# Code Review Report: Privacy & Schema

**Reviewer:** Jules
**Date:** 2026-02-04
**Review Level:** Medium
**Scope:** `packages/privacy-engine`, `apps/desktop/src/lib/pipeline`, `packages/database`

## Zusammenfassung
Der Review deckt kritische Logikfehler in der neuen Privacy-Pipeline auf, die dazu führen, dass anonymisierte Daten (z.B. maskierte E-Mails) fälschlicherweise als echte Daten in die Datenbank geschrieben werden. Zudem gibt es Inkonsistenzen in der Implementierung der `privacy-engine` und fehlende Constraints im Multi-Tenant-Schema.

## Gefundene Probleme

### 1. Critical: Fehlende Deanonymisierung von E-Mail-Adressen
**Datei:** `apps/desktop/src/lib/pipeline/voice-invoice-pipeline.ts`
**Zeilen:** 224-245 (Methode `deanonymizeInvoice`)

**Beschreibung:**
Die Methode `deanonymizeInvoice` stellt `customerName`, `customerAddress`, `notes` und `items` wieder her, ignoriert aber `customerEmail`.
Da die Transkription *vor* der Übergabe an Gemini anonymisiert wird (z.B. wird "test@example.com" zu `[EMAIL_1]`), extrahiert Gemini `[EMAIL_1]` als E-Mail-Adresse.
Da diese nicht deanonymisiert wird, wird `[EMAIL_1]` über `createInvoiceFromParsed` -> `findOrCreateCustomer` als E-Mail des Kunden in der Datenbank gespeichert. Die echte E-Mail geht verloren.

**Empfohlener Fix:**
Erweitern der `deanonymizeInvoice`-Methode um das E-Mail-Feld:
```typescript
if (result.customerEmail) {
  result.customerEmail = deanonymize(result.customerEmail, tokenMap);
}
```

### 2. Critical: Inkonsistente Implementierung von `anonymizeCustomers`
**Datei:** `packages/privacy-engine/src/index.ts` vs `packages/privacy-engine/src/anonymize-customers.ts`

**Beschreibung:**
Die Datei `packages/privacy-engine/src/index.ts` exportiert eine inline implementierte Version von `anonymizeCustomers`, die eine einfache, ineffiziente ($O(N \cdot M)$) und weniger robuste Fuzzy-Matching-Logik verwendet.
Parallel existiert in `packages/privacy-engine/src/anonymize-customers.ts` eine verbesserte Implementierung, die den `ClientPrivacyLayer` nutzt.
Da `index.ts` der Haupt-Einstiegspunkt ist, nutzen Konsumenten des Pakets standardmäßig die schlechtere Implementierung.

**Empfohlener Fix:**
`index.ts` sollte die Implementierung aus `anonymize-customers.ts` exportieren anstatt sie neu zu definieren.

### 3. Medium: Fehlende Multi-Tenant Constraints für Kunden-E-Mails
**Datei:** `packages/database/prisma/schema-server.prisma`
**Model:** `Customer`

**Beschreibung:**
Das `Customer`-Modell hat zwar `@@unique([tenantId, anonymizedToken])`, aber keine Unique-Constraint für E-Mails innerhalb eines Tenants. Das erlaubt Duplicate-Customer-Einträge für dieselbe E-Mail im gleichen Tenant.
Zudem fehlt eine Eindeutigkeit für `companyName` pro Tenant (falls gewünscht).

**Empfohlener Fix:**
Hinzufügen von:
```prisma
@@unique([tenantId, email])
```

### 4. Low: Irreführende API-Verwendung (`strategy: 'redact'`)
**Datei:** `apps/desktop/src/lib/pipeline/voice-invoice-pipeline.ts` (Zeile 306)
**Datei:** `packages/privacy-engine/src/index.ts`

**Beschreibung:**
Der Aufruf `anonymize(transcription, { strategy: 'redact' })` suggeriert, dass eine Redaktions-Strategie gewählt wird. Die `anonymize`-Funktion in `index.ts` ignoriert dieses Option-Objekt jedoch komplett und führt immer eine Maskierung mit Tokens durch (`Anonymizer` unterstützt keine Strategien im Konstruktor).

**Empfohlener Fix:**
Entweder die Option in `anonymize` implementieren oder den Aufruf bereinigen.

---

### Security-Empfehlung

Aufgrund der PII-Handling-Probleme (Datenverlust bei E-Mails, potentielle Leaks durch falsche Implementierung):

**Für Security-Review: @claude**
