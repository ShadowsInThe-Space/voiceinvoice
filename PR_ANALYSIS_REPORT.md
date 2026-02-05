# PR Analyse Report

**Review-Level:** Full
**Status:** 🚨 KRITISCHE PROBLEME GEFUNDEN

⚠️ **EMPFEHLUNG:** Für Security-Review: @claude

---

## 🚨 KRITISCH (Critical) - Sofortige Handlung erforderlich

### 1. Unbrauchbare Recovery Phrase Generierung (Security/Logic)
**Datei:** `apps/desktop/src/lib/encryption/recovery-phrase.ts`
**Zeilen:** 12-25, 96-107
**Problem:** Die Funktion `generateRecoveryPhrase` verwendet einen einfachen SHA-256 Hash des Keys, um die Wörter auszuwählen. Dies ist eine **Einweg-Funktion**. Es ist mathematisch unmöglich, den ursprünglichen 32-Byte Key aus den 12 Wörtern wiederherzustellen. Die generierte Recovery Phrase ist funktionslos.
**Vorgeschlagener Fix:** Implementieren Sie BIP-39 korrekt (Mnemonic -> Seed -> Key) oder kodieren Sie den Key direkt umkehrbar (z.B. Base-2048 Kodierung des Keys selbst + Checksumme).

### 2. IDOR Schwachstelle im Stripe Portal (Security)
**Datei:** `apps/proxy-server/src/routes/stripe-portal.ts`
**Zeilen:** 60-65
**Problem:** Der Endpunkt `POST /api/stripe/portal/session` liest die `customerId` direkt aus dem Request-Body (`request.body.customerId`) ohne zu prüfen, ob diese zum authentifizierten Benutzer gehört. Ein Angreifer kann eine beliebige `customerId` übergeben und Zugriff auf das Billing-Portal anderer Kunden erhalten.
**Vorgeschlagener Fix:** Extrahieren Sie die `customerId` aus dem authentifizierten Lizenz-Token (`request.license.stripeCustomerId`) oder validieren Sie strikt, dass die übergebene ID zur Lizenz gehört.

### 3. IDOR Schwachstelle in Encrypted Sync (Security)
**Datei:** `apps/proxy-server/src/routes/sync.ts` (und `encrypted-sync-service.ts`)
**Zeilen:** 152, 185 (sync.ts)
**Problem:** Die Endpunkte `/api/sync/encrypted` (POST und GET) vertrauen blind dem `x-tenant-id` Header, der vom Client gesendet wird. Obwohl eine Lizenz-Authentifizierung stattfindet, wird nicht geprüft, ob der `x-tenant-id` zur Lizenz gehört. Ein valider User kann Daten beliebiger anderer Tenants lesen/schreiben.
**Vorgeschlagener Fix:** Der `tenantId` muss serverseitig aus dem Lizenz-Key abgeleitet werden und darf nicht vom Client bestimmt werden.

---

## 🔴 HOCH (High) - Potenzieller Datenverlust oder schwere Fehler

### 4. Datenverlust durch In-Memory Storage
**Datei:** `apps/proxy-server/src/services/encrypted-sync-service.ts`
**Zeilen:** 38
**Problem:** `const documentStore: Map<string, EncryptedDocument[]> = new Map();`
Der Sync-Service speichert alle verschlüsselten Dokumente nur im Arbeitsspeicher (RAM). Bei jedem Neustart des Servers gehen alle synchronisierten Daten verloren.
**Vorgeschlagener Fix:** Ersetzen Sie die `Map` durch eine persistente Datenbank (PostgreSQL/Prisma oder Supabase Integration).

### 5. Risiko der Exponierung des Supabase Service Keys
**Datei:** `apps/desktop/src/lib/db/supabase-client.ts` (via `supabase-client.ts.txt`)
**Problem:** `createMultiTenantClientFromEnv` priorisiert `SUPABASE_SERVICE_ROLE_KEY`. Wenn dieser Code im Desktop-Client (Renderer) ausgeführt wird und die Variable in der Umgebung vorhanden ist, erhält der Client vollen Admin-Zugriff auf die Datenbank unter Umgehung von RLS.
**Vorgeschlagener Fix:** Stellen Sie sicher, dass im Client-Kontext niemals der Service Role Key verwendet wird. Nutzen Sie explizit `NEXT_PUBLIC_SUPABASE_ANON_KEY` für Client-Instanziierungen.

### 6. Fehlerhafte Deanonymisierung (Datenintegrität)
**Datei:** `apps/desktop/src/lib/pipeline/voice-invoice-pipeline.ts`
**Zeile:** 215
**Problem:** Die Methode `deanonymizeInvoice` stellt `customerEmail` nicht wieder her. Platzhalter wie `[EMAIL_1]` werden permanent in der Datenbank gespeichert.
**Vorgeschlagener Fix:** Fügen Sie `result.customerEmail = deanonymize(result.customerEmail, tokenMap);` hinzu.

### 7. Unvollständige Anonymisierung (Privacy)
**Datei:** `apps/desktop/src/lib/pipeline/voice-invoice-pipeline.ts`
**Zeile:** 288
**Problem:** Beim Speichern der Rechnung wird `anonymize()` aufgerufen, ohne die `knownEntities` zu übergeben. Namen, die nicht durch generische Muster erkannt werden, bleiben im Klartext.
**Vorgeschlagener Fix:** Übergeben Sie die Liste der bekannten Entitäten an die `anonymize` Funktion.

### 8. Fehlerhafte Migrations-Logik (Datenintegrität)
**Datei:** `apps/desktop/src/lib/migration/encrypt-existing-data.ts`
**Zeilen:** 78, 105
**Problem:** Die Migration überspringt Datensätze, wenn das Hauptfeld (z.B. `name`) leer ist. Andere sensible Felder werden dann nicht verschlüsselt.
**Vorgeschlagener Fix:** Prüfen Sie auf *jedes* unverschlüsselte sensible Feld, nicht nur das Hauptfeld.

---

## 🟡 MITTEL (Medium) - Runtime Exceptions und Code Quality

### 9. Runtime Exception im Frontend (Buffer)
**Datei:** `packages/encryption-layer/src/crypto.ts`
**Zeilen:** 105, 120
**Problem:** Die Verwendung von `Buffer.from()` führt in Browser-Umgebungen zu Abstürzen.
**Vorgeschlagener Fix:** Verwenden Sie `Uint8Array` und Standard-Web-APIs (`atob`/`btoa`).

### 10. Fragile Base64 Verarbeitung
**Datei:** `apps/desktop/src/lib/sync/encrypted-sync-client.ts`
**Zeile:** 114
**Problem:** Extraktion des IV durch String-Slicing eines Base64-Strings ist fehleranfällig.
**Vorgeschlagener Fix:** Dekodieren Sie den Base64-String vollständig, bevor Sie den IV extrahieren.

### 11. Doppelte Verschlüsselung (Logic)
**Datei:** `apps/desktop/src/lib/encryption/field-encryption.ts`
**Problem:** Gefahr der doppelten Verschlüsselung, wenn bereits verschlüsselte Daten erneut verschlüsselt werden.
**Vorgeschlagener Fix:** Implementieren Sie Metadaten-Checks oder Typ-Guards.
