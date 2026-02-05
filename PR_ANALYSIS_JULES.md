# PR Analyse Report

**Review-Level:** Full
**Status:** 🔴 KRITISCH
**Security-Review:** @claude

Dieser Report fasst die Ergebnisse der Analyse von Commit `64926b7` zusammen.

## 1. Kritische Bugs & Sicherheitslücken (Blocker)

### 1.1. Irreversible Recovery Phrase (Datenverlust)
- **Datei:** `apps/desktop/src/lib/encryption/recovery-phrase.ts`
- **Zeilen:** 120-136
- **Problem:** Die Recovery Phrase wird aus dem Hash des Schlüssels generiert (`sha256Sync(key)`). Dies ist eine Einwegfunktion. Der ursprüngliche Schlüssel kann aus der Phrase **nicht** wiederhergestellt werden. Ein Backup ist damit nutzlos.
- **Fix:** Entfernen des Hashing-Schritts. Die Entropie (der Schlüssel selbst) muss direkt kodiert werden (BIP39 Standard).

### 1.2. IDOR im Stripe Portal (Unautorisierter Zugriff)
- **Datei:** `apps/proxy-server/src/routes/stripe-portal.ts`
- **Zeilen:** Handler für `POST /api/stripe/portal`
- **Problem:** Der Endpunkt akzeptiert `customerId` aus dem Request-Body ohne Prüfung, ob dieser zum authentifizierten Nutzer gehört. Ein Angreifer kann beliebige Stripe-Portale öffnen.
- **Fix:** `customerId` aus dem authentifizierten Lizenz-Objekt (`request.license`) ableiten. `createLicenseAuthHook` verwenden.

### 1.3. IDOR in Encrypted Sync (Datenleck)
- **Datei:** `apps/proxy-server/src/routes/sync.ts`
- **Zeilen:** Handler für `/api/sync/encrypted`
- **Problem:** Der Endpunkt vertraut dem `x-tenant-id` Header. Ein Angreifer kann diesen Header manipulieren, um Daten anderer Mandanten zu lesen oder zu überschreiben.
- **Fix:** `tenantId` serverseitig aus dem Lizenz-Token ableiten. Header ignorieren.

## 2. Hohe Priorität (Logik & Datenintegrität)

### 2.1. Double Encryption (Datenkorruption)
- **Datei:** `apps/desktop/src/lib/encryption/field-encryption.ts`
- **Zeilen:** 105-115 (`decryptSensitiveFields`)
- **Problem:** Wenn `decryptField` fehlschlägt, wird der Ciphertext als "Klartext" zurückgegeben. Beim nächsten Speichern wird dieser erneut verschlüsselt. Dies führt zu dauerhafter Datenkorruption.
- **Fix:** Fehler werfen oder Feldstatus markieren, aber **niemals** Ciphertext als Value zurückgeben.

### 2.2. Lückenhafte Migrationslogik
- **Datei:** `apps/desktop/src/lib/migration/encrypt-existing-data.ts`
- **Zeilen:** 88-95, 122-126
- **Problem:** Die Migration prüft nur das erste Feld (z.B. `name` bei Customer). Ist dieses `null`, werden andere Felder (z.B. `email`, `phone`) nicht verschlüsselt, selbst wenn sie Daten enthalten.
- **Fix:** Prüfen, ob *irgendein* zu verschlüsselndes Feld unverschlüsselte Daten enthält.

## 3. Mittlere Priorität (Runtime & Edge Cases)

### 3.1. Browser-Inkompatibilität (`Buffer`)
- **Datei:** `packages/encryption-layer/src/crypto.ts`
- **Problem:** Nutzung von `Buffer.from` führt zu Crashes in Browser-Umgebungen (Vite/Renderer), da Node.js Polyfills fehlen.
- **Fix:** Nutzung von `Uint8Array` und Standard Web APIs (TextEncoder/Decoder).

### 3.2. Fehlerhafte Duplikaterkennung im Banking
- **Datei:** `apps/desktop/electron/ipc/banking-handlers.ts`
- **Problem:** Transaktionen werden als Duplikate verworfen, wenn Datum, Betrag und Gegenpartei identisch sind. Dies ist in der Realität (z.B. zwei gleiche Kaffee-Käufe am selben Tag) möglich und valide.
- **Fix:** Einbeziehen einer eindeutigen Transaktions-ID (wenn verfügbar) oder Hash über *alle* Felder inkl. Verwendungszweck.

### 3.3. Race Condition im Banking Import
- **Datei:** `apps/desktop/electron/ipc/banking-handlers.ts`
- **Problem:** `findFirst` gefolgt von `create` ist nicht atomar. Bei gleichzeitigem Import kann es zu Race Conditions kommen.
- **Fix:** Unique Constraints in der Datenbank nutzen und `upsert` verwenden.
