# Code Review Report

**Status:** 🔴 **CRITICAL ISSUES FOUND**
**Review-Level:** Full
**Empfehlung:** Für Security-Review: @claude

Dieser Pull Request enthält mehrere **kritische Sicherheitslücken** und **schwere Logikfehler**, die vor einem Merge zwingend behoben werden müssen.

---

## 🚨 Kritische Probleme (Blocker)

### 1. Irreversible Recovery Phrase (Datenverlust)
**Schweregrad:** 🔥 Kritisch
**Datei:** `apps/desktop/src/lib/encryption/recovery-phrase.ts`
**Zeilen:** 120-136 (`generateRecoveryPhrase`)

**Problem:**
Die Funktion generiert die Recovery Phrase durch **Hashing** (SHA-256) des Schlüssels.
```typescript
const hash = sha256Sync(key);
// ...
const index = ((hash[i * 2] << 8) | hash[i * 2 + 1]) % WORDLIST.length;
```
Hashing ist eine Einwegfunktion. Es ist mathematisch **unmöglich**, den ursprünglichen `key` aus der generierten Phrase wiederherzustellen. Die "Recovery Phrase" ist somit nutzlos und führt zu sicherem Datenverlust, wenn der Nutzer versucht, sie zur Wiederherstellung zu nutzen.

**Fix:**
Verwende eine reversible Kodierung (z.B. BIP39 Standard), bei der die Entropie (der Schlüssel) direkt in Wörter kodiert wird, nicht dessen Hash.

---

### 2. Unauthentifizierter IDOR im Stripe Portal
**Schweregrad:** 🔥 Kritisch
**Datei:** `apps/proxy-server/src/routes/stripe-portal.ts`
**Zeilen:** 61-125 (`POST /api/stripe/portal`)

**Problem:**
1. Der Endpoint hat **keine Authentifizierung** (kein `createLicenseAuthHook` preHandler).
2. Er akzeptiert `customerId` im Body:
   ```typescript
   const customerId = (request.body as { customerId?: string }).customerId;
   ```
Ein Angreifer kann diesen Endpunkt aufrufen und eine beliebige `customerId` (z.B. erraten oder aus anderen Leaks bekannt) übergeben, um Zugriff auf das Billing-Portal fremder Kunden zu erhalten (Rechnungen einsehen, Zahlungsdaten ändern).

**Fix:**
1. Füge `preHandler: createLicenseAuthHook()` hinzu.
2. Entferne `customerId` aus dem Body.
3. Leite die `stripeCustomerId` serverseitig aus der authentifizierten Lizenz ab (`request.license.stripeCustomerId`).

---

### 3. IDOR in Encrypted Sync (Mandantentrennung ausgehebelt)
**Schweregrad:** 🔥 Kritisch
**Datei:** `apps/proxy-server/src/routes/sync.ts`
**Zeilen:** 172 (`POST /api/sync/encrypted`), 232 (`GET /api/sync/encrypted/pull`)

**Problem:**
Die Endpunkte vertrauen blind dem Client-Header:
```typescript
const tenantId = request.headers['x-tenant-id'] as string | undefined;
```
Ein authentifizierter Nutzer (mit gültiger Lizenz A) kann den Header `x-tenant-id` auf die ID von Mandant B setzen und dessen verschlüsselte Daten lesen oder überschreiben.

**Fix:**
Ignoriere den Header. Leite `tenantId` zwingend aus dem authentifizierten Lizenz-Objekt ab.

---

### 4. Datenkorruption durch "Double Encryption"
**Schweregrad:** 🔴 Hoch
**Datei:** `apps/desktop/src/lib/encryption/field-encryption.ts`
**Zeilen:** 105-115 (`decryptSensitiveFields`)

**Problem:**
Wenn die Entschlüsselung fehlschlägt (catch block), wird der **Ciphertext** (verschlüsselter String) als "Plaintext" zurückgegeben.
```typescript
} catch {
  // If decryption fails... Keep the original value
  (result as DataRecord)[field] = value;
}
```
Wenn der Nutzer diesen Datensatz speichert, verschlüsselt `encryptSensitiveFields` diesen Ciphertext erneut. Das führt zu doppelter Verschlüsselung und langfristiger Datenkorruption.

**Fix:**
Entweder Fehler werfen oder das Feld explizit als "fehlerhaft" markieren. Niemals Ciphertext als Plaintext an die UI/Verarbeitung weitergeben.

---

## ⚠️ Logikfehler & Risiken

### 5. Fragile IV-Extraktion
**Schweregrad:** 🟠 Mittel
**Datei:** `apps/desktop/src/lib/sync/encrypted-sync-client.ts`
**Zeile:** 98
**Problem:** `iv = encryptedContent.slice(0, 16)` verlässt sich darauf, dass der Ciphertext immer mit genau 12 Bytes IV im Base64-Format beginnt. Dies ist eine Implementierungsdetail-Kopplung, die bei Änderungen am Verschlüsselungsformat (z.B. Wechsel zu JSON) stillschweigend bricht.

### 6. Fehlende Typsicherheit im Store
**Schweregrad:** 🟡 Niedrig
**Datei:** `apps/proxy-server/src/routes/stripe.ts`
**Zeilen:** 269-281
**Problem:** Runtime-Checks wie `if ('updateLicenseByStripeCustomerId' in store)` deuten darauf hin, dass die `LicenseStore` Implementierungen (Prisma vs. Mock) inkonsistent sind. Wenn der Store die Methode nicht hat, schlägt der Webhook stillschweigend fehl (nur Log-Warning), was dazu führt, dass gekündigte Abos aktiv bleiben.

---

## Zusammenfassung
Der PR darf in diesem Zustand **nicht gemerged** werden. Die Implementierung der Recovery Phrase und die Sicherheitslücken im Stripe-Portal und Sync-Service machen das System unsicher und führen zu Datenverlust.
