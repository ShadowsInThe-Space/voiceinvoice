# PR Analyse Report

**Status:** 🔴 **KRITISCH - NICHT MERGEN**
**Review-Level:** Full
**Empfehlung:** Für Security-Review: @claude

Dieser Pull Request enthält schwerwiegende Sicherheitslücken und Logikfehler, die zu Datenverlust und unautorisiertem Zugriff führen können.

---

## 🚨 Kritische Probleme (Severity: Critical)

### 1. Irreversible Recovery Phrase (Datenverlust)
**Datei:** `apps/desktop/src/lib/encryption/recovery-phrase.ts`
**Betroffene Zeilen:** 120-136 (`generateRecoveryPhrase`)

**Problem:**
Die Funktion generiert die Recovery Phrase durch Hashing (`sha256Sync`) des ursprünglichen Schlüssels.
```typescript
const hash = sha256Sync(key);
// ... Wörter werden aus dem Hash generiert
```
Da Hashing eine Einwegfunktion ist, kann der ursprüngliche Schlüssel **niemals** aus der Recovery Phrase wiederhergestellt werden. Dies macht das Backup nutzlos und führt zu sicherem Datenverlust im Wiederherstellungsfall.

**Fix:**
Verwenden Sie eine reversible Kodierung (z.B. BIP39), bei der die Entropie (der Schlüssel selbst) direkt in Wörter umgewandelt wird, nicht dessen Hash.

### 2. IDOR im Stripe Portal Endpoint
**Datei:** `apps/proxy-server/src/routes/stripe-portal.ts`
**Betroffene Zeilen:** `POST /api/stripe/portal` Handler

**Problem:**
Der Endpunkt ist ungeschützt (kein `createLicenseAuthHook` preHandler) und akzeptiert die `customerId` direkt aus dem Request-Body ohne Validierung.
```typescript
const customerId = (request.body as { customerId?: string }).customerId;
```
Ein Angreifer kann Sessions für beliebige Stripe-Kunden erstellen und deren Rechnungsdaten einsehen.

**Fix:**
1. Fügen Sie `preHandler: createLicenseAuthHook()` hinzu.
2. Entfernen Sie `customerId` aus dem Body.
3. Verwenden Sie `request.license.stripeCustomerId` aus dem authentifizierten Lizenz-Objekt.

### 3. IDOR in Encrypted Sync (Mandantentrennung)
**Datei:** `apps/proxy-server/src/routes/sync.ts`
**Betroffene Zeilen:** `POST /api/sync/encrypted`, `GET /api/sync/encrypted/pull`

**Problem:**
Die Endpunkte vertrauen dem vom Client gesendeten `x-tenant-id` Header.
```typescript
const tenantId = request.headers['x-tenant-id'] as string | undefined;
```
Authentifizierte Nutzer können durch Ändern dieses Headers auf die verschlüsselten Daten anderer Mandanten zugreifen oder diese überschreiben.

**Fix:**
Ignorieren Sie den Header. Leiten Sie die `tenantId` zwingend serverseitig aus der authentifizierten Lizenz ab.

---

## 🔴 Hohe Priorität (Severity: High)

### 4. Datenkorruption durch "Double Encryption"
**Datei:** `apps/desktop/src/lib/encryption/field-encryption.ts`
**Betroffene Zeilen:** 105-115 (`decryptSensitiveFields`)

**Problem:**
Wenn die Entschlüsselung fehlschlägt, wird der verschlüsselte Text (Ciphertext) als "Klartext" zurückgegeben.
```typescript
} catch {
  (result as DataRecord)[field] = value; // Ciphertext wird zurückgegeben
}
```
Beim nächsten Speichern wird dieser Ciphertext erneut verschlüsselt ("Double Encryption"). Dies führt zu Datenkorruption, da der ursprüngliche Inhalt nicht mehr (oder nur sehr schwer) wiederherstellbar ist.

**Fix:**
Werfen Sie einen Fehler oder markieren Sie das Feld als ungültig, aber geben Sie niemals Ciphertext als validen Wert an die Applikation zurück.

---

## ⚠️ Runtime Exceptions (Severity: Medium)

### 5. Node.js `Buffer` im Browser-Kontext
**Datei:** `packages/encryption-layer/src/crypto.ts`
**Betroffene Zeilen:** 93, 114 (`Buffer.from`)

**Problem:**
Das Modul verwendet `Buffer.from`, was eine Node.js-spezifische API ist. Da `packages/encryption-layer` auch im Frontend (Browser/Electron Renderer) genutzt wird (wo keine Node.js Polyfills vorhanden sind), führt dies zu Runtime-Crashes (`ReferenceError: Buffer is not defined`).

**Fix:**
Verwenden Sie `Uint8Array` und Standard-Web-APIs (z.B. base64-js oder Browser-native Base64-Konvertierung) statt `Buffer`.

### 6. Fragile IV-Extraktion
**Datei:** `apps/desktop/src/lib/sync/encrypted-sync-client.ts`
**Betroffene Zeilen:** `pushEncrypted` Methode

**Problem:**
Die Extraktion des Initialisierungsvektors (IV) verlässt sich auf feste String-Indizes (`slice(0, 16)`), basierend auf der Annahme, dass der IV immer 12 Bytes lang ist und am Anfang steht.
```typescript
const iv = encryptedContent.slice(0, 16);
```
Änderungen an der Verschlüsselungsimplementierung können diesen Code brechen.

**Fix:**
Die Verschlüsselungsfunktion sollte IV und Ciphertext strukturiert zurückgeben (z.B. als Objekt), anstatt dass der Client das Format parsen muss.

---

## Zusammenfassung
Dieser PR darf aufgrund der kritischen Sicherheitsmängel (Datenverlust-Garantie bei Recovery, IDORs) **nicht** gemerged werden. Eine umfassende Überarbeitung der Sicherheitsarchitektur in den betroffenen Modulen ist notwendig.
