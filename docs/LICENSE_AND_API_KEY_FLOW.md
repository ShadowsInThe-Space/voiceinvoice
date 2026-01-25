# Lizenz- und API-Key-Management Flow

**Dokumentiert am:** 2026-01-25
**Zweck:** Vollständige Dokumentation des Abo-Abschlusses, der Lizenzgenerierung und des API-Key-Managements

---

## 🎯 Demo vs. Production-Ready SaaS

### Aktueller Stand: DEMO-Version

**In dieser Demo:**

- ✅ Benutzer stellen ihren eigenen Google AI API Key bereit
- ✅ Lizenzserver auf Hetzner ist vollständig implementiert
- ✅ Stripe-Integration ist funktionsfähig
- ✅ JWT-basierte Authentifizierung funktioniert
- ✅ Quota-Tracking System ist fertig

**Für echtes SaaS bereit:**

- ✅ Proxy-Server auf Hetzner Frankfurt (api.shadowsinthe.space)
- ✅ `/transcribe` Endpoint bereits implementiert
- ✅ Speech-Service nutzt zentrale GOOGLE_API_KEY
- ✅ Lizenz-Middleware (Auth + Quota) vorhanden
- ✅ PostgreSQL für Multi-Tenant Lizenzverwaltung
- ✅ Stripe Webhook für automatische Lizenzgenerierung

**Was für Production-SaaS fehlt:**

1. Desktop-App Umleitung: Alle Gemini-Aufrufe über Proxy statt direkt
2. Zusätzliche Proxy-Endpoints: `/api/gemini/extract-invoice`, `/api/chat/rag`
3. Quota-Middleware aktivieren: Auf allen AI-Endpoints
4. Kostenrechnung: Lizenzpreise müssen Google AI Kosten decken

### Migration zu zentralem API-Key-Management

```
DEMO (aktuell):
┌──────────┐              ┌──────────────┐
│ Desktop  │─────────────>│ Google AI    │
│ (Client) │  User API Key│ (direkt)     │
└──────────┘              └──────────────┘
     │
     v
┌──────────────┐
│ Hetzner      │  Lizenz-Validierung
│ Proxy-Server │  Quota-Tracking
└──────────────┘

PRODUCTION (prepared):
┌──────────┐              ┌──────────────┐              ┌──────────────┐
│ Desktop  │─────────────>│ Hetzner      │─────────────>│ Google AI    │
│ (Client) │  JWT Token   │ Proxy-Server │  Zentral Key │              │
└──────────┘              └──────────────┘              └──────────────┘
                               │
                               v
                          ┌──────────────┐
                          │ PostgreSQL   │
                          │ - Lizenzen   │
                          │ - Usage      │
                          └──────────────┘
```

---

## Übersicht

VoiceInvoice Enterprise verwendet ein **zweigleisiges Authentifizierungs- und Autorisierungssystem**:

1. **Lizenzschlüssel** (vom Proxy-Server verwaltet) → Kontrolliert Nutzungsquoten und Abo-Status
2. **Google AI API Keys** (aktuell: vom Benutzer bereitgestellt) → Ermöglicht Zugriff auf Gemini 2.5 Flash und Chirp 3

**DEMO-Modus:** API Keys werden vom Benutzer selbst bereitgestellt. Das System ist aber bereits für zentrales API-Key-Management vorbereitet (siehe Production-Ready Infrastruktur oben).

---

## Subscription-Pläne

| Plan             | Preis | Monatliche Quota | Gültigkeit |
| ---------------- | ----- | ---------------- | ---------- |
| **Starter**      | €29   | 500 Rechnungen   | 365 Tage   |
| **Professional** | €79   | 2000 Rechnungen  | 365 Tage   |
| **Enterprise**   | €199  | 10000 Rechnungen | 365 Tage   |

**Quota-Reset:** Jeden Monat (30 Tage nach Aktivierung)

---

## Vollständiger Abo-Abschluss Flow

### Phase 1: Checkout-Initiierung (Desktop → Proxy-Server → Stripe)

```
┌─────────────┐
│ User klickt │
│ "Upgrade"   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────┐
│ Desktop: settings.tsx                          │
│ handleUpgrade(planId)                          │
│ ├─ licenseApi.createCheckoutSession({         │
│ │    planId: "STARTER" | "PROFESSIONAL" | ..  │
│ │    companyName: "Demo Company",             │
│ │    email: "user@example.com",               │
│ │    successUrl: "http://localhost:3002/...", │
│ │    cancelUrl: "http://localhost:3002/..."   │
│ │  })                                          │
│ └─ Redirect: window.location.href = result.url│
└──────────────────┬──────────────────────────────┘
                   │ POST /api/stripe/checkout
                   ▼
┌─────────────────────────────────────────────────┐
│ Proxy-Server: routes/stripe.ts                 │
│ POST /api/stripe/checkout                      │
│ ├─ Validierung: Zod Schema (planId, email, ..) │
│ ├─ createCheckoutSession(planId, ..)           │
│ │   └─ Stripe.checkout.sessions.create({      │
│ │        line_items: [{price: plan.stripePriceId}]│
│ │        metadata: {planId, companyName, ..}   │
│ │        success_url: successUrl,              │
│ │        cancel_url: cancelUrl                 │
│ │      })                                      │
│ └─ Response: {sessionId, url}                  │
└──────────────────┬──────────────────────────────┘
                   │ Checkout Session URL
                   ▼
┌─────────────────────────────────────────────────┐
│ Stripe Checkout (hosted)                       │
│ ├─ Benutzer gibt Kreditkartendaten ein        │
│ ├─ Stripe verarbeitet Zahlung                 │
│ └─ Bei Erfolg: Payment Status = "paid"        │
└──────────────────┬──────────────────────────────┘
                   │
                   │ Stripe sendet Webhook
                   ▼
```

### Phase 2: Webhook-Verarbeitung & Lizenzgenerierung (Stripe → Proxy-Server)

```
┌─────────────────────────────────────────────────┐
│ Stripe Webhook Event                           │
│ Type: "checkout.session.completed"             │
│ Data: {id, payment_status: "paid", metadata}   │
└──────────────────┬──────────────────────────────┘
                   │ POST /api/stripe/webhook
                   │ Header: stripe-signature
                   ▼
┌─────────────────────────────────────────────────┐
│ Proxy-Server: routes/stripe.ts                 │
│ POST /api/stripe/webhook                       │
│ ├─ SICHERHEIT: verifyWebhookSignature()        │
│ │   └─ Stripe.webhooks.constructEvent(rawBody, │
│ │        signature, webhookSecret)             │
│ │                                               │
│ ├─ Event-Handler: checkout.session.completed   │
│ │   └─ if (payment_status === "paid")          │
│ │                                               │
│ ├─ processCompletedCheckout(sessionId)         │
│ │   └─ Stripe.checkout.sessions.retrieve()     │
│ │       Returns: {email, metadata: {planId,    │
│ │                 companyName}}                 │
│ │                                               │
│ ├─ Lizenzschlüssel generieren:                 │
│ │   licenseKey = generateLicenseKey()          │
│ │   Format: "VI-XXXX-XXXX-XXXX"                │
│ │   ├─ 3 Segmente × 4 Zeichen                  │
│ │   └─ Zufällige Hex-Werte (crypto.randomBytes)│
│ │                                               │
│ ├─ Gültigkeitsdatum berechnen:                 │
│ │   expiresAt = now + plan.validityDays        │
│ │   usageResetDate = now + 30 Tage             │
│ │                                               │
│ ├─ License-Objekt erstellen:                   │
│ │   {                                           │
│ │     id: randomBytes(16).toString('hex'),     │
│ │     licenseKey: "VI-XXXX-XXXX-XXXX",         │
│ │     companyName: payment.companyName,        │
│ │     status: "ACTIVE",                        │
│ │     monthlyQuota: plan.monthlyQuota,         │
│ │     currentUsage: 0,                         │
│ │     usageResetDate: Date,                    │
│ │     expiresAt: Date,                         │
│ │     createdAt: now,                          │
│ │     updatedAt: now                           │
│ │   }                                           │
│ │                                               │
│ ├─ Lizenz speichern:                           │
│ │   licenseStore.addLicense(license)           │
│ │   └─ PostgreSQL: licenses Tabelle            │
│ │                                               │
│ └─ TODO: E-Mail senden                         │
│     sendLicenseEmail(email, licenseKey, plan)  │
│     └─ Benutzer erhält Lizenzschlüssel per Mail│
└─────────────────────────────────────────────────┘
```

### Phase 3: Lizenzvalidierung (Desktop → Proxy-Server)

```
┌─────────────────────────────────────────────────┐
│ User gibt Lizenzschlüssel in Settings ein     │
│ ├─ Input: "VI-XXXX-XXXX-XXXX"                  │
│ └─ Klick: "Lizenz validieren"                  │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│ Desktop: settings.tsx                          │
│ handleValidateLicense()                        │
│ └─ licenseApi.validateLicense(licenseKey)      │
└──────────────────┬──────────────────────────────┘
                   │ POST /api/license/validate
                   │ Body: {licenseKey}
                   ▼
┌─────────────────────────────────────────────────┐
│ Proxy-Server: routes/license.ts                │
│ POST /api/license/validate                     │
│ ├─ Validierung: Zod Schema (licenseKey)        │
│ │                                               │
│ ├─ Lizenz nachschlagen:                        │
│ │   license = licenseStore.getLicense(key)     │
│ │   └─ PostgreSQL Query                        │
│ │                                               │
│ ├─ Checks:                                     │
│ │   ├─ Lizenz existiert?                       │
│ │   ├─ Nicht abgelaufen? (expiresAt > now)     │
│ │   ├─ Status ACTIVE? (nicht SUSPENDED/REVOKED)│
│ │   └─ Bei Fehler: 403/404                     │
│ │                                               │
│ ├─ JWT Token generieren:                       │
│ │   payload = {                                │
│ │     licenseKey: license.licenseKey,          │
│ │     companyName: license.companyName,        │
│ │     expiresAt: license.expiresAt.toISOString()│
│ │   }                                           │
│ │   token = jwt.sign(payload, JWT_SECRET,      │
│ │             {expiresIn: '30d'})              │
│ │                                               │
│ ├─ Response Headers:                           │
│ │   X-RateLimit-Limit: license.monthlyQuota    │
│ │   X-RateLimit-Remaining: quota - usage       │
│ │   X-RateLimit-Reset: usageResetDate          │
│ │                                               │
│ └─ Response Body:                              │
│     {                                           │
│       token: "eyJhbGciOiJIUzI1NiIs...",        │
│       license: {                               │
│         licenseKey: "VI-XXXX-XXXX-XXXX",       │
│         companyName: "Demo Company",           │
│         status: "ACTIVE",                      │
│         monthlyQuota: 500,                     │
│         currentUsage: 0,                       │
│         expiresAt: "2027-01-25T12:00:00.000Z"  │
│       }                                         │
│     }                                           │
└──────────────────┬──────────────────────────────┘
                   │ Response
                   ▼
┌─────────────────────────────────────────────────┐
│ Desktop: license-api.ts                        │
│ ├─ Token speichern:                            │
│ │   localStorage.setItem(                      │
│ │     'voiceinvoice_license_token', token)     │
│ │                                               │
│ └─ licenseApi.setToken(token)                  │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│ Desktop: settings.tsx                          │
│ ├─ setLicenseStatus('active')                  │
│ ├─ setLicenseDetails({plan, quota, usage, ...})│
│ └─ UI Update: Grüner Banner "Lizenz aktiv"     │
└─────────────────────────────────────────────────┘
```

---

## Quota-Tracking & Rate Limiting

### API-Aufruf mit Quota-Check

Wenn ein geschützter Endpoint aufgerufen wird (z.B. Transkription):

```
┌─────────────────────────────────────────────────┐
│ Desktop sendet API Request                     │
│ Header: Authorization: Bearer <token>          │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│ Proxy-Server: Middleware                       │
│ preHandler: [                                  │
│   createLicenseAuthHook(),    // Token prüfen  │
│   createQuotaCheckHook()      // Quota prüfen  │
│ ]                                               │
│                                                 │
│ createLicenseAuthHook():                       │
│ ├─ Token aus Authorization-Header extrahieren  │
│ ├─ verifyLicenseToken(token)                   │
│ │   └─ jwt.verify(token, JWT_SECRET)           │
│ ├─ Bei Fehler: 401 Unauthorized                │
│ └─ request.license = payload                   │
│                                                 │
│ createQuotaCheckHook():                        │
│ ├─ licenseStore.incrementUsage(licenseKey)     │
│ │   ├─ PostgreSQL: UPDATE licenses             │
│ │   │   SET currentUsage = currentUsage + 1    │
│ │   │   WHERE licenseKey = ?                   │
│ │   │   AND currentUsage < monthlyQuota        │
│ │   │   AND usageResetDate > NOW()             │
│ │   │                                           │
│ │   └─ Bei monthlyQuota überschritten:         │
│ │       return {success: false, error: QUOTA_..}│
│ │                                               │
│ ├─ Wenn Quota überschritten:                   │
│ │   └─ 429 Too Many Requests                   │
│ │       X-RateLimit-Limit: 500                 │
│ │       X-RateLimit-Remaining: 0               │
│ │       X-RateLimit-Reset: 2026-02-25T...      │
│ │                                               │
│ └─ Bei Erfolg: Request durchlassen             │
└─────────────────────────────────────────────────┘
```

### Monatlicher Quota-Reset

```sql
-- Automatischer Reset nach 30 Tagen
UPDATE licenses
SET currentUsage = 0,
    usageResetDate = NOW() + INTERVAL '30 days'
WHERE usageResetDate <= NOW()
  AND status = 'ACTIVE';
```

---

## Google AI API Key Management

### Wichtig: API Keys sind NICHT Teil des Lizenz-Systems!

**Benutzer müssen ihren eigenen API Key beschaffen:**

1. **Google AI Studio besuchen:**
   → https://makersuite.google.com/app/apikey

2. **API Key generieren:**
   → Projekt auswählen (z.B. EverlastContest)
   → "Create API Key" klicken
   → Key kopieren: `AIzaSy...`

3. **In VoiceInvoice eingeben:**
   → Settings-Seite öffnen
   → API Key in Textfeld einfügen
   → "API-Einstellungen speichern" klicken

### API Key Speicherung (Desktop)

```typescript
// apps/desktop/src/pages/settings.tsx

const handleSaveApiKey = () => {
  // Speichern in localStorage (client-side)
  localStorage.setItem('voiceinvoice_google_api_key', apiKey);

  // OPTIONAL: Speichern in Backend Settings (Electron)
  if (window.voiceinvoice?.settings) {
    await window.voiceinvoice.settings.set({
      googleApiKey: apiKey,
    });
  }
};
```

### API Key Verwendung (Voice-to-Invoice Pipeline)

```typescript
// apps/desktop/src/components/chat/ChatInterface.tsx

useEffect(() => {
  // Fallback-Chain für API Key
  const apiKey =
    localStorage.getItem('voiceinvoice_gemini_api_key') || // User Settings
    process.env.GEMINI_API_KEY || // .env file
    process.env.NEXT_PUBLIC_GOOGLE_API_KEY; // Public env

  const projectId = process.env.GOOGLE_CLOUD_PROJECT; // EverlastContest
  const location = process.env.GOOGLE_CLOUD_LOCATION; // eu
  const recognizer = process.env.CHIRP3_RECOGNIZER; // invoice-chirp3-de

  if (apiKey) {
    setGeminiClient(
      new GeminiClient({
        apiKey, // Benutzer-API-Key (nicht vom Lizenz-Server!)
        projectId,
        location,
        recognizer,
      })
    );
  }
}, []);
```

**Wichtige Klarstellung:**

- ❌ Lizenzschlüssel schalten KEINE API Keys frei
- ❌ Proxy-Server verwaltet KEINE API Keys
- ✅ Jeder Benutzer braucht seinen eigenen Google AI API Key
- ✅ Lizenz kontrolliert nur die monatliche Nutzungsquota

---

## Datenbank-Schema (PostgreSQL)

### licenses Tabelle

```sql
CREATE TABLE licenses (
  id VARCHAR(32) PRIMARY KEY,
  licenseKey VARCHAR(20) UNIQUE NOT NULL,  -- VI-XXXX-XXXX-XXXX
  companyName VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL,              -- ACTIVE, SUSPENDED, REVOKED
  monthlyQuota INTEGER NOT NULL,            -- 500, 2000, 10000
  currentUsage INTEGER NOT NULL DEFAULT 0,
  usageResetDate TIMESTAMP NOT NULL,
  expiresAt TIMESTAMP NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_licenses_key ON licenses(licenseKey);
CREATE INDEX idx_licenses_status ON licenses(status);
CREATE INDEX idx_licenses_expiry ON licenses(expiresAt);
```

---

## Fehlerbehandlung & Edge Cases

### 1. Lizenzschlüssel ungültig

```
POST /api/license/validate
Response: 404 Not Found
{
  "error": "License key not found",
  "statusCode": 404
}
```

### 2. Lizenz abgelaufen

```
POST /api/license/validate
Response: 403 Forbidden
{
  "error": "License has expired",
  "statusCode": 403
}
```

### 3. Quota überschritten

```
POST /api/transcribe
Response: 429 Too Many Requests
{
  "error": "Monthly quota exceeded",
  "statusCode": 429
}
Headers:
  X-RateLimit-Limit: 500
  X-RateLimit-Remaining: 0
  X-RateLimit-Reset: 2026-02-25T12:00:00.000Z
```

### 4. JWT Token ungültig/abgelaufen

```
GET /api/license/status
Response: 401 Unauthorized
{
  "error": "Invalid or expired token",
  "statusCode": 401
}
```

### 5. API Key fehlt

```
// Desktop AlertContext.tsx zeigt Banner an:
"⚠️ Gemini API Key fehlt - Bitte in den Einstellungen hinterlegen"
```

---

## Sicherheitsaspekte

### 1. Stripe Webhook Verification

```typescript
// CRITICAL: Signature muss verifiziert werden, sonst könnte jeder Lizenzen erstellen!
const event = Stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
```

### 2. JWT Token Security

```typescript
// Token-Generierung mit Secret
const token = jwt.sign(payload, process.env.JWT_SECRET, {
  expiresIn: '30d', // Token läuft nach 30 Tagen ab
  algorithm: 'HS256',
});

// Token-Verifizierung
const payload = jwt.verify(token, process.env.JWT_SECRET);
```

### 3. Rate Limit Headers

```typescript
// Informiert Client über Quota-Status
reply.header('X-RateLimit-Limit', license.monthlyQuota.toString());
reply.header('X-RateLimit-Remaining', remaining.toString());
reply.header('X-RateLimit-Reset', license.usageResetDate.toISOString());
```

### 4. HTTPS Required

- Alle API-Kommunikation muss über HTTPS erfolgen
- JWT Tokens niemals über unsichere Verbindungen senden
- API Keys niemals in URLs oder Query-Parametern

---

## Testing & Monitoring

### Lokales Testing (Development)

1. **Mock License Store:**

```typescript
// apps/proxy-server/src/services/license-store.ts
// Verwendet In-Memory Store statt PostgreSQL für lokale Tests
```

2. **Stripe Test Mode:**

```bash
# .env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

3. **Test-Lizenzschlüssel generieren:**

```bash
curl -X POST http://localhost:3001/api/license/validate \
  -H "Content-Type: application/json" \
  -d '{"licenseKey": "VI-TEST-TEST-TEST"}'
```

### Production Monitoring

1. **Stripe Dashboard:**
   - Payments überwachen
   - Webhook-Events prüfen
   - Failed payments tracken

2. **License Status Checks:**

```bash
curl -X GET https://api.shadowsinthe.space/api/license/status \
  -H "Authorization: Bearer <token>"
```

3. **Quota Usage Alerts:**

```sql
-- Lizenzen finden, die >90% Quota verwendet haben
SELECT licenseKey, companyName, currentUsage, monthlyQuota,
       (currentUsage::float / monthlyQuota * 100) as usage_percent
FROM licenses
WHERE (currentUsage::float / monthlyQuota) > 0.9
  AND status = 'ACTIVE';
```

---

## Zusammenfassung

### Abo-Abschluss Flow (3 Phasen)

1. **Checkout:** Desktop → Stripe Checkout Session → Zahlung
2. **Webhook:** Stripe → Proxy-Server → Lizenz generieren & speichern
3. **Validierung:** Desktop → Lizenz validieren → JWT Token erhalten

### Zwei unabhängige Systeme

| System                | Verwaltet von             | Zweck                       |
| --------------------- | ------------------------- | --------------------------- |
| **Lizenzschlüssel**   | Proxy-Server (PostgreSQL) | Quota-Kontrolle, Abo-Status |
| **Google AI API Key** | Benutzer (localStorage)   | Zugriff auf Gemini/Chirp 3  |

### Wichtigste Erkenntnisse

✅ **Lizenz ≠ API Key** - Lizenz schaltet keine API Keys frei
✅ **JWT-basierte Auth** - Token nach Validierung für 30 Tage gültig
✅ **Monatliche Quota** - Reset alle 30 Tage, trackt Nutzung pro Lizenz
✅ **Webhook-Sicherheit** - Stripe Signature Verification zwingend erforderlich
✅ **Rate Limiting** - HTTP 429 bei Quota-Überschreitung mit Reset-Zeit

---

## 🏗️ Production-Ready Infrastruktur (Hetzner Server)

### Vorhandene Server-Komponenten

**Hetzner Frankfurt Server (138.199.166.219):**

```
Domains:
├─ api.shadowsinthe.space         → Proxy-Server (Fastify 5)
├─ n8n.shadowsinthe.space         → n8n Workflow Engine
├─ supabase.shadowsinthe.space    → Supabase Vector DB (RAG)
├─ supabase-studio.shadowsinthe.space → Supabase Studio UI
└─ portainer.shadowsinthe.space   → Docker Management
```

**Implementierte API-Endpoints:**

| Endpoint                     | Funktion                       | Status                       |
| ---------------------------- | ------------------------------ | ---------------------------- |
| `POST /api/license/validate` | Lizenzschlüssel validieren     | ✅ Produktiv                 |
| `GET /api/license/status`    | Lizenz-Status abfragen         | ✅ Produktiv                 |
| `POST /api/stripe/checkout`  | Stripe Checkout erstellen      | ✅ Produktiv                 |
| `POST /api/stripe/webhook`   | Stripe Payments verarbeiten    | ✅ Produktiv                 |
| `GET /api/stripe/plans`      | Verfügbare Pläne abrufen       | ✅ Produktiv                 |
| `POST /transcribe`           | Audio transkribieren (Chirp 3) | ✅ Vorhanden (nicht genutzt) |
| `POST /sync`                 | Daten synchronisieren          | ✅ Vorhanden                 |
| `POST /enrich`               | Daten anreichern               | ✅ Vorhanden                 |
| `GET /health`                | Health Check                   | ✅ Produktiv                 |

**Was für SaaS-Migration benötigt wird:**

```typescript
// NEUE Endpoints für zentrale AI-Verarbeitung:
POST / api / gemini / extract - invoice; // Rechnung aus Transkript extrahieren
POST / api / gemini / chat; // RAG-Chat Anfragen
POST / api / speech / tts; // Text-to-Speech (Google Cloud TTS)

// AKTIVIERUNG: Quota-Middleware auf allen AI-Endpoints
app.post(
  '/transcribe',
  {
    preHandler: [
      createLicenseAuthHook(), // ← Schon fertig!
      createQuotaCheckHook(), // ← Schon fertig!
    ],
  },
  transcribeHandler
);
```

### Datenbank-Setup (PostgreSQL)

**Tabellen am Hetzner-Server:**

```sql
-- Lizenzverwaltung
CREATE TABLE licenses (
  id VARCHAR(32) PRIMARY KEY,
  licenseKey VARCHAR(20) UNIQUE NOT NULL,
  companyName VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL,        -- ACTIVE, SUSPENDED, REVOKED
  monthlyQuota INTEGER NOT NULL,
  currentUsage INTEGER NOT NULL DEFAULT 0,
  usageResetDate TIMESTAMP NOT NULL,
  expiresAt TIMESTAMP NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Stripe Payments Tracking (optional)
-- Wird für Webhook-Verarbeitung genutzt
```

### Umgebungsvariablen (Production)

```bash
# Hetzner Server .env
NODE_ENV=production
PORT=3001

# Google AI (für zentrales API-Key-Management)
GOOGLE_API_KEY=AIzaSy...                    # ← Dein zentraler Key
GOOGLE_CLOUD_PROJECT=gen-lang-client-0282907813
GOOGLE_CLOUD_LOCATION=eu

# Stripe
STRIPE_SECRET_KEY=sk_live_...               # ← Production Key
STRIPE_WEBHOOK_SECRET=whsec_...

# JWT
JWT_SECRET=<zufälliger-secret>              # ← 32+ Zeichen

# PostgreSQL
DATABASE_URL=postgresql://user:pass@localhost:5432/voiceinvoice

# CORS (erlaubt Desktop-App Zugriff)
CORS_ORIGIN=http://localhost:3002,electron://
```

### Stripe-Konfiguration

**Webhook-Setup:**

1. Stripe Dashboard → Developers → Webhooks
2. Endpoint URL: `https://api.shadowsinthe.space/api/stripe/webhook`
3. Events: `checkout.session.completed`, `payment_intent.payment_failed`
4. Webhook Secret kopieren → `STRIPE_WEBHOOK_SECRET` in .env

**Price IDs (zu erstellen):**

```typescript
// In Stripe Dashboard: Products → Create Product
const STRIPE_PRICES = {
  STARTER: 'price_1234...', // €29
  PROFESSIONAL: 'price_5678...', // €79
  ENTERPRISE: 'price_9012...', // €199
};
```

### n8n Workflow-Integration

**Vorhandene Webhooks:**

- `https://n8n.shadowsinthe.space/webhook/chat` → RAG Chat
- `https://n8n.shadowsinthe.space/webhook/ingest` → Document Ingestion
- `https://n8n.shadowsinthe.space/webhook/invoice-email` → Invoice Email
- `https://n8n.shadowsinthe.space/webhook/payment-reminder` → Payment Reminder

**Supabase Vector DB:**

- URL: `https://supabase.shadowsinthe.space`
- Anon Key: `eyJhbGciOiJIUzI1NiIs...` (in .env)

### Migration Checklist: Demo → Production SaaS

**Phase 1: API-Key-Zentralisierung** (1-2 Tage)

- [ ] Desktop-App: GeminiClient durch ProxyClient ersetzen
- [ ] Alle Gemini-Aufrufe über `/api/gemini/*` Endpoints
- [ ] TTS-Aufrufe über `/api/speech/tts` statt direkt

**Phase 2: Quota-Enforcement** (1 Tag)

- [ ] Quota-Middleware auf allen AI-Endpoints aktivieren
- [ ] Desktop: JWT Token bei jedem Request mitschicken
- [ ] Error-Handling für 429 Too Many Requests

**Phase 3: Kostenrechnung & Pricing** (1 Tag)

- [ ] Google AI Kosten analysieren (pro 1000 Rechnungen)
- [ ] Stripe Prices entsprechend anpassen
- [ ] Break-Even-Point berechnen

**Geschätzte Kosten (Beispiel):**

```
Gemini 2.5 Flash: €0.0001 pro Request (Rechnungsextraktion)
Chirp 3: €0.0024 pro Minute Audio
TTS: €0.016 pro 1M Zeichen

Starter (500 Rechnungen/Monat):
- 500x Transkription (30s): 500 × 0.5 × €0.0024 = €0.60
- 500x Extraktion: 500 × €0.0001 = €0.05
- 500x TTS (100 Zeichen): 500 × 100 × €0.000016 = €0.80
→ Kosten: ~€1.45/Monat
→ Preis: €29/Monat
→ Marge: €27.55 (95%)
```

---

**Dokumentiert durch:** Claude Sonnet 4.5
**Analysierte Dateien:**

- `apps/desktop/src/lib/api/license-api.ts`
- `apps/desktop/src/pages/settings.tsx`
- `apps/proxy-server/src/routes/license.ts`
- `apps/proxy-server/src/routes/stripe.ts`
- `apps/proxy-server/src/routes/transcribe.ts`
- `apps/proxy-server/src/services/speech-service.ts`
