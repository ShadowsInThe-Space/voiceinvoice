# Pull Request Review Report

## Zusammenfassung
Der PR weist kritische Mängel in den Bereichen Sicherheit, Datenkonsistenz und Vollständigkeit auf. Mehrere im Git-Log aufgeführte Dateien fehlen im Merge-Resultat.

**Review-Level:** Full
**Security-Status:** 🔴 CRITICAL (Security Review @claude erforderlich)

## 1. Kritische Bugs & Sicherheitslücken (Critical)

### 1.1 Fehlende Dateien (Incomplete Merge)
**Betroffen:**
- `apps/desktop/src/lib/encryption/*` (komplett fehlend)
- `apps/proxy-server/src/services/refund-service.ts`
- `apps/desktop/src/lib/sync/encrypted-sync-client.ts`
- `packages/ai-orchestrator/src/rag/*`

**Beschreibung:**
Trotz Einträgen im Git-Log sind diese Dateien im Dateisystem nicht auffindbar. Dies deutet auf einen fehlerhaften Merge oder fehlende Commits hin. Features wie Encryption, RAG und Refunds sind faktisch nicht vorhanden.

**Fix:**
Merge prüfen und fehlende Dateien wiederherstellen (`git checkout ...`).

### 1.2 Stripe Webhooks Broken (Security/Functional)
**Betroffen:** `apps/proxy-server/src/routes/stripe.ts` (Zeile 172)
**Beschreibung:**
Der Endpoint `/api/stripe/webhook` greift auf `request.rawBody` zu, um die Signatur zu verifizieren. `apps/proxy-server/src/server.ts` konfiguriert jedoch keinen Raw-Body-Parser (z.B. `fastify-raw-body`).
**Folge:**
`rawBody` ist `undefined`, die Signaturprüfung schlägt immer fehl (500 Internal Server Error). Zahlungen werden nicht verarbeitet.

**Fix:**
In `server.ts` das Plugin `fastify-raw-body` registrieren:
```typescript
await server.register(import('fastify-raw-body'), {
  field: 'rawBody',
  global: false,
  encoding: 'utf8',
  runFirst: true,
  routes: ['/api/stripe/webhook']
});
```

### 1.3 Schema Inkonsistenz & Duplizierung
**Betroffen:**
- `apps/proxy-server/prisma/schema-server.prisma`
- `packages/database/prisma/schema-server.prisma`

**Beschreibung:**
Es existieren zwei divergierende Schemas. `apps/proxy-server` nutzt ein Schema mit `SyncedEntity` und `License`. `packages/database` hat `License` aber kein `SyncedEntity`.
**Folge:**
Wartungsprobleme, Migrationskonflikte, und `SyncedEntity` fehlt, wenn man das Haupt-Schema deployt.

**Fix:**
Schemas konsolidieren (Single Source of Truth in `packages/database`).

## 2. Logik-Fehler & Runtime Exceptions (High)

### 2.1 Race Condition in Banking Import
**Betroffen:** `apps/desktop/electron/ipc/banking-handlers.ts` (Zeile 166-173)
**Beschreibung:**
Der Code prüft Duplikate mit `findFirst` und erstellt dann mit `create`. Das ist nicht atomar. Bei parallelen Imports können Duplikate entstehen. Der Kommentar behauptet fälschlicherweise "Use upsert pattern", nutzt es aber nicht.

**Fix:**
Echten `upsert` verwenden oder `@@unique` Constraint in der Datenbank für `(transactionDate, amount, counterparty)` hinzufügen und Fehler abfangen.

### 2.2 Unregistrierte Stripe Routes
**Betroffen:** `apps/proxy-server/src/server.ts`
**Beschreibung:**
`registerStripeRoutes` wird importiert (oder auch nicht, in der gelesenen Datei fehlte es), aber nicht aufgerufen. Stripe-Features sind inaktiv.

**Fix:**
`await registerStripeRoutes(server);` in `server.ts` hinzufügen.

## 3. Potenzielle Exceptions & Edge Cases (Medium)

### 3.1 Date Parsing Crash
**Betroffen:** `apps/proxy-server/src/routes/sync.ts` (Zeile 82) & `src/services/sync-service.ts`
**Beschreibung:**
`parseInt(sinceStr)` kann `NaN` zurückgeben. `new Date(NaN)` erzeugt "Invalid Date". Prisma wirft vermutlich einen Fehler bei der Abfrage.

**Fix:**
Validierung hinzufügen:
```typescript
const since = sinceStr && !isNaN(Number(sinceStr)) ? parseInt(sinceStr, 10) : null;
```

### 3.2 In-Memory Stores in Production Path
**Betroffen:** `apps/proxy-server/src/services/license-store.ts`
**Beschreibung:**
Der Code fällt stillschweigend auf In-Memory-Mock zurück, wenn `DATABASE_URL` fehlt. In einer Produktionsumgebung führt eine Fehlkonfiguration zu Datenverlust statt zum Startabbruch.

**Fix:**
In Production (`NODE_ENV=production`) Prozess beenden, wenn DB nicht konfiguriert ist.

## 4. Security Notes
- **IDOR:** Sync-Endpunkte scheinen durch `licenseKey` korrekt isoliert.
- **File Access:** Banking Import validiert `filePath` Herkunft nicht strikt (Low Risk in Electron Main, aber verbesserungswürdig).
- **Stripe Session:** `/api/stripe/session/:sessionId` leakt E-Mail und Firmenname an jeden, der die Session-ID kennt.

**Empfehlung:**
PR zurückweisen bis fehlende Dateien ergänzt und kritische Bugs behoben sind. Security-Review durch @claude anfordern.
