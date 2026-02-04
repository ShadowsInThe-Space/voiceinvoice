# Environment Variables

**Aktuelle Dokumentation:** 2026-02-04

Dieses Dokument bündelt alle Umgebungsvariablen nach Komponenten. Verwende die jeweiligen `.env.example` Dateien als Vorlage und halte sie synchron zu den Codepfaden.

---

## Desktop App (Electron + Next.js)

**Datei:** `apps/desktop/.env.example`

### Core

| Variable | Zweck | Pflicht |
| --- | --- | --- |
| `DATABASE_URL` | Lokale SQLite DB | ✅ |
| `NEXT_PUBLIC_API_URL` | Proxy-Server Base URL | ✅ |

### Google AI / Gemini

| Variable | Zweck | Pflicht |
| --- | --- | --- |
| `NEXT_PUBLIC_GOOGLE_API_KEY` | Google AI API Key (Client) | ✅ |
| `GEMINI_API_KEY` | Serverseitiger Gemini Key (Fallback) | ⛔️ |
| `NEXT_PUBLIC_DEMO_API_KEY` | Demo-Modus Key | ⛔️ |

### Chirp 3 / Speech-to-Text

| Variable | Zweck | Pflicht |
| --- | --- | --- |
| `GOOGLE_CLOUD_PROJECT` | GCP Project ID | ⛔️ |
| `GOOGLE_CLOUD_LOCATION` | Region (z.B. `eu`) | ⛔️ |
| `CHIRP3_RECOGNIZER` | Chirp 3 Recognizer ID | ⛔️ |
| `NEXT_PUBLIC_GOOGLE_CLOUD_PROJECT` | GCP Project ID (Client) | ⛔️ |
| `NEXT_PUBLIC_GOOGLE_CLOUD_LOCATION` | Region (Client) | ⛔️ |
| `NEXT_PUBLIC_CHIRP3_RECOGNIZER` | Recognizer ID (Client) | ⛔️ |

### Supabase / RAG

| Variable | Zweck | Pflicht |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL (Client) | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key (Client) | ✅ |
| `SUPABASE_URL` | Supabase URL (Server) | ⛔️ |
| `SUPABASE_ANON_KEY` | Supabase Anon Key (Server) | ⛔️ |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role (Server) | ⛔️ |
| `SUPABASE_KEY` | Legacy Key (Server) | ⛔️ |

### n8n Webhooks

| Variable | Zweck | Pflicht |
| --- | --- | --- |
| `NEXT_PUBLIC_N8N_CHAT_WEBHOOK` | Chat Webhook URL | ⛔️ |
| `NEXT_PUBLIC_N8N_INGEST_WEBHOOK` | Ingest Webhook URL | ⛔️ |
| `NEXT_PUBLIC_N8N_WEBHOOK_URL` | n8n Base URL | ⛔️ |
| `N8N_CHAT_WEBHOOK` | Chat Webhook (Server) | ⛔️ |
| `N8N_INGEST_WEBHOOK` | Ingest Webhook (Server) | ⛔️ |
| `N8N_WEBHOOK_RECHNUNGSEINGANG` | Workflow Rechnungs-Eingang | ⛔️ |
| `N8N_WEBHOOK_MAHNWESEN` | Workflow Mahnwesen | ⛔️ |

### Voice Agent Provider

| Variable | Zweck | Pflicht |
| --- | --- | --- |
| `GOOGLE_AI_API_KEY` | Gemini 2.5 Flash (Voice Agent) | ⛔️ |
| `OPENAI_API_KEY` | OpenAI Realtime/Whisper | ⛔️ |
| `ELEVENLABS_API_KEY` | ElevenLabs Conversational | ⛔️ |

### Electron Dev

| Variable | Zweck | Pflicht |
| --- | --- | --- |
| `ELECTRON_DEV_URL` | Lokale Dev URL | ⛔️ |

---

## Proxy Server (Fastify)

**Datei:** `apps/proxy-server/.env.example`

### Core

| Variable | Zweck | Pflicht |
| --- | --- | --- |
| `PORT` | Server Port | ✅ |
| `HOST` | Bind Address | ✅ |
| `NODE_ENV` | Environment | ✅ |
| `RATE_LIMIT` | Requests pro Minute | ✅ |
| `ENABLE_LOGGING` | Logging Toggle | ✅ |
| `CORS_ORIGIN` | Erlaubte Origins | ✅ |
| `DATABASE_URL` | PostgreSQL Connection | ✅ |

### Google AI / Speech

| Variable | Zweck | Pflicht |
| --- | --- | --- |
| `GOOGLE_API_KEY` | Google AI API Key | ✅ |
| `GOOGLE_CLOUD_PROJECT` | GCP Project ID | ⛔️ |
| `GOOGLE_CLOUD_LOCATION` | Region | ⛔️ |
| `CHIRP3_RECOGNIZER` | Chirp 3 Recognizer ID | ⛔️ |
| `GEMINI_API_KEY` | Gemini API Key (Fallback) | ⛔️ |

### Supabase

| Variable | Zweck | Pflicht |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase URL | ✅ |
| `SUPABASE_ANON_KEY` | Supabase Anon Key | ⛔️ |
| `SUPABASE_KEY` | Legacy Key | ⛔️ |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role | ✅ |

### Stripe / Licensing

| Variable | Zweck | Pflicht |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Stripe Secret Key | ✅ |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook Secret | ✅ |
| `JWT_SECRET` | JWT Sign/Verify | ✅ |

### TLS (nur Dev)

| Variable | Zweck | Pflicht |
| --- | --- | --- |
| `NODE_TLS_REJECT_UNAUTHORIZED` | TLS Strictness (0/1) | ⛔️ |

---

## Ops / Docker

**Datei:** `ops/.env.example`

| Variable | Zweck | Pflicht |
| --- | --- | --- |
| `POSTGRES_USER` | DB User | ✅ |
| `POSTGRES_PASSWORD` | DB Password | ✅ |
| `POSTGRES_DB` | DB Name | ✅ |
| `GOOGLE_API_KEY` | Google AI API Key | ✅ |
| `GOOGLE_CLOUD_PROJECT` | GCP Project ID | ⛔️ |
| `GOOGLE_CLOUD_LOCATION` | Region | ⛔️ |
| `CHIRP3_RECOGNIZER` | Chirp 3 Recognizer ID | ⛔️ |
| `CORS_ORIGIN` | CORS Origins | ✅ |
| `STRIPE_SECRET_KEY` | Stripe Secret Key | ✅ |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook Secret | ✅ |
| `JWT_SECRET` | JWT Secret | ✅ |

---

## n8n (Production)

**Datei:** `ops/n8n/.env.production.example`

| Variable | Zweck | Pflicht |
| --- | --- | --- |
| `N8N_BASIC_AUTH_USER` | Basic Auth User | ✅ |
| `N8N_BASIC_AUTH_PASSWORD` | Basic Auth Password | ✅ |
| `N8N_ENCRYPTION_KEY` | Encryption Key | ✅ |

---

## Voice Phone Agent (Workflow)

**Dokument:** `docs/workflows/VOICE-PHONE-AGENT.md`

| Variable | Zweck | Pflicht |
| --- | --- | --- |
| `GOOGLE_AI_API_KEY` | Gemini 2.5 Flash | ⛔️ |
| `ELEVENLABS_API_KEY` | ElevenLabs Conversational | ⛔️ |
| `ELEVENLABS_PHONE_NUMBER` | ElevenLabs Phone Number | ⛔️ |
| `OPENAI_API_KEY` | OpenAI Stack | ⛔️ |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | ⛔️ |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | ⛔️ |
| `TWILIO_PHONE_NUMBER` | Twilio Phone Number | ⛔️ |
| `SLACK_BOT_TOKEN` | Slack Notifications | ⛔️ |
| `N8N_WEBHOOK_URL` | n8n Base URL | ⛔️ |
| `VAPI_API_KEY` | Legacy VAPI Stack | ⛔️ |
| `VAPI_PHONE_NUMBER_ID` | Legacy VAPI Phone Number ID | ⛔️ |
