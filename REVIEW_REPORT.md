# Code Review Report

**Review-Level:** Full
**Analyzed Commit:** `df8a66ba79f22c511209665f39bd6dcfa0b720a4` (Merge)

## Zusammenfassung
Der PR führt umfassende E2E-Verschlüsselungsfunktionen ein. Es wurden jedoch **kritische Blocker** gefunden, die einen Merge unmöglich machen.
Dazu gehören massive Test-Regressionen (60 fehlschlagende Tests), kritische Sicherheitslücken (IDOR), Runtime-Crashes im Frontend (Node-Module) und Datenverlustrisiken (In-Memory Storage).

**Gesamtbewertung:** ❌ **REJECTED** (Blocking Issues)
**Empfehlung:** Für Security-Review: @claude

---

## 1. Kritische Blocker (High)

### 1.1 Insecure Direct Object Reference (IDOR) in Sync API
**Datei:** `apps/proxy-server/src/routes/sync.ts`
**Zeile:** ~160

**Beschreibung:**
Der Server vertraut dem vom Client gesendeten Header `x-tenant-id` ungeprüft:
```typescript
const tenantId = request.headers['x-tenant-id'] as string | undefined;
```
Ein Angreifer mit einer gültigen Lizenz kann beliebige Tenant-IDs senden und so Daten anderer Mandanten lesen oder überschreiben.

**Fix:**
Die `tenantId` muss zwingend aus dem authentifizierten Lizenzkontext (`request.license`) abgeleitet oder validiert werden. Niemals dem Client-Header vertrauen.

### 1.2 Frontend Crash durch Node.js Module
**Datei:** `apps/desktop/src/lib/encryption/recovery-phrase.ts`
**Zeile:** 10

**Beschreibung:**
```typescript
import * as crypto from 'crypto';
```
Das Node.js `crypto`-Modul wird in einer Datei importiert, die Teil des Desktop-Renderers (React) ist. Dies führt zu Runtime-Fehlern im Browser/Electron-Renderer, da Node-Builtins dort nicht verfügbar sind.

**Fix:**
Verwenden Sie `@noble/hashes` (bereits im Projekt vorhanden) oder `window.crypto.subtle`.

### 1.3 Datenverlust (In-Memory Storage)
**Datei:** `apps/proxy-server/src/services/encrypted-sync-service.ts`
**Zeile:** 38

**Beschreibung:**
Der Server speichert synchronisierte Daten nur im RAM (`new Map()`).
```typescript
const documentStore: Map<string, EncryptedDocument[]> = new Map();
```
Bei einem Neustart des Servers gehen alle synchronisierten Daten verloren.

**Fix:**
Implementierung muss auf Datenbank (PostgreSQL/Supabase) umgestellt werden.

### 1.4 Test-Regressionen
**Datei:** `test_report.txt`

**Beschreibung:**
60 Tests schlagen fehl, insbesondere in kritischen UI-Komponenten (`Dashboard`, `Settings`, `InvoiceList`). Dies deutet auf inkompatible Änderungen an Mocks oder Abhängigkeiten hin.

---

## 2. Logik-Fehler & Bugs (Medium)

### Falsche IV-Extraktion
**Datei:** `apps/desktop/src/lib/sync/encrypted-sync-client.ts`
**Zeile:** ~95

**Beschreibung:**
Der IV wird durch `slice(0, 16)` aus dem Base64-String extrahiert. Dies ist fragil und semantisch unsauber.

**Fix:**
Nutzen Sie `deserializeEncrypted` für korrekte Byte-Separation.

### RLS "Development Backdoor"
**Datei:** `supabase/migrations/003_fix_rls_jwt_validation.sql`

**Beschreibung:**
Die Migration enthält Logik, die Security-Checks überspringt, wenn keine JWT-Claims vorhanden sind. Dies ist in Production hochriskant.

**Fix:**
Backdoor entfernen oder strikt an Env-Vars binden.

---

## 3. Potenzielle Runtime-Exceptions (Medium)

### Aggressives Entschlüsseln ohne Prüfung
**Datei:** `apps/desktop/src/lib/encryption/field-encryption.ts`

**Beschreibung:**
`decryptSensitiveFields` versucht blind, alles zu entschlüsseln. Dies ist ineffizient und riskant bei zufälligen Datenkollisionen.

**Fix:**
Guard-Clause mit `isEncrypted()` einbauen.

---

## 4. Datenschutz-Bedenken (Low)

### Leakage von Embeddings
**Datei:** `apps/desktop/src/lib/sync/encrypted-sync-client.ts`

**Beschreibung:**
Embeddings werden unverschlüsselt gesendet. Dies schwächt das Zero-Knowledge-Konzept.
