# Stripe Customer Portal - Integration & Deployment Guide

## Überblick

Diese Anleitung beschreibt die vollständige Integration des Stripe Customer Portals in VoiceInvoice Enterprise. Nach Abschluss können Benutzer ihre Abonnements selbstständig über das Stripe-Portal verwalten.

## Voraussetzungen

### Stripe-Account

1. **Stripe-Account erstellen** (falls noch nicht vorhanden)
   - Gehe zu https://stripe.com
   - Registriere einen Account
   - Aktiviere den Test-Modus für Entwicklung

2. **API-Keys abrufen**
   - Dashboard → Developers → API Keys
   - Kopiere "Secret key" (beginnt mit `sk_test_...` im Test-Modus)
   - Kopiere "Publishable key" (wird für Checkout benötigt)

3. **Webhook-Signing Secret generieren**
   - Dashboard → Developers → Webhooks
   - "Add endpoint" klicken
   - URL: `https://your-domain.com/api/stripe/webhook`
   - Events auswählen:
     - `checkout.session.completed`
     - `customer.subscription.deleted`
     - `customer.subscription.updated`
   - "Add endpoint" klicken
   - "Signing secret" kopieren (beginnt mit `whsec_...`)

4. **Billing Portal konfigurieren**
   - Dashboard → Settings → Billing → Customer portal
   - Features aktivieren:
     - ✅ Update payment method
     - ✅ Cancel subscription
     - ✅ View invoice history
   - Branding anpassen (Logo, Farben, etc.)
   - Speichern

## Environment Variables

### Backend (apps/proxy-server)

Erstelle/aktualisiere `.env` im `apps/proxy-server/` Verzeichnis:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_... # oder sk_live_... für Production
STRIPE_WEBHOOK_SECRET=whsec_...

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/voiceinvoice

# JWT Secret für License Token
JWT_SECRET=your-secret-key-min-32-chars

# Server Configuration
PORT=3001
NODE_ENV=development
```

### Frontend (apps/desktop)

Erstelle/aktualisiere `.env.local` im `apps/desktop/` Verzeichnis:

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001

# Stripe (nur Publishable Key für Checkout)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... # oder pk_live_...
```

## Datenbank-Migration

### Schema-Änderungen anwenden

Die Integration fügt dem `License` Model folgende Felder hinzu:

- `stripeCustomerId` (String, optional, unique)
- `companyName` (String, required)

**Migration ausführen:**

```bash
# Im Hauptverzeichnis
cd packages/database

# Migration erstellen
pnpm prisma migrate dev --name add_stripe_customer_portal

# Migration auf Production anwenden (VORSICHT!)
pnpm prisma migrate deploy
```

### Prisma Client neu generieren

```bash
# Server Client generieren
pnpm db:generate:server

# Desktop Client generieren
pnpm db:generate
```

## Backend-Integration

### 1. Portal-Routes registrieren

Die Portal-Routes sind bereits in `apps/proxy-server/src/routes/stripe-portal.ts` implementiert und werden in `src/server.ts` registriert:

```typescript
import { registerStripePortalRoutes } from './routes/stripe-portal';

// In der Server-Initialisierung
await registerStripePortalRoutes(server);
```

### 2. Webhook-Handler erweitern

Die Webhook-Handler in `apps/proxy-server/src/routes/stripe.ts` verarbeiten folgende Events:

- **checkout.session.completed**: Lizenz erstellen und `stripeCustomerId` speichern
- **customer.subscription.deleted**: Lizenz auf `EXPIRED` setzen
- **customer.subscription.updated**: Lizenz-Status aktualisieren (z.B. bei Reaktivierung)

### 3. Stripe Service

Der `StripeService` in `apps/proxy-server/src/services/stripe-service.ts` wurde erweitert, um die `stripeCustomerId` aus der Checkout-Session zu extrahieren.

## Frontend-Integration

### 1. API Client

Der `LicenseApi` in `apps/desktop/src/lib/api/license-api.ts` hat eine neue Methode:

```typescript
public async createPortalSession(params: PortalSessionParams): Promise<PortalSessionResponse>
```

### 2. UI-Integration

Die License Settings Seite (`apps/desktop/src/pages/settings/license.tsx`) zeigt einen "Abo verwalten" Button für ACTIVE Lizenzen:

```tsx
{
  license.status === 'ACTIVE' && (
    <button onClick={handleManageSubscription} disabled={openingPortal}>
      {openingPortal ? 'Öffne Portal...' : 'Abo verwalten'}
    </button>
  );
}
```

## Deployment

### Pre-Deployment Checkliste

- [ ] **Environment Variables gesetzt**
  - Stripe Secret Key
  - Webhook Secret
  - Database URL
  - JWT Secret

- [ ] **Datenbank-Migration ausgeführt**
  - `stripeCustomerId` und `companyName` Spalten existieren
  - Index auf `stripeCustomerId` erstellt

- [ ] **Stripe Webhook registriert**
  - Production URL konfiguriert
  - Events abonniert (checkout, subscription)
  - Signing Secret hinterlegt

- [ ] **Billing Portal konfiguriert**
  - Features aktiviert (payment update, cancel, invoices)
  - Branding angepasst

- [ ] **Tests ausgeführt**
  - Backend-Tests: `pnpm --filter @voiceinvoice/proxy-server test`
  - Frontend-Tests: `pnpm --filter @voiceinvoice/desktop test`
  - TypeScript-Validierung: `pnpm typecheck`

### Backend-Deployment (Hetzner)

```bash
# SSH in Server
ssh user@your-server.com

# Repository aktualisieren
cd /path/to/voiceinvoice
git pull origin main

# Dependencies installieren
pnpm install

# Build
pnpm build

# Datenbank-Migration (VORSICHT: Backup vorher!)
cd packages/database
pnpm prisma migrate deploy

# Server neu starten
pm2 restart voiceinvoice-proxy

# Logs prüfen
pm2 logs voiceinvoice-proxy
```

### Frontend-Deployment (Electron App)

```bash
# Lokaler Build
cd apps/desktop
pnpm build:electron

# Installationspaket erstellen
# macOS: ./dist/VoiceInvoice-1.0.0.dmg
# Windows: ./dist/VoiceInvoice Setup 1.0.0.exe
# Linux: ./dist/VoiceInvoice-1.0.0.AppImage

# Auf Update-Server hochladen oder per Download verteilen
```

## Testing

### Manuelle Tests (Test-Modus)

1. **Checkout-Flow mit Stripe Test-Daten**
   - Karte: `4242 4242 4242 4242`
   - Ablaufdatum: Beliebig in der Zukunft
   - CVC: Beliebig
   - PLZ: Beliebig

2. **Portal-Zugriff**
   - Lizenz aktivieren
   - Auf "Abo verwalten" klicken
   - Überprüfen: Weiterleitung zu Stripe Portal
   - Überprüfen: Zahlungsmethoden sichtbar
   - Überprüfen: Rechnungen sichtbar

3. **Abo-Kündigung**
   - Im Portal auf "Cancel subscription" klicken
   - Bestätigen
   - Zurück zur App
   - Überprüfen: Status ist `EXPIRED`

4. **Webhook-Empfang**
   - Stripe CLI installieren: `stripe login`
   - Webhooks forwarden: `stripe listen --forward-to localhost:3001/api/stripe/webhook`
   - Event triggern: `stripe trigger customer.subscription.deleted`
   - Logs prüfen: Server empfängt Event und aktualisiert Lizenz

### Automatisierte Tests

```bash
# Backend-Tests
pnpm --filter @voiceinvoice/proxy-server test

# Frontend-Tests
pnpm --filter @voiceinvoice/desktop test

# E2E-Tests (wenn vorhanden)
pnpm test:e2e
```

## Monitoring & Debugging

### Backend-Logs

```bash
# PM2-Logs (Production)
pm2 logs voiceinvoice-proxy

# Nur Fehler
pm2 logs voiceinvoice-proxy --err

# Webhook-Events filtern
pm2 logs voiceinvoice-proxy | grep "Stripe webhook"
```

### Stripe Dashboard

- **Webhooks**: Dashboard → Developers → Webhooks → [Endpoint URL]
  - Delivery Status prüfen
  - Fehlgeschlagene Events neu senden
  - Response Logs einsehen

- **Portal Sessions**: Dashboard → Billing → Customer portal sessions
  - Aktive Sessions überwachen
  - Fehler bei Session-Erstellung sehen

- **Subscriptions**: Dashboard → Customers → [Customer] → Subscriptions
  - Status prüfen (active, canceled, past_due)
  - Zahlungshistorie einsehen

### Häufige Probleme

#### 1. "Invalid signature" Fehler

**Ursache**: Webhook Secret stimmt nicht überein oder ist falsch konfiguriert.

**Lösung**:

```bash
# Webhook Secret neu generieren
# Stripe Dashboard → Webhooks → [Endpoint] → Signing secret

# In .env aktualisieren
STRIPE_WEBHOOK_SECRET=whsec_new_secret_here

# Server neu starten
pm2 restart voiceinvoice-proxy
```

#### 2. "Unauthorized" bei Portal-Zugriff

**Ursache**: JWT-Token fehlt oder ist ungültig.

**Lösung**:

- Lizenz neu validieren
- JWT Secret in Backend korrekt gesetzt?
- Token im Browser (localStorage) vorhanden?

#### 3. License wird nicht aktualisiert nach Kündigung

**Ursache**: Webhook-Handler funktioniert nicht oder findet Lizenz nicht.

**Lösung**:

- Webhook-Logs prüfen
- `stripeCustomerId` in Datenbank vorhanden?
- `updateLicenseByStripeCustomerId` Methode implementiert?

#### 4. Portal-Button nicht sichtbar

**Ursache**: Lizenz-Status ist nicht `ACTIVE` oder `stripeCustomerId` fehlt.

**Lösung**:

- Lizenz-Status prüfen: `SELECT * FROM License WHERE licenseKey = '...'`
- `stripeCustomerId` sollte gesetzt sein nach Checkout
- Frontend-Logik prüft `license.status === 'ACTIVE'`

## Production-Ready Checkliste

Bevor du live gehst:

- [ ] **Stripe auf Live-Modus umstellen**
  - API Keys austauschen (sk*live*..., pk*live*...)
  - Webhook mit Production-URL neu registrieren
  - Billing Portal im Live-Modus konfigurieren

- [ ] **Security**
  - Environment Variables niemals committen
  - HTTPS für API-Endpoints (Let's Encrypt)
  - CORS korrekt konfiguriert
  - Rate Limiting aktiv (bereits in stripe.ts vorhanden)

- [ ] **Monitoring**
  - Sentry für Error Tracking einrichten
  - Stripe Webhook-Events überwachen
  - Datenbank-Backups automatisieren

- [ ] **Legal**
  - AGB aktualisieren (Abo-Bedingungen, Kündigungsfristen)
  - Datenschutzerklärung (Stripe-Datenverarbeitung)
  - Impressum mit Zahlungsanbieter-Infos

- [ ] **Dokumentation**
  - User-Facing Dokumentation erstellen (wie Abo verwalten?)
  - Support-Team briefen (häufige Fragen)
  - Rollback-Plan dokumentieren

## Rollback-Plan

Falls nach Deployment Probleme auftreten:

### 1. Hotfix für kritische Bugs

```bash
# Auf Server
git revert HEAD  # Letzten Commit rückgängig machen
pnpm install
pnpm build
pm2 restart voiceinvoice-proxy
```

### 2. Datenbank-Rollback (VORSICHT!)

```bash
# Backup wiederherstellen
pg_restore -d voiceinvoice backup_before_migration.sql

# Oder Migration rückgängig machen
cd packages/database
pnpm prisma migrate resolve --rolled-back migration_name
```

### 3. Feature-Flag (für zukünftige Updates)

```typescript
// In .env
ENABLE_STRIPE_PORTAL = false;

// In code
if (process.env.ENABLE_STRIPE_PORTAL === 'true') {
  // Portal-Funktionalität
}
```

## Support & Ressourcen

### Stripe-Dokumentation

- [Billing Portal Guide](https://stripe.com/docs/billing/subscriptions/integrating-customer-portal)
- [Webhook Events](https://stripe.com/docs/api/events/types)
- [Test Cards](https://stripe.com/docs/testing)

### VoiceInvoice-spezifisch

- [Error Handling Dokumentation](./stripe-portal-error-handling.md)
- [E2E Test Dokumentation](../apps/proxy-server/tests/integration/portal-flow.test.ts)

### Hilfe holen

- **Stripe Support**: https://support.stripe.com
- **VoiceInvoice Team**: support@voiceinvoice.com (fiktiv)

## Zusammenfassung

Die Stripe Customer Portal Integration ist vollständig implementiert:

✅ **Backend**

- Portal-Session Endpoint (`POST /api/stripe/portal`)
- Webhook-Handler für Subscription-Events
- Database-Schema mit `stripeCustomerId` und `companyName`

✅ **Frontend**

- API Client mit `createPortalSession()` Methode
- UI-Button "Abo verwalten" für ACTIVE Lizenzen
- Error Handling und Loading States

✅ **Testing**

- Unit-Tests für Backend-Services
- Integration-Test Dokumentation
- Manueller Test-Workflow definiert

✅ **Dokumentation**

- Error Handling Guide
- Integration & Deployment Guide (dieses Dokument)
- Code-Kommentare und JSDoc

**Nächste Schritte nach Deployment:**

1. Monitoring einrichten (Webhook-Success-Rate, Portal-Session-Errors)
2. User-Feedback sammeln (Portal-UX, fehlende Features)
3. Weitere Stripe-Features integrieren (Promo-Codes, Upgrade-Flows)
