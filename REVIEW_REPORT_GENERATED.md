# Code Review Report: Task 10 Refund Handling

## Zusammenfassung
Der Pull Request implementiert grundlegendes Refund-Handling und Lizenz-Suspension. Die Logik für partielle Refunds und Status-Updates ist im Unit-Test korrekt. Jedoch ist die Implementierung durch die Verwendung eines In-Memory Stores (`PaymentRecordStore`) **nicht produktionsreif**, da Datenverlust bei Neustarts auftritt. Zudem bestehen Race-Conditions bei gleichzeitigen Webhooks und es wurden unnötige Dateien committet.

## Gefundene Probleme

### 1. Kritisch: Fehlende Datenpersistenz (Data Persistence)
**Schweregrad:** 🔴 Kritisch
**Betroffene Dateien:**
- `apps/proxy-server/src/services/payment-record-store.ts` (Zeilen 84-126)

**Beschreibung:**
Der `PaymentRecordStore` verwendet eine einfache `Map` (`storeInstance = createMockPaymentRecordStore()`), um Zahlungsdaten zu speichern.
- **Auswirkung:** Bei jedem Server-Neustart (Deployment, Crash) gehen alle historischen Zahlungsdaten verloren.
- **Folge:** Wenn ein Refund für eine Transaktion *vor* dem letzten Neustart reinkommt, schlägt `getByPaymentIntentId` fehl (`handled: false`), und die Lizenz wird trotz Refund nicht suspendiert.

**Vorgeschlagener Fix:**
Implementierung eines persistenten Stores (z.B. Prisma/PostgreSQL).
```typescript
// Statt In-Memory Map:
return await prisma.paymentRecord.findUnique({ where: { paymentIntentId } });
```

### 2. Hoch: Race Condition in `applyRefundEvent`
**Schweregrad:** 🟠 Hoch
**Betroffene Dateien:**
- `apps/proxy-server/src/services/refund-service.ts` (Zeilen 48-73)

**Beschreibung:**
Die Funktion liest den Record, modifiziert ihn im Speicher und schreibt ihn zurück (Read-Modify-Write).
```typescript
const paymentRecord = await paymentStore.getByPaymentIntentId(input.paymentIntentId);
// ... Berechnung ...
await paymentStore.updateRecord(updatedRecord);
```
- **Auswirkung:** Wenn Stripe mehrere Webhooks parallel sendet (z.B. `refund.created` und `refund.updated`), können Updates überschrieben werden (Lost Update Problem).
- **Folge:** Der `refundedAmount` könnte falsch berechnet werden, wodurch die Lizenz fälschlicherweise aktiv bleibt oder suspendiert wird.

**Vorgeschlagener Fix:**
Verwendung von Datenbank-Transaktionen oder atomaren Updates (z.B. `prisma.$transaction`).

### 3. Mittel: Fehlende Transaktionssicherheit bei Lizenz-Erstellung
**Schweregrad:** 🟡 Mittel
**Betroffene Dateien:**
- `apps/proxy-server/src/routes/stripe.ts` (Zeilen 220-255)

**Beschreibung:**
Die Erstellung der Lizenz (`store.addLicense`) und des PaymentRecords (`paymentStore.addRecord`) erfolgt getrennt.
- **Auswirkung:** Wenn `addRecord` fehlschlägt (nachdem `addLicense` erfolgreich war), existiert eine Lizenz ohne verknüpfte Zahlungshistorie. Refunds sind für diese Lizenz unmöglich.

**Vorgeschlagener Fix:**
Beide Operationen sollten in einer Transaktion ausgeführt werden.

### 4. Niedrig: Fehlendes Handling für Chargebacks (Disputes)
**Schweregrad:** 🔵 Niedrig
**Betroffene Dateien:**
- `apps/proxy-server/src/routes/stripe.ts`

**Beschreibung:**
Es werden nur `refund.*` Events behandelt. `charge.dispute.created` (Rückbuchungen) führen ebenfalls zu einem Verlust der Zahlung, suspendieren aber die Lizenz nicht.

**Vorgeschlagener Fix:**
Hinzufügen von `charge.dispute.created` zum Webhook-Handler.

### 5. Niedrig: Unnötige Dateien im Commit
**Schweregrad:** 🔵 Niedrig
**Betroffene Dateien:**
- `apps/desktop/test_report.txt`

**Beschreibung:**
Der PR enthält eine sehr große Textdatei (`test_report.txt`), die wahrscheinlich versehentlich hinzugefügt wurde.

**Vorgeschlagener Fix:**
Datei aus dem PR entfernen und in `.gitignore` aufnehmen.

## Sicherheitshinweis
Für Security-Review: @claude
Bitte insbesondere die Idempotenz der Webhooks und die Race-Conditions prüfen.

## Fazit
Der PR ist ein guter Proof-of-Concept, darf aber in dieser Form (In-Memory Store) **nicht gemerged** werden, wenn Persistenz gefordert ist.
