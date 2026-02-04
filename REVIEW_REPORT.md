# Review Report for PR (Merge 9a6e69a)

## 1. Kritische Sicherheitslücken (Critical)

### Insecure Direct Object Reference (IDOR) / Tenant Isolation Bypass
*   **Schweregrad:** Kritisch
*   **Ort:** `apps/proxy-server/src/routes/sync.ts` (Zeilen 171, 230)
*   **Beschreibung:** Die Endpunkte `/api/sync/encrypted` und `/api/sync/encrypted/pull` akzeptieren den `x-tenant-id` Header ohne Validierung. Ein authentifizierter Benutzer (mit gültigem Lizenzschlüssel) kann einen beliebigen `x-tenant-id` senden und so auf die verschlüsselten Daten anderer Mandanten zugreifen oder diese überschreiben. Die Funktion `createLicenseAuthHook` setzt zwar `request.license`, aber der Handler prüft nicht, ob `x-tenant-id` mit der Lizenz übereinstimmt.
*   **Fix:** In `sync.ts` muss validiert werden, dass der gesendete `x-tenant-id` Header mit dem aus dem Lizenzschlüssel abgeleiteten Tenant-ID übereinstimmt. Dazu muss `deriveTenantId` (aus `encryption-layer`) auf dem Server verwendet werden.
*   **Empfehlung:** Für Security-Review: @claude

### Runtime Exception in Desktop App
*   **Schweregrad:** Kritisch
*   **Ort:** `apps/desktop/src/lib/encryption/encryption-context.ts` (Funktion `getDeviceId`)
*   **Beschreibung:** Die Funktion greift direkt auf `localStorage` zu. Wenn dieser Code im Electron Main Process (Node.js) oder während des Server-Side Rendering (Next.js) ausgeführt wird (z.B. durch Import in `voice-invoice-pipeline.ts` oder API Routes), führt dies zu einem `ReferenceError: localStorage is not defined` und bringt die Anwendung zum Absturz.
*   **Fix:** Zugriff auf `localStorage` in einen `try-catch` Block kapseln oder prüfen, ob `typeof window !== 'undefined'`. Für Node.js-Umgebungen muss eine alternative Persistenz (z.B. `electron-store` oder Dateisystem) verwendet werden, da `localStorage` dort nicht existiert.

## 2. Logic-Fehler & Potenzielle Probleme (Major/Medium)

### Data Integrity Risk (Silent Decryption Failure)
*   **Schweregrad:** Hoch
*   **Ort:** `apps/desktop/src/lib/encryption/field-encryption.ts` (Funktion `decryptSensitiveFields`)
*   **Beschreibung:** Wenn die Entschlüsselung fehlschlägt (z.B. falscher Schlüssel nach Restore), wird der Fehler abgefangen und der *verschlüsselte Blob* als "Plaintext" zurückgegeben. Dies führt dazu, dass der Benutzer Kauderwelsch in der UI sieht und beim Speichern potenziell doppelt verschlüsselt wird.
*   **Fix:** Implementieren Sie eine Prüfung mit `isEncrypted()`. Wenn es wie verschlüsselte Daten aussieht, aber die Entschlüsselung fehlschlägt, sollte ein Fehler geworfen oder ein UI-Platzhalter angezeigt werden, anstatt den Raw-String zurückzugeben.

### Fehlende Persistenz (Production Readiness)
*   **Schweregrad:** Mittel
*   **Ort:** `apps/proxy-server/src/services/encrypted-sync-service.ts`
*   **Beschreibung:** Die Implementierung verwendet `documentStore` als `Map` (In-Memory). Bei einem Neustart des Servers gehen alle synchronisierten Daten verloren.
*   **Fix:** Dies muss vor dem Deployment durch eine persistente Datenbank (Supabase/Postgres) ersetzt werden.

## 3. Sonstiges

*   **Dependency:** `apps/proxy-server` benötigt `@voiceinvoice/encryption-layer` als Dependency, um die Tenant-ID-Validierung durchzuführen.
*   **Buffer:** Nutzung von `Buffer` in `encryption-layer` erfordert Node.js-Kompatibilitätsschicht in reinen Browser-Umgebungen (aktuell für Electron/Node okay).

---
**Status:** Changes requested.
