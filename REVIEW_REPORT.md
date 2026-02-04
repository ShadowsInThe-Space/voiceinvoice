# Review Report: Proxy Server Sync & Multi-Tenancy

## Gefundene Probleme

### 🔴 Kritisch (Breaking Changes / Runtime Errors)

1.  **Fehlender Export `createLicenseAuthHook`**
    *   **Datei:** `apps/proxy-server/src/routes/sync.ts` (Zeile 9, 44, 79)
    *   **Problem:** `sync.ts` importiert `createLicenseAuthHook` aus `./license`, aber `apps/proxy-server/src/routes/license.ts` exportiert diese Funktion nicht. Dies führt zu einem Runtime-Error (`Module not found` oder `undefined`).
    *   **Ursache:** Wahrscheinlich durch Merge-Konflikt oder Refactoring in `license.ts` verloren gegangen.
    *   **Vorschlag:** Die Funktion `createLicenseAuthHook` (und `createQuotaCheckHook`) muss in `license.ts` (oder einem Auth-Middleware-Modul) implementiert und exportiert werden.

2.  **Falscher Import von `prisma`**
    *   **Datei:** `apps/proxy-server/src/services/license-service.ts` (Zeile 8)
    *   **Problem:** `import { prisma } from './prisma';` wird verwendet, aber `apps/proxy-server/src/services/prisma.ts` exportiert keine `prisma` Konstante, sondern nur `getPrismaClient()`. Dies führt zu einem Absturz beim Start.
    *   **Vorschlag:** Import zu `import { getPrismaClient } from './prisma';` ändern und `getPrismaClient().license.findUnique(...)` verwenden.

### 🟠 Hoch (Security / Logic)

3.  **Fehlende Quota-Prüfung**
    *   **Datei:** `apps/proxy-server/src/routes/sync.ts`
    *   **Problem:** Die Endpunkte `/api/sync/push` und `/pull` verwenden (theoretisch) nur `createLicenseAuthHook`. Es findet keine Überprüfung des `monthlyQuota` statt. Nutzer könnten unbegrenzt Daten synchronisieren und Server-Speicher belegen.
    *   **Vorschlag:** `createQuotaCheckHook` (falls vorhanden) zusätzlich als `preHandler` einbinden. Außerdem sollte `pushEntity` prüfen, ob Speicher-Limits eingehalten werden.

### 🟡 Mittel (Edge Cases / Exceptions)

4.  **`since` Parameter führt zu 500 Error**
    *   **Datei:** `apps/proxy-server/src/routes/sync.ts` (Zeile 88-89)
    *   **Problem:** `parseInt(sinceStr, 10)` gibt `NaN` zurück, wenn der String keine Zahl ist. `new Date(NaN)` ist invalid, aber wirft erst bei `.toISOString()` oder Prisma-Queries Fehler.
    *   **Vorschlag:** Validierung verbessern:
        ```typescript
        const since = sinceStr ? parseInt(sinceStr, 10) : null;
        if (sinceStr && isNaN(since)) { return reply.status(400)... }
        ```

5.  **Mögliche Race-Condition bei `lastSyncTimestamp`**
    *   **Datei:** `apps/proxy-server/src/services/sync-service.ts`
    *   **Problem:** `lastSyncTimestamp` wird aus den zurückgegebenen Daten berechnet. Wenn während des Requests neue Daten mit gleichem Timestamp eingefügt werden, könnten diese beim nächsten Pull übersprungen werden (abhängig von der DB-Präzision).
    *   **Vorschlag:** Serverseitige "Current Transaction Time" oder Cursor-basiertes Paging verwenden statt Client-seitigem Timestamp. Für den Moment akzeptabel, aber riskant bei hoher Last.

## Zusammenfassung der Fixes

```typescript
// apps/proxy-server/src/services/license-service.ts
import { getPrismaClient } from './prisma'; // FIX: Correct Import

export async function validateLicense(licenseKey: string) {
  const prisma = getPrismaClient(); // FIX: Usage
  // ...
}
```

```typescript
// apps/proxy-server/src/routes/sync.ts
// FIX: Ensure hooks are actually exported from license.ts or moved to a middleware file
import { createLicenseAuthHook, createQuotaCheckHook } from './license';

server.post('/api/sync/push', {
  preHandler: [createLicenseAuthHook(), createQuotaCheckHook()] // FIX: Add Quota Check
}, ...);

// FIX: Validate since parameter
const since = sinceStr ? parseInt(sinceStr, 10) : null;
if (sinceStr && isNaN(since!)) {
    return reply.status(400).send({ error: 'Invalid timestamp' });
}
```

Für Security-Review: @claude
