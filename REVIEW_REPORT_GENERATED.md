# Code Review Report

**Review-Level:** Full
**Analyzed Commit:** `a6e62c58de79d0a3c488d8fb63220de1b3a1e74d` (Merge) / `d819c20db4b871335ed7d989de5caf4fbacaefc5` (Feature)

## Zusammenfassung
Der PR führt E2E-Verschlüsselung und Sync-Funktionen ein. Die Analyse bestätigt kritische Mängel, die in `REVIEW_REPORT.md` bereits teilweise dokumentiert wurden, sowie weitere Risiken. Der Code ist in diesem Zustand **nicht produktionsreif**.

**Gesamtbewertung:** ❌ **CHANGES REQUESTED**
**Empfehlung:** Für Security-Review: @claude

---

## 1. Kritische Blocker (High)

### 1.1 Insecure Direct Object Reference (IDOR) in Sync API
**Datei:** `apps/proxy-server/src/routes/sync.ts`
**Zeile:** ~160 (innerhalb `POST /api/sync/encrypted`)

**Problem:**
```typescript
const tenantId = request.headers['x-tenant-id'] as string | undefined;
```
Der Endpunkt vertraut blind dem `x-tenant-id` Header des Clients. Obwohl `createLicenseAuthHook` ausgeführt wird, wird die authentifizierte Lizenz (`request.license`) ignoriert. Ein Angreifer mit einer validen Lizenz kann Daten beliebiger anderer Mandanten überschreiben, indem er deren `tenantId` im Header sendet.

**Vorgeschlagener Fix:**
Die `tenantId` muss zwingend aus dem authentifizierten Kontext stammen:
```typescript
const tenantId = (request as any).license.tenantId; // Oder licenseKey
```

### 1.2 Frontend Crash (Node.js Module im Renderer)
**Datei:** `apps/desktop/src/lib/encryption/recovery-phrase.ts`
**Zeile:** 10

**Problem:**
```typescript
import * as crypto from 'crypto';
```
Diese Datei wird im Frontend/Renderer-Prozess verwendet (z.B. UI zur Anzeige der Recovery Phrase). `crypto` ist ein Node.js-Modul und im Browser/Electron-Renderer standardmäßig nicht verfügbar. Dies führt zu einem sofortigen Absturz der Anwendung ("Module not found" oder Runtime Error).

**Vorgeschlagener Fix:**
Verwendung von Web Crypto API (`window.crypto.subtle`) oder einer Isomorphic Library wie `@noble/hashes`.

### 1.3 Datenverlust bei Server-Neustart
**Datei:** `apps/proxy-server/src/services/encrypted-sync-service.ts`
**Zeile:** 38

**Problem:**
```typescript
const documentStore: Map<string, EncryptedDocument[]> = new Map();
```
Die Speicherung erfolgt ausschließlich im Arbeitsspeicher (In-Memory). Alle synchronisierten Daten gehen bei einem Neustart oder Deployment des Proxy-Servers verloren.

**Vorgeschlagener Fix:**
Implementierung einer persistenten Speicherung (PostgreSQL/Prisma), analog zu `packages/database`.

### 1.4 Test-Regressionen
**Datei:** `test_report.txt` (vom Commit)

**Problem:**
Der PR enthält einen Test-Report mit ~60 fehlgeschlagenen Tests, was auf massive Regressionen hindeutet.

---

## 2. Bugs & Logik-Fehler (Medium)

### 2.1 Fragile IV-Extraktion
**Datei:** `apps/desktop/src/lib/sync/encrypted-sync-client.ts`
**Zeile:** ~95

**Problem:**
```typescript
const iv = encryptedContent.slice(0, 16);
```
Es wird angenommen, dass die ersten 16 Zeichen des Base64-Strings dem IV entsprechen. Dies ist zwar rechnerisch korrekt (12 Bytes IV = 16 Base64-Zeichen), aber extrem fragil gegenüber Formatänderungen und semantisch unsauber.

**Vorgeschlagener Fix:**
Korrekte Deserialisierung des verschlüsselten Strings (Base64 decode -> split -> use bytes).

### 2.2 Privacy Leakage bei Embeddings
**Datei:** `apps/desktop/src/lib/sync/encrypted-sync-client.ts`

**Problem:**
Embeddings (Vektor-Repräsentationen von Rechnungsdaten) werden **unverschlüsselt** an den Server gesendet (`embedding` Feld im Payload). Da Embeddings semantische Informationen enthalten, verletzt dies das Zero-Knowledge-Versprechen. Ein Angreifer mit Server-Zugriff könnte Rückschlüsse auf die Inhalte ziehen.

**Vorgeschlagener Fix:**
Embeddings sollten Client-seitig verschlüsselt werden oder (wenn für serverseitige Suche benötigt) muss das Privacy-Risiko explizit akzeptiert und dokumentiert werden.

---

## 3. Potenzielle Runtime-Exceptions & Edge Cases (Low)

### 3.1 Aggressive Entschlüsselung
**Datei:** `apps/desktop/src/lib/encryption/field-encryption.ts`

**Problem:**
`decryptSensitiveFields` versucht, *jeden* String in sensitiven Feldern zu entschlüsseln. Bei Legacy-Daten (Klartext) verlässt sich der Code auf `try/catch`. Dies ist ineffizient und kann bei (unwahrscheinlichen) Kollisionen zu Datenkorruption führen.

**Vorgeschlagener Fix:**
Vorherige Prüfung mit `isEncrypted()` (Check auf Base64 & Länge/Präfix).
