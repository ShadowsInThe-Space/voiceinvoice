# Code Review Report: Privacy Engine & Database Schema

**Reviewer:** Jules (AI Engineer)
**Target:** Merge Request `ffcecbbd` (Privacy Engine + Multi-Tenant Schema)
**Date:** 2026-02-04

## Zusammenfassung
Der Pull Request führt wichtige Features für Privacy (Dual-Layer) und Multi-Tenancy ein. Es wurden jedoch **kritische Logik-Fehler** in der AI-Pipeline und **Datenbank-Konsistenz-Probleme** gefunden, die vor dem Deployment behoben werden müssen.

## 1. Bugs und Logic-Fehler (Schweregrad: Kritisch)

### 1.1 Anonymisierung verhindert Extraktion von Rechnungsbeträgen
**Datei:** `packages/privacy-engine/src/anonymizer.ts` (Methode `maskAmounts`)
**Betroffen:** `apps/desktop/src/lib/pipeline/voice-invoice-pipeline.ts`

**Problem:**
Die Funktion `Anonymizer.maskAmounts` maskiert bedingungslos alle Geldbeträge (z.B. "100 EUR" -> `[AMOUNT_1]`). Dies geschieht in der Pipeline *bevor* die Daten an Gemini zur Extraktion gesendet werden (`parseInvoiceData`).
Dadurch sieht die AI keine Beträge mehr und kann `netAmount`, `taxAmount` und `grossAmount` nicht extrahieren.

**Vorgeschlagener Fix:**
- **Option A:** `maskAmounts` in der `anonymize`-Funktion für den Pipeline-Kontext deaktivieren (neue Option `skipAmounts: true`).
- **Option B:** `VoiceInvoicePipeline` sollte die Beträge nicht maskieren, wenn das Ziel die Datenextraktion ist (PII wie Namen/IBANs sind wichtig, Beträge sind meist unkritisch für die Identifikation, aber essenziell für die Rechnung).

### 1.2 Fehlende Multi-Tenant Uniqueness Constraints
**Datei:** `packages/database/prisma/schema-server.prisma`

**Problem:**
Das `Customer`-Model definiert keine zusammengesetzten Unique-Constraints für Felder wie `email`, `vatId` oder `iban` in Kombination mit `tenantId`.
Aktuell: `@@unique([tenantId, anonymizedToken])` ist vorhanden, aber `email` ist nur ein einfaches Feld.
Konsequenz: Ein Tenant kann versehentlich mehrere Kunden mit derselben E-Mail-Adresse anlegen, was zu inkonsistenten Daten führt.

**Vorgeschlagener Fix:**
Hinzufügen von Compound Unique Constraints:
```prisma
model Customer {
  // ...
  @@unique([tenantId, email])
  @@unique([tenantId, vatId]) // Falls VAT eindeutig sein soll
}
```

## 2. Potenzielle Runtime-Exceptions & Daten-Integrität (Schweregrad: Hoch)

### 2.1 Datenverlust durch Ersetzung mit kanonischen Namen
**Datei:** `packages/privacy-engine/src/anonymizer.ts` und `index.ts`

**Problem:**
Bei der Anonymisierung wird im `tokenMap` der *kanonische Name* aus der `knownEntities`-Liste gespeichert (z.B. "Müller GmbH"), nicht der *ursprüngliche Text* aus dem Transkript (z.B. "muller gmbh").
Beim De-Anonymisieren wird dann "Müller GmbH" in den Text eingefügt. Dies verändert den Originalinhalt des Dokuments/Transkripts ("Data Mutation"). In rechtlichen Kontexten sollte das Transkript möglichst originalgetreu wiederhergestellt werden.

**Vorgeschlagener Fix:**
In `Anonymizer.maskKnownEntities` bzw. `anonymizeCustomers`:
Speichere `match.text` (Original) statt `match.entity` (Kanonisch) in der `tokenMap`.

### 2.2 Unvollständige De-Anonymisierung
**Datei:** `apps/desktop/src/lib/pipeline/voice-invoice-pipeline.ts` (Methode `deanonymizeInvoice`)

**Problem:**
Die Methode `deanonymizeInvoice` stellt `customerName`, `address`, `notes` und `items` wieder her, ignoriert aber `customerEmail`.
Da E-Mails durch `maskEmails` anonymisiert werden (`[EMAIL_1]`), wird der neue Kunde in der Datenbank mit der E-Mail `[EMAIL_1]` angelegt, da `findOrCreateCustomer` den anonymisierten Wert nutzt.

**Vorgeschlagener Fix:**
Erweitern von `deanonymizeInvoice` um `customerEmail`.

### 2.3 Dreifache Implementierung der Fuzzy-Logik (Code Quality)
**Dateien:**
- `packages/privacy-engine/src/index.ts` (Manuelle Levenshtein-Schleifen)
- `packages/privacy-engine/src/anonymizer.ts` (Fuse.js Implementierung)
- `packages/privacy-engine/src/anonymize-customers.ts` (ClientPrivacyLayer Wrapper)

**Problem:**
Es existieren drei konkurrierende Implementierungen für dieselbe Funktionalität. `index.ts` exportiert eine manuelle Implementierung, nutzt aber intern `Anonymizer` (Fuse.js) für `anonymize()`. Dies führt zu inkonsistentem Verhalten und Wartungsproblemen.

**Vorgeschlagener Fix:**
Konsolidierung auf *eine* Implementierung (empfohlen: `anonymizer.ts` mit Fuse.js oder `ClientPrivacyLayer` wenn Performance besser ist) und Entfernung des toten Codes.

## 3. Edge Cases & Performance (Schweregrad: Medium)

### 3.1 Skalierungsproblem beim Laden aller Kunden
**Datei:** `apps/desktop/src/lib/pipeline/voice-invoice-pipeline.ts`

**Problem:**
`await this.databaseService.getAllCustomers()` lädt *alle* Kunden eines Tenants in den Speicher, um die Liste für Fuzzy-Matching zu bauen. Bei wachsender Kundenzahl (> 1000) führt dies zu Performance-Einbrüchen und hohem Speicherverbrauch pro Request.

**Vorgeschlagener Fix:**
Implementierung eines serverseitigen oder optimierten Lookups, oder Caching der Namensliste.

### 3.2 Fehlende Tenant-Validierung bei Kategorien
**Datei:** `packages/database/prisma/schema-server.prisma`

**Problem:**
Die Relation `parent Category?` stellt nicht sicher, dass die Eltern-Kategorie zum selben Tenant gehört. Obwohl die Datenbank-IDs UUIDs sind (geringes Kollisionsrisiko), sollte die Applikationslogik sicherstellen, dass keine Cross-Tenant-Hierarchien entstehen.

## Empfehlung

**Für Security-Review: @claude**
Bitte insbesondere die **Multi-Tenant-Isolation** in der Datenbank und die **Data-Leakage-Risiken** durch die inkonsistente Anonymisierung prüfen.

---
**Status:** Request Changes
**Action:** Fix Critical bugs in Pipeline and Database Schema before Merge.
