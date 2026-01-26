# Audio Transkriptions-API – Architektur & Verwendung

**Letzte Aktualisierung:** 2026-01-26

---

## 📋 Übersicht

VoiceInvoice Enterprise implementiert **zwei parallele Transkriptions-Endpunkte** für unterschiedliche Deployment-Szenarien:

1. **Desktop-App (lokal):** Next.js API Route `/api/speech/transcribe`
2. **Proxy-Server (Hetzner):** Fastify Route `POST /transcribe`

Diese Dual-Architektur ermöglicht sowohl Offline-Betrieb der Desktop-App als auch zentrale API-Nutzung für zukünftige Web-Clients.

---

## 🏗️ Architektur-Entscheidung

### Warum zwei Endpunkte?

| Aspekt                | Desktop-Lösung             | Proxy-Lösung                  |
| --------------------- | -------------------------- | ----------------------------- |
| **Offline-Fähigkeit** | ✅ Funktioniert ohne Proxy | ❌ Benötigt Server-Verbindung |
| **Latenz**            | ⚡ Direkt zu Google Cloud  | 🔄 Via Proxy-Server           |
| **Privacy**           | 🔒 Audio nur zu Google     | 🔒 Audio via Proxy zu Google  |
| **Use Case**          | Desktop-Electron-App       | Web-Browser, Mobile Apps      |
| **Lizenzierung**      | Optional (Demo-Modus)      | Zentral via JWT + Quota       |
| **Multi-Tenancy**     | Nicht relevant             | ✅ PostgreSQL-basiert         |

### Architektur-Prinzip

**Offline-First für Desktop, Cloud-Ready für Web:**

- Desktop-App bevorzugt Unabhängigkeit und Performance
- Proxy-Server ermöglicht zentrale Kontrolle für SaaS-Betrieb

---

## 🖥️ Desktop-App Endpunkt

### API Route

**Pfad:** `/api/speech/transcribe`
**Datei:** `apps/desktop/src/pages/api/speech/transcribe.ts`

### Request

```http
POST /api/speech/transcribe HTTP/1.1
Content-Type: application/json

{
  "audio": "base64-encoded-audio-data",
  "mimeType": "audio/webm"
}
```

### Response

```json
{
  "success": true,
  "text": "Transkribierter Text hier",
  "confidence": 0.92,
  "method": "chirp3"
}
```

### Implementierung

```typescript
// apps/desktop/src/pages/api/speech/transcribe.ts
import { transcribeAudio, isChirp3Available } from '@/lib/speech/chirp3-client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { audio, mimeType } = req.body;

  if (!isChirp3Available()) {
    res.status(503).json({
      success: false,
      error: 'Chirp 3 not configured. Set GOOGLE_CLOUD_PROJECT and CHIRP3_RECOGNIZER.',
    });
    return;
  }

  const audioBuffer = Buffer.from(audio, 'base64');
  const result = await transcribeAudio(audioBuffer);

  res.status(200).json({
    success: true,
    text: result.text,
    confidence: result.confidence,
    method: 'chirp3',
  });
}
```

### Verwendung in der Pipeline

```typescript
// apps/desktop/src/lib/ai/gemini-client.ts
async transcribe(audioBase64: string, mimeType: string) {
  // Versucht zuerst Chirp 3 via lokale API Route
  const response = await fetch('/api/speech/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio: audioBase64, mimeType }),
  });

  if (response.ok) {
    const data = await response.json();
    return { success: true, text: data.text, confidence: data.confidence };
  }

  // Fallback zu Gemini Multimodal
  return this.transcribeWithGeminiFlash(audioBase64, mimeType);
}
```

### Umgebungsvariablen

```bash
# .env oder .env.local
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=eu
CHIRP3_RECOGNIZER=invoice-recognizer-de
```

### Features

✅ **Direkte Google Cloud Speech API Integration**
✅ **Chirp 3 mit Speech Adaptation (Invoice-spezifische Begriffe)**
✅ **Automatischer Fallback zu Gemini Multimodal**
✅ **Offline-Fähigkeit** (wenn ADC konfiguriert)
✅ **Niedrige Latenz** (kein Proxy-Overhead)

---

## 🌐 Proxy-Server Endpunkt

### API Route

**Pfad:** `POST /transcribe`
**Server:** `https://api.shadowsinthe.space/transcribe`
**Datei:** `apps/proxy-server/src/routes/transcribe.ts`

### Request

```http
POST /transcribe HTTP/1.1
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>

{
  "audio": "base64-encoded-audio-data",
  "language": "de-DE",
  "format": "webm"
}
```

### Response

```json
{
  "transcript": "Transkribierter Text hier",
  "confidence": 0.92
}
```

### Implementierung

```typescript
// apps/proxy-server/src/routes/transcribe.ts
export async function registerTranscribeRoutes(server: FastifyInstance) {
  server.post('/transcribe', async (request, reply) => {
    const { audio, language, format } = request.body;

    const audioBuffer = Buffer.from(audio, 'base64');
    const result = await transcribeAudio(audioBuffer, { language, format });

    return reply.status(200).send({
      transcript: result.transcript,
      confidence: result.confidence,
    });
  });
}
```

### Middleware (Production)

```typescript
// Mit Lizenz-Authentifizierung und Quota-Tracking
server.post(
  '/transcribe',
  {
    preHandler: [
      createLicenseAuthHook(), // JWT Token validieren
      createQuotaCheckHook(), // Quota prüfen und tracken
    ],
  },
  transcribeHandler
);
```

### Features

✅ **Multi-Tenant-fähig** (PostgreSQL)
✅ **Quota-Enforcement** (Monatslimits)
✅ **Zentrale API-Key-Verwaltung**
✅ **Logging & Monitoring**
✅ **Rate Limiting**
🔄 **Aktuell nicht von Desktop-App genutzt** (nur für zukünftige Web-Clients)

---

## 🔄 Datenfluss-Vergleich

### Desktop-App Flow

```
User spricht
  ↓
Browser MediaRecorder API
  ↓
Base64-Encoding (Client)
  ↓
/api/speech/transcribe (Next.js API Route im Electron-Prozess)
  ↓
chirp3-client.ts (lokal)
  ↓
Google Cloud Speech API (Chirp 3)
  ↓
Transkript zurück an Client
```

### Proxy-Server Flow (zukünftig für Web-Clients)

```
User spricht (Web-Browser)
  ↓
Browser MediaRecorder API
  ↓
Base64-Encoding (Client)
  ↓
POST /transcribe (via HTTPS zu api.shadowsinthe.space)
  ↓
Fastify Route Handler
  ↓
speech-service.ts (Server)
  ↓
Google Cloud Speech API (Chirp 3)
  ↓
Transkript zurück an Web-Client
```

---

## 📊 Status & Verwendung

| Endpunkt                           | Status                      | Genutzt von            | Deployment        |
| ---------------------------------- | --------------------------- | ---------------------- | ----------------- |
| `/api/speech/transcribe` (Desktop) | ✅ Aktiv                    | Desktop-App            | Electron-Bundle   |
| `POST /transcribe` (Proxy)         | ✅ Vorhanden, nicht genutzt | Zukünftige Web-Clients | Hetzner Frankfurt |

---

## 🚀 Migration zu Production-SaaS

Für die Umstellung auf ein vollständiges SaaS-Modell:

### Option 1: Desktop-App auf Proxy umstellen

```typescript
// apps/desktop/src/lib/ai/gemini-client.ts
const PROXY_API = 'https://api.shadowsinthe.space';

async transcribe(audioBase64: string, mimeType: string) {
  const response = await fetch(`${PROXY_API}/transcribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.jwtToken}`,
    },
    body: JSON.stringify({
      audio: audioBase64,
      language: 'de-DE',
      format: mimeType.split('/')[1],
    }),
  });

  if (response.ok) {
    const data = await response.json();
    return { success: true, text: data.transcript, confidence: data.confidence };
  }

  // Fallback zu lokaler Implementierung
  return this.transcribeWithLocalChirp(audioBase64, mimeType);
}
```

### Option 2: Hybrid-Modus (empfohlen)

```typescript
// Desktop-App nutzt lokalen Endpunkt als Fallback
// Primär wird Proxy verwendet, bei Offline-Betrieb lokale API
const useProxy = navigator.onLine && this.licenseService.isValid();

if (useProxy) {
  result = await this.transcribeViaProxy(audioBase64, mimeType);
} else {
  result = await this.transcribeLocal(audioBase64, mimeType);
}
```

---

## 🔧 Konfiguration & Setup

### Desktop-App

```bash
# Lokale Entwicklung
cd apps/desktop
cp .env.example .env

# Erforderliche Variablen
GOOGLE_CLOUD_PROJECT=your-project-id
CHIRP3_RECOGNIZER=invoice-recognizer-de
```

### Proxy-Server

```bash
# Production-Deployment
cd apps/proxy-server
cp .env.example .env

# Erforderliche Variablen
GOOGLE_CLOUD_PROJECT=your-project-id
CHIRP3_RECOGNIZER=invoice-recognizer-de
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret
```

---

## 📝 ADR (Architecture Decision Record)

**Datum:** 2026-01-26
**Status:** Akzeptiert
**Kontext:** Transkriptions-Architektur für Desktop- und Web-Clients

**Entscheidung:**
Implementierung zweier paralleler Transkriptions-Endpunkte statt zentraler Lösung.

**Begründung:**

1. **Desktop-First:** Offline-Fähigkeit ist Core-Feature
2. **Performance:** Direkter API-Zugriff reduziert Latenz
3. **Privacy:** Audio verlässt Gerät minimal (nur zu Google, nicht zu eigenem Server)
4. **Zukunftssicherheit:** Proxy-Endpunkt ermöglicht Web-Version ohne Refactoring

**Konsequenzen:**

- ✅ Desktop-App funktioniert offline
- ✅ Web-Version kann ohne Code-Änderung entwickelt werden
- ⚠️ Code-Duplikation zwischen Desktop und Proxy
- ⚠️ Zwei Konfigurationspfade müssen gepflegt werden

---

## 📚 Weiterführende Dokumentation

- [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) - Deployment-Status
- [chirp3-client.ts](../apps/desktop/src/lib/speech/chirp3-client.ts) - Desktop-Implementierung
- [transcribe.ts (proxy)](../apps/proxy-server/src/routes/transcribe.ts) - Server-Implementierung
- [speech-service.ts](../apps/proxy-server/src/services/speech-service.ts) - Server-Service-Layer

---

## 🐛 Troubleshooting

### Desktop-App: "Chirp 3 not configured"

**Problem:** Umgebungsvariablen fehlen oder sind ungültig.

**Lösung:**

```bash
# Prüfen ob Variablen gesetzt sind
echo $GOOGLE_CLOUD_PROJECT
echo $CHIRP3_RECOGNIZER

# ADC konfigurieren (falls noch nicht geschehen)
gcloud auth application-default login
```

### Proxy-Server: 503 Service Unavailable

**Problem:** Google Cloud Credentials fehlen am Server.

**Lösung:**

```bash
# Service Account Key hinterlegen
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# Oder ADC verwenden
gcloud auth application-default login
```

### Hohe Latenz bei Transkription

**Problem:** Netzwerk-Latenz oder Audio zu groß.

**Lösung:**

- Audio-Format optimieren (WebM Opus statt WAV)
- Audio-Kompression erhöhen
- Regional endpoint nutzen (eu-speech.googleapis.com)

---

**Fragen?** Siehe [CLAUDE.md](../CLAUDE.md) für Entwickler-Workflows.
