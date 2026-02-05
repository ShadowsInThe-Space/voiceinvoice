# PR Analyse Report

**Review-Level:** Full
**Commit:** 70dcd486b866d76200562fbae526fdd8dd15d02f
**Status:** 🚨 KRITISCHE PROBLEME GEFUNDEN

⚠️ **EMPFEHLUNG:** Für Security-Review: @claude

---

## 🚨 KRITISCH (Critical) - Sofortige Handlung erforderlich

### 1. Unbrauchbare Recovery Phrase Generierung (Security/Logic)
**Datei:** `apps/desktop/src/lib/encryption/recovery-phrase.ts`
**Zeilen:** 12-25, 96-107
**Problem:** Die Funktion `generateRecoveryPhrase` verwendet einen einfachen SHA-256 Hash des Keys, um die Wörter auszuwählen. Dies ist eine **Einweg-Funktion**. Es ist mathematisch unmöglich, den ursprünglichen 32-Byte Key aus den 12 Wörtern wiederherzustellen. Die generierte Recovery Phrase ist funktionslos.
**Vorgeschlagener Fix:** Implementieren Sie BIP-39 korrekt (Mnemonic -> Seed -> Key) oder kodieren Sie den Key direkt umkehrbar (z.B. Base-2048 Kodierung des Keys selbst + Checksumme), sodass der Key aus den Wörtern rekonstruiert werden kann.

### 2. IDOR Schwachstelle im Stripe Portal (Security)
**Datei:** `apps/proxy-server/src/routes/stripe-portal.ts`
**Zeilen:** 60-65
**Problem:** Der Endpunkt `POST /api/stripe/portal` liest die `customerId` direkt aus dem Request-Body (`request.body.customerId`) ohne zu prüfen, ob diese zum authentifizierten Benutzer gehört. Ein Angreifer kann eine beliebige `customerId` übergeben und Zugriff auf das Billing-Portal anderer Kunden erhalten.
**Vorgeschlagener Fix:** Extrahieren Sie die `customerId` aus dem authentifizierten Lizenz-Token (`request.license.stripeCustomerId`) oder validieren Sie strikt, dass die übergebene ID zur Lizenz gehört.

### 3. IDOR Schwachstelle in Encrypted Sync (Security)
**Datei:** `apps/proxy-server/src/routes/sync.ts` (und `encrypted-sync-service.ts`)
**Zeilen:** 152, 185 (sync.ts)
**Problem:** Die Endpunkte `/api/sync/encrypted` (POST und GET) vertrauen blind dem `x-tenant-id` Header, der vom Client gesendet wird. Obwohl eine Lizenz-Authentifizierung stattfindet (`createLicenseAuthHook`), wird nicht geprüft, ob der `x-tenant-id` zur Lizenz gehört. Ein valider User kann Daten beliebiger anderer Tenants lesen/schreiben.
**Vorgeschlagener Fix:** Der `tenantId` muss serverseitig aus dem Lizenz-Key abgeleitet werden (z.B. Hash) und darf nicht vom Client bestimmt werden.

---

## 🔴 HOCH (High) - Potenzieller Datenverlust oder schwere Fehler

### 4. Datenverlust durch In-Memory Storage
**Datei:** `apps/proxy-server/src/services/encrypted-sync-service.ts`
**Zeilen:** 38
**Problem:** `const documentStore: Map<string, EncryptedDocument[]> = new Map();`
Der Sync-Service speichert alle verschlüsselten Dokumente nur im Arbeitsspeicher (RAM). Bei jedem Neustart des Servers gehen alle synchronisierten Daten unwiderruflich verloren.
**Vorgeschlagener Fix:** Ersetzen Sie die `Map` durch eine persistente Datenbank (PostgreSQL/Prisma oder Supabase Integration).

### 5. Fehlerhafte Deanonymisierung (Datenintegrität)
**Datei:** `apps/desktop/src/lib/pipeline/voice-invoice-pipeline.ts`
**Zeile:** 215 (Methode `deanonymizeInvoice`)
**Problem:** Die Methode `deanonymizeInvoice` stellt `customerEmail` nicht wieder her. Wenn die KI einen Platzhalter wie `[EMAIL_1]` extrahiert, wird dieser permanent in der Datenbank gespeichert. Dies führt dazu, dass neue Kunden mit ungültigen E-Mail-Adressen angelegt werden.
**Vorgeschlagener Fix:** Fügen Sie `result.customerEmail = deanonymize(result.customerEmail, tokenMap);` hinzu.

### 6. Unvollständige Anonymisierung (Privacy)
**Datei:** `apps/desktop/src/lib/pipeline/voice-invoice-pipeline.ts`
**Zeile:** 288 (`createInvoiceFromParsed`)
**Problem:** Beim Speichern der Rechnung wird `anonymize(transcription, { strategy: 'redact' })` aufgerufen, ohne die `knownEntities` (Kundennamen) zu übergeben. Namen, die nicht durch generische Muster erkannt werden, bleiben im Klartext in der Datenbank stehen, obwohl sie vorher für die KI maskiert wurden.
**Vorgeschlagener Fix:** Übergeben Sie die Liste der bekannten Entitäten an die `anonymize` Funktion: `anonymize(transcription, knownEntities, { strategy: 'redact' })`.

### 7. Fehlerhafte Migrations-Logik (Datenintegrität)
**Datei:** `apps/desktop/src/lib/migration/encrypt-existing-data.ts`
**Zeilen:** 78, 105
**Problem:** Die Migration überspringt Datensätze komplett, wenn das Hauptfeld (z.B. `name` bei Customer) null oder leer ist. Andere sensible Felder (Email, Telefon, TaxID) werden in diesem Fall **nicht** verschlüsselt und bleiben im Klartext liegen.
**Vorgeschlagener Fix:** Die Bedingung muss prüfen, ob *irgendein* sensibles Feld unverschlüsselt ist, nicht nur das Hauptfeld.

---

## 🟡 MITTEL (Medium) - Runtime Exceptions und Code Quality

### 8. Runtime Exception im Frontend (Browser-Kompatibilität)
**Datei:** `packages/encryption-layer/src/crypto.ts`
**Zeilen:** 105, 120
**Problem:** Die Verwendung von `Buffer.from()` führt in Browser-Umgebungen (Electron Renderer, React) zu Abstürzen, da `Buffer` eine Node.js-spezifische API ist und von Vite standardmäßig nicht polyfilled wird.
**Vorgeschlagener Fix:** Verwenden Sie `Uint8Array` und Standard-Web-APIs (`atob`/`btoa`) oder eine Bibliothek wie `base64-js`.

### 9. Fragile Base64 Verarbeitung
**Datei:** `apps/desktop/src/lib/sync/encrypted-sync-client.ts`
**Zeile:** 114
**Problem:** `const iv = encryptedContent.slice(0, 16);`
Das Extrahieren des IV durch String-Slicing eines Base64-Strings ist extrem fehleranfällig. Es verlässt sich implizit darauf, dass 12 Bytes genau 16 Base64-Zeichen entsprechen und keine Padding/Formatierungsprobleme auftreten.
**Vorgeschlagener Fix:** Dekodieren Sie den Base64-String in ein `Uint8Array`, extrahieren Sie die Bytes sauber und kodieren Sie bei Bedarf neu.

### 10. Doppelte Verschlüsselung (Logic)
**Datei:** `apps/desktop/src/lib/encryption/field-encryption.ts`
**Problem:** Es fehlt eine robuste Prüfung, ob ein Wert bereits verschlüsselt ist, bevor `encryptSensitiveFields` angewendet wird (außerhalb der Migration). Wenn ein bereits verschlüsseltes Objekt erneut gespeichert wird, kann es zu "Double Encryption" kommen, was die Daten unlesbar macht (Decryption liefert dann den inneren Ciphertext).
**Vorgeschlagener Fix:** Implementieren Sie eine strikte Typprüfung oder Metadaten-Tracking, um sicherzustellen, dass Ciphertext nicht erneut als Plaintext behandelt wird.

---
**Generiert von:** Jules (AI Code Reviewer)
**Datum:** 05.02.2026
