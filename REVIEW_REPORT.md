# Code Review Report: PR Merge be6ca34

Basierend auf der Analyse des Merges (Commit `be6ca34`) wurden folgende kritische Fehler, Logic-Bugs und Runtime-Risiken identifiziert.

**Zusammenfassung:**
Der Pull Request führt kritische Sicherheitslücken (IDOR, XSS), schwerwiegende Logikfehler in der Verschlüsselung (unbrauchbare Recovery Phrase) und Runtime-Abstürze ein. Ein sofortiges Fixen ist erforderlich.

**Empfehlung:** Für Security-Review: @claude

---

## 1. Kritische Fehler (Critical)

### 1.1. Insecure Direct Object Reference (IDOR) in Sync-Routes
*   **Schweregrad:** Kritisch 🔴
*   **Ort:** `apps/proxy-server/src/routes/sync.ts` (Zeilen 171, 230)
*   **Problem:** Die Endpunkte `/api/sync/encrypted` (Push) und `/api/sync/encrypted/pull` vertrauen blind dem `x-tenant-id` Header. Obwohl eine Lizenzprüfung stattfindet (`createLicenseAuthHook`), wird **nicht** geprüft, ob der angegebene Tenant zur Lizenz gehört.
*   **Folge:** Jeder Benutzer mit einer beliebigen gültigen Lizenz kann Daten **jedes anderen Tenants** lesen (Pull) oder überschreiben (Push). Kompletter Datenverlust/Leak möglich.
*   **Fix:** In `sync.ts` prüfen, ob `x-tenant-id` mit der aus der Lizenz abgeleiteten ID übereinstimmt. Dazu muss `createLicenseAuthHook` die Tenant-ID korrekt ableiten (siehe 3.1).

### 1.2. Broken Recovery Phrase Implementation (Fake Security)
*   **Schweregrad:** Kritisch 🔴
*   **Ort:** `apps/desktop/src/lib/encryption/recovery-phrase.ts`
*   **Problem:** Die Funktion `generateRecoveryPhrase(key)` generiert Wörter basierend auf einem SHA-256 Hash des Keys. Es handelt sich um eine **Einweg-Funktion**. Es gibt keine Möglichkeit (und keine Funktion), den Key aus der Phrase wiederherzustellen.
*   **Folge:** Benutzer, die sich auf diese Recovery Phrase verlassen, erleiden bei Verlust des Geräts **unwiederbringlichen Datenverlust**, da die Phrase den Key nicht enthält.
*   **Fix:** Implementierung durch Standard-BIP39 ersetzen (Entropy -> Mnemonic -> Seed -> Key) oder (falls Key = derived) die Phrase aus dem `deviceId` (Seed) generieren, nicht aus dem Hash des Keys.

### 1.3. Runtime Crash (Node.js/Electron Main)
*   **Schweregrad:** Kritisch 🔴
*   **Ort:** `apps/desktop/src/lib/encryption/encryption-context.ts` (Funktion `getDeviceId`)
*   **Problem:** Direkter Zugriff auf `localStorage` im Top-Level-Scope bzw. bei Initialisierung.
*   **Folge:** Wenn dieser Code im Electron Main Process (Server-Side) oder beim Next.js SSR importiert wird, stürzt die App mit `ReferenceError: localStorage is not defined` ab.
*   **Fix:** Zugriff kapseln: `if (typeof window !== 'undefined') { ... }` oder einen abstrakten Storage-Provider injizieren.

---

## 2. Hohes Risiko (High)

### 2.1. Stored XSS via Email Injection
*   **Schweregrad:** Hoch 🟠
*   **Ort:** `apps/proxy-server/src/services/email-service.ts` (Funktion `buildLicenseEmail`)
*   **Problem:** Die Funktion baut HTML-Strings durch Verkettung zusammen und injiziert `plan.name` und `plan.monthlyQuota` ungeprüft.
*   **Folge:** Wenn ein Plan-Name bösartige Skripte enthält (z.B. `<script>`), werden diese im E-Mail-Client des Opfers ausgeführt (Stored XSS).
*   **Fix:** HTML-Escaping für alle variablen Inputs verwenden oder eine Template-Engine einsetzen.

### 2.2. Silent Decryption Failure (Data Corruption)
*   **Schweregrad:** Hoch 🟠
*   **Ort:** `apps/desktop/src/lib/encryption/field-encryption.ts` (Funktion `decryptSensitiveFields`)
*   **Problem:** Wenn `decryptField` fehlschlägt (z.B. falscher Key), wird der Fehler gefangen und der *Ciphertext* als Plaintext zurückgegeben.
*   **Folge:** Die UI zeigt "verschlüsselten Salat" an. Speichert der User diesen Datensatz, wird der Ciphertext erneut verschlüsselt (Double Encryption). Datenkorruption.
*   **Fix:** Prüfung mit `isEncrypted(value)` einbauen. Wenn es wie Ciphertext aussieht, aber Decrypt fehlschlägt -> Fehler werfen oder UI-Warnung, keinesfalls Raw-String zurückgeben.

### 2.3. Data Loss on Restart (In-Memory Storage)
*   **Schweregrad:** Hoch 🟠
*   **Ort:** `apps/proxy-server/src/services/encrypted-sync-service.ts`
*   **Problem:** `documentStore` ist eine `Map<string, ...>`.
*   **Folge:** Alle synchronisierten Daten liegen nur im RAM und sind nach einem Server-Neustart verloren.
*   **Fix:** Anbindung an PostgreSQL/Prisma implementieren.

---

## 3. Logik-Fehler & Edge Cases (Medium)

### 3.1. Tenant ID Mismatch
*   **Schweregrad:** Mittel 🟡
*   **Ort:** `apps/proxy-server/src/routes/license.ts`
*   **Problem:** `createLicenseAuthHook` setzt `tenantId = licenseKey`. Der `sync`-Service erwartet aber (vermutlich) eine abgeleitete ID (`deriveTenantId(licenseKey)`).
*   **Folge:** Selbst wenn der IDOR-Fix (1.1) implementiert wird, schlägt die Validierung fehl, da Header (derived ID) und License-Objekt (raw License Key) nicht übereinstimmen.
*   **Fix:** In `createLicenseAuthHook` die Funktion `deriveTenantId` aus `@voiceinvoice/encryption-layer` verwenden.

---

**Status:** Der PR sollte in diesem Zustand **nicht** in Produktion gehen. Ein Revert oder sofortiger Hotfix-Branch ist notwendig.
