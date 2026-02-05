# Code Review Report: Pull Request Analysis

## Zusammenfassung
Der PR führt kritische Sicherheitslücken und Datenverlustrisiken ein. Es wird dringend empfohlen, diesen PR nicht zu mergen, bevor die identifizierten Probleme behoben sind.

**Empfehlung:** Für Security-Review: @claude

## Gefundene Probleme

### 1. IDOR Vulnerability in Sync Routes (Kritisch)
**Problem:** Die API-Endpunkte `/api/sync/encrypted` und `/api/sync/encrypted/pull` vertrauen blind dem `x-tenant-id` Header des Clients. Ein authentifizierter Benutzer kann durch Änderung dieses Headers Daten beliebiger anderer Tenants lesen oder überschreiben (Insecure Direct Object Reference). Dies ist ein schwerwiegender Sicherheitsverstoß.
**Datei:** `apps/proxy-server/src/routes/sync.ts` (Zeilen ~154, ~194)
**Vorgeschlagener Fix:**
Die `tenantId` darf niemals vom Client akzeptiert werden. Sie muss serverseitig aus dem authentifizierten Lizenz-Token abgeleitet werden.
```typescript
// FALSCH:
// const tenantId = request.headers['x-tenant-id'] as string | undefined;

// RICHTIG:
const license = (request as any).license as LicenseTokenPayload;
// Angenommen, die Lizenz ist an einen Tenant gebunden:
const tenantId = deriveTenantId(license.licenseKey);
```

### 2. Irreversible Recovery Phrase (Kritisch)
**Problem:** Die Funktion `generateRecoveryPhrase` hasht den Encryption Key (`sha256Sync(key)`), anstatt ihn zu kodieren. Da Hashing (SHA-256) eine Einwegfunktion ist, kann der originale Encryption Key **niemals** aus der Recovery Phrase wiederhergestellt werden. Das Feature täuscht Sicherheit vor, führt aber im Ernstfall zu garantiertem Datenverlust.
**Datei:** `apps/desktop/src/lib/encryption/recovery-phrase.ts` (Zeile 163)
**Vorgeschlagener Fix:**
Der Key muss reversibel kodiert werden. Die 32 Bytes des Keys sollten direkt als Entropie für den BIP39-Algorithmus verwendet werden.

### 3. Datenverlust durch In-Memory Storage (Kritisch)
**Problem:** Sowohl der `PaymentRecordStore` als auch der `EncryptedSyncService` verwenden `new Map()` zur Datenspeicherung.
- Alle Zahlungsinformationen und Refunds gehen bei Server-Neustart verloren.
- Alle synchronisierten, verschlüsselten Dokumente gehen verloren.
Für einen Produktions-PR (wie durch das Merge-Ziel impliziert) ist dies inakzeptabel.
**Dateien:**
- `apps/proxy-server/src/services/payment-record-store.ts`
- `apps/proxy-server/src/services/encrypted-sync-service.ts`
**Vorgeschlagener Fix:**
Implementierung einer persistenten Datenbank (PostgreSQL via Prisma) für diese Services vor dem Merge.

### 4. Datenkorruption durch "Double Encryption" (Hoch)
**Problem:** Die Funktion `decryptSensitiveFields` fängt Entschlüsselungsfehler ab und gibt den *originalen Ciphertext* zurück (in der Annahme, es sei Legacy-Plaintext). Wenn dieser Datensatz später gespeichert wird, verschlüsselt `encryptSensitiveFields` diesen Ciphertext erneut.
Dies führt zu doppelt verschlüsselten Daten, die vom System nicht mehr gelesen werden können (Silent Data Corruption).
**Datei:** `apps/desktop/src/lib/encryption/field-encryption.ts` (Zeile 131)
**Vorgeschlagener Fix:**
Verwenden Sie `isEncrypted`, um zu prüfen, ob der Wert verschlüsselt aussieht. Wenn ja und die Entschlüsselung fehlschlägt, muss ein Fehler geworfen oder der Vorgang abgebrochen werden. Keinesfalls darf Ciphertext als Plaintext behandelt werden.

### 5. Runtime Crash: localStorage in Node.js (Hoch)
**Problem:** `encryption-context.ts` greift auf globaler Ebene (bzw. bei Initialisierung) auf `localStorage` zu. Dieser Code wird auch im Electron Main Process (Node.js) importiert/ausgeführt, wo `localStorage` nicht existiert. Dies führt zum Absturz der Applikation.
**Datei:** `apps/desktop/src/lib/encryption/encryption-context.ts`
**Vorgeschlagener Fix:**
Prüfen Sie auf die Existenz von `localStorage` (`typeof localStorage !== 'undefined'`) oder verwenden Sie eine Abstraktionsschicht, die im Main Process auf `electron-store` oder Dateisystem zurückgreift.

### 6. Runtime Crash: Buffer is not defined (Hoch)
**Problem:** `packages/encryption-layer` nutzt `Buffer.from`. Da dieses Paket im Frontend (Renderer Process) via `EncryptedSyncClient` genutzt wird und moderne Bundler (Vite) Node-Polyfills nicht standardmäßig inkludieren, wird dies zur Laufzeit im Browser crashen (`ReferenceError: Buffer is not defined`).
**Datei:** `packages/encryption-layer/src/crypto.ts`
**Vorgeschlagener Fix:**
Verwenden Sie `Uint8Array` und Standard Web-APIs für Base64-Encoding (oder eine isomorphe Library), um die Abhängigkeit von Node.js-Globals zu entfernen.

### 7. Unsichere IV Extraktion (Mittel)
**Problem:** `EncryptedSyncClient` extrahiert den IV mittels `slice(0, 16)` aus dem Base64-String. Dies verlässt sich implizit darauf, dass der IV genau 12 Bytes lang ist und die Base64-Grenzen perfekt alignieren. Änderungen an der Serialisierung führen zu schwer debuggbaren Fehlern.
**Datei:** `apps/desktop/src/lib/sync/encrypted-sync-client.ts`
**Vorgeschlagener Fix:**
Nutzen Sie `deserializeEncrypted` aus dem Encryption-Layer, um die Komponenten sauber zu trennen.

### 8. Race Condition bei Refunds (Mittel)
**Problem:** `applyRefundEvent` lädt einen Record, modifiziert ihn im Speicher und schreibt ihn zurück. Parallele Webhooks von Stripe können zu Race Conditions führen, bei denen Updates (z.B. parallele Teil-Refunds) überschrieben werden.
**Datei:** `apps/proxy-server/src/services/refund-service.ts`
**Vorgeschlagener Fix:**
Datenbank-Transaktionen oder atomare Update-Operationen verwenden.

### 9. Doppelte Prisma Instanzen (Mittel)
**Problem:** `packages/database` exportiert sowohl ein Singleton als auch eine Factory, die standardmäßig neue Instanzen erzeugt. Die parallele Nutzung von `prisma` (Export) und `getDatabase()` (Funktion) kann zu zwei unabhängigen Instanzen führen, was die Datenbank-Verbindungen unnötig belastet.
**Datei:** `packages/database/src/index.ts`
**Vorgeschlagener Fix:**
Sicherstellen, dass `getDatabase()` das existierende Singleton zurückgibt, anstatt eine neue Instanz zu erzeugen, wenn keine Factory gesetzt ist.
