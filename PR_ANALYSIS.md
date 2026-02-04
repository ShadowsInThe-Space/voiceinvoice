# PR Analyse Report: `25ece4e` (Database Package Refactor)

## Zusammenfassung
Der PR zielt darauf ab, das Prisma Client Setup zu finalisieren, führt jedoch signifikante Regressionen und Implementierungslücken ein, die das Paket für Produktionsszenarien ohne Workarounds unbrauchbar machen.

## 1. Bugs und Logic-Fehler

### [CRITICAL] Fehlende Default Client Implementierung
**Schweregrad:** Kritisch
**Datei:** `packages/database/src/index.ts`
**Zeilen:** ~135-139 (Funktion `getDatabase`)

**Problem:**
Die Funktion `getDatabase()` wirft standardmäßig einen `PRISMA_NOT_GENERATED` Fehler, da der `else`-Block für die Erstellung des eigentlichen `PrismaClient` nicht implementiert ist (enthält nur einen "For now" TODO).
```typescript
} else {
  // In production, we would create actual PrismaClient here
  // For now, throw an error indicating Prisma needs to be generated
  throw new DatabaseError(...)
}
```
**Auswirkung:**
Konsumenten können das Datenbankmodul nicht verwenden, ohne manuell eine Client-Factory über `setPrismaClientFactory` zu injizieren. Die Fehlermeldung suggeriert fälschlicherweise, dass `pnpm db:generate` das Problem behebt, was nicht der Fall ist, da der generierte Client nicht geladen wird. Dies widerspricht dem Ziel "finalize".

**Vorgeschlagener Fix:**
Implementierung der Default-Instanziierung des Clients. Da der Client nach `../generated/client` generiert wird, sollte er dynamisch importiert oder eingebunden werden.

### [MAJOR] Restriktive Interface-Definition
**Schweregrad:** Major
**Datei:** `packages/database/src/index.ts`
**Zeilen:** ~59-64 (`PrismaClientInterface`)

**Problem:**
Das `PrismaClientInterface` definiert nur `$connect`, `$disconnect`, `$queryRaw` und `$executeRaw`. Es fehlen sämtliche generierten Model-Accessors (z.B. `customer`, `invoice`).

**Auswirkung:**
Konsumenten, die dieses Interface nutzen (Rückgabewert von `getDatabase`), verlieren den Zugriff auf alle typsicheren ORM-Features (z.B. `db.customer.findMany()`) und sind gezwungen, Raw-SQL oder Type-Casting zu verwenden. Dies macht den Hauptzweck von Prisma zunichte.

**Vorgeschlagener Fix:**
Aktualisierung von `PrismaClientInterface`, um den tatsächlichen generierten `PrismaClient`-Typ zu exportieren, oder zumindest Hinzufügen einer Index-Signatur `[key: string]: any`.

## 2. Potenzielle Runtime-Exceptions

### [MEDIUM] Ressourcen-Leck in Verbindungslogik
**Schweregrad:** Medium
**Datei:** `packages/database/src/index.ts`
**Zeilen:** ~168-176 (Funktion `connect`)

**Problem:**
Die `connect`-Funktion erstellt ein `setTimeout` für das Timeout-Handling, löscht dieses aber nicht, wenn die Verbindung erfolgreich hergestellt wird, bevor das Timeout eintritt.
```typescript
const timeoutPromise = new Promise<never>((_, reject) => {
  setTimeout(() => { ... }, connectionTimeoutMs);
});
await Promise.race([client.$connect(), timeoutPromise]);
```
**Auswirkung:**
Dies hinterlässt einen aktiven Timer im Event Loop, der verhindern kann, dass der Node.js-Prozess (oder Test-Runner wie Vitest) sauber beendet wird, bis das Timeout (Standard 10s) abläuft.

**Vorgeschlagener Fix:**
Speichern der Timeout-ID und Aufruf von `clearTimeout` nachdem die Race-Condition aufgelöst ist.

## 3. Edge Cases die nicht behandelt werden

### [LOW] Brittle Error Matching
**Schweregrad:** Niedrig
**Datei:** `packages/database/src/index.ts`
**Zeilen:** ~307 (Funktion `isTransientError`)

**Problem:**
Die Funktion prüft auf transiente Fehler durch Abgleich von breiten Strings wie "connection" oder "timeout".
```typescript
const transientMessages = ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'connection', 'timeout'];
```
**Auswirkung:**
Könnte zu False Positives führen, bei denen nicht-transiente Fehler (z.B. "Connection configuration invalid") unnötigerweise erneut versucht werden, was das Fehlerfeedback verzögert.

**Vorgeschlagener Fix:**
Verfeinerung der Liste von String-Mustern oder primäre Nutzung von Fehlercodes.

## Empfehlung
Dieser PR ist **unvollständig**. Das Ziel "finalize" wird aufgrund der fehlenden Implementierung in `getDatabase` nicht erreicht.

Für Security-Review: @claude (Keine spezifischen Sicherheitslücken gefunden, aber `logging: true` Konfiguration sollte geprüft werden, um sicherzustellen, dass keine Credentials in Logs leaken).
