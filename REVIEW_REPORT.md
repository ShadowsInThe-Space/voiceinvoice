# Review Report: PR Analysis (Merge 592fba86)

## Übersicht
Dieser Report analysiert den Pull Request (Merge 592fba86) auf Bugs, Logic-Fehler, Runtime-Exceptions und nicht behandelte Edge Cases.
**Review-Level:** Full
**Status:** KRITISCH - Mehrere schwerwiegende Sicherheitslücken und Datenverlust-Risiken gefunden.

---

## Gefundene Probleme

### 1. KRITISCH: Unauthentifizierter IDOR im Stripe Portal (Security)
**Schweregrad:** Kritisch (Blocker)
**Betroffene Dateien:**
- `apps/proxy-server/src/routes/stripe-portal.ts` (Zeilen 61-125)

**Problem:**
1. Dem Endpunkt `POST /api/stripe/portal` fehlt der `preHandler: createLicenseAuthHook()`. Er ist öffentlich zugänglich.
2. Er akzeptiert `customerId` direkt aus dem Request-Body.
Ein Angreifer kann ohne Authentifizierung das Stripe-Billing-Portal für beliebige Kunden öffnen (IDOR).

**Vorgeschlagener Fix:**
Fügen Sie Authentifizierung hinzu und leiten Sie die `customerId` aus der Lizenz ab.

### 2. KRITISCH: IDOR-Schwachstelle in Sync-Endpunkten (Security)
**Schweregrad:** Kritisch
**Betroffene Dateien:**
- `apps/proxy-server/src/routes/sync.ts` (Zeilen 130-137, 190-197)

**Problem:**
Die Endpunkte `POST /api/sync/encrypted` und `GET /api/sync/encrypted/pull` vertrauen blind dem `x-tenant-id` Header. Ein Angreifer kann Daten anderer Mandanten lesen oder überschreiben.

**Vorgeschlagener Fix:**
Die `tenantId` muss zwingend aus dem authentifizierten Lizenz-Token abgeleitet werden.

### 3. KRITISCH: Datenverlust durch In-Memory Storage (Data Integrity)
**Schweregrad:** Kritisch
**Betroffene Dateien:**
- `apps/proxy-server/src/services/encrypted-sync-service.ts` (Zeile 45)

**Problem:**
Der Service verwendet eine `Map` (`documentStore`) zur Speicherung. Alle synchronisierten Daten gehen bei einem Server-Neustart verloren.

**Vorgeschlagener Fix:**
Ersetzen durch persistente Datenbank (PostgreSQL/Supabase).

### 4. KRITISCH: Irreversible Recovery Phrase (Logic)
**Schweregrad:** Kritisch
**Betroffene Dateien:**
- `apps/desktop/src/lib/encryption/recovery-phrase.ts` (Zeilen 120-130)

**Problem:**
Die Funktion `generateRecoveryPhrase` hasht den Schlüssel mit SHA-256. Hashes sind irreversibel, die Recovery Phrase ist somit nutzlos.

**Vorgeschlagener Fix:**
BIP-39 Standard korrekt implementieren (Entropie kodieren, nicht hashen).

### 5. KRITISCH: Silent Decryption Failure / Double Encryption (Data Corruption)
**Schweregrad:** Kritisch
**Betroffene Dateien:**
- `apps/desktop/src/lib/encryption/field-encryption.ts` (Zeilen 109-116)

**Problem:**
Bei Entschlüsselungsfehlern wird der Ciphertext zurückgegeben. Beim nächsten Speichern wird dieser erneut verschlüsselt (Double Encryption).

**Vorgeschlagener Fix:**
Fail-Fast-Prinzip anwenden (Error werfen) oder speziellen Fehlerwert zurückgeben.

### 6. HOCH: Runtime Crash in Node.js Environments (Runtime Exception)
**Schweregrad:** Hoch
**Betroffene Dateien:**
- `apps/desktop/src/lib/encryption/encryption-context.ts` (Zeilen 26-28)

**Problem:**
Globaler Zugriff auf `localStorage` führt in Node.js (Electron Main, Tests) zum Absturz (`ReferenceError`).

**Vorgeschlagener Fix:**
Environment-Check hinzufügen (`typeof window !== 'undefined'`).

### 7. HOCH: Runtime Fehler im Browser (Runtime Exception)
**Schweregrad:** Hoch
**Betroffene Dateien:**
- `packages/encryption-layer/src/crypto.ts`

**Problem:**
Verwendung von `Buffer.from`. `Buffer` ist nicht standardmäßig im Browser verfügbar.

**Vorgeschlagener Fix:**
Verwendung von `Uint8Array` und nativen APIs.

### 8. MITTEL: Ineffiziente Anonymisierung (Performance)
**Schweregrad:** Mittel
**Betroffene Dateien:**
- `packages/privacy-engine/src/anonymizer.ts`

**Problem:**
Brute-Force O(N*M) Algorithmus für Anonymisierung.

**Vorgeschlagener Fix:**
Optimierte Algorithmen (Aho-Corasick) nutzen.

---

## Empfehlung

**Für Security-Review: @claude**
