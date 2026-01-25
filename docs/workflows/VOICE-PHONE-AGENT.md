# Voice-Triggered Phone Agent Workflow

Sprachgesteuerter Telefon-Agent für Kunden-Erinnerungen (Rechnungen & Termine).

## Stack-Optionen

| Option | STT | LLM | TTS | Latenz | Kosten | Workflow-Datei |
|--------|-----|-----|-----|--------|--------|----------------|
| **Gemini + ElevenLabs (empfohlen)** | Gemini 2.5 Native | Gemini 2.5 Flash | ElevenLabs Turbo v2.5 | ~300ms | ~€0.07/min | `voice-phone-agent-gemini-elevenlabs.json` |
| **OpenAI Realtime** | GPT-4o Native | GPT-4o Native | GPT-4o Native | ~400ms | ~€0.12/min | `voice-phone-agent-openai.json` |
| OpenAI Pipeline | Whisper | GPT-4o | OpenAI TTS | ~800ms | ~€0.08/min | `voice-phone-agent-openai.json` (Pipeline-Modus) |
| Legacy VAPI | Whisper | GPT-4o | VAPI/ElevenLabs | ~500ms | ~€0.09/min | `voice-triggered-phone-agent.json` |

**Aktuelle Empfehlung:** Gemini 2.5 Flash + ElevenLabs Conversational AI 2.0

### Provider-Vergleich

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           VOICE AGENT PROVIDER COMPARISON                        │
└─────────────────────────────────────────────────────────────────────────────────┘

Provider              │ Latenz    │ Voice Quality │ Control │ Preis   │ Best For
──────────────────────┼───────────┼───────────────┼─────────┼─────────┼─────────────
Gemini 2.5 Flash      │ ~250ms    │ ★★★☆☆         │ Medium  │ Low     │ Latency-kritisch
ElevenLabs Conv. AI   │ ~300ms    │ ★★★★★         │ Medium  │ Medium  │ Voice Quality
OpenAI Realtime       │ ~400ms    │ ★★★★☆         │ Medium  │ High    │ GPT-4o Reasoning
OpenAI Pipeline       │ ~800ms    │ ★★★★☆         │ High    │ Medium  │ Max. Kontrolle
```

### Warum diese Kombination?

1. **Gemini 2.5 Flash Native Audio** ([Docs](https://ai.google.dev/gemini-api/docs/live))
   - Direkte Audio-zu-Text Verarbeitung ohne separate STT
   - Native multimodale Fähigkeiten
   - Niedrigste Latenz für Intent-Erkennung

2. **ElevenLabs Conversational AI 2.0** ([Blog](https://elevenlabs.io/blog/conversational-ai-2-0))
   - Natürliches Turn-Taking (kein awkward silence)
   - Automatische Spracherkennung (Deutsch/Englisch)
   - Integrierte RAG für Wissensdatenbanken
   - Barge-in Detection
   - SOC 2, HIPAA, GDPR compliant

## Architektur

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VOICE-TRIGGERED PHONE AGENT                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ VoiceInvoice │───▶│   Webhook    │───▶│   Whisper    │───▶│    GPT-4     │
│  Desktop App │    │  Empfangen   │    │ Transkription│    │Intent+Entities│
└──────────────┘    └──────────────┘    └──────────────┘    └──────┬───────┘
                                                                    │
                    ┌───────────────────────────────────────────────┴───────┐
                    │                    SWITCH: Intent                      │
                    └───────────────────────────────────────────────┬───────┘
                                    │                               │
                    ┌───────────────┴───────────────┐   ┌──────────┴────────┐
                    │      "rechnung_erinnerung"    │   │ "termin_erinnerung"│
                    └───────────────┬───────────────┘   └──────────┬────────┘
                                    │                               │
                    ┌───────────────▼───────────────┐   ┌──────────▼────────┐
                    │   DB: Rechnungsdaten laden    │   │ DB: Termindaten   │
                    │   (Kunde, Betrag, Fälligkeit) │   │ (Datum, Ort, Desc)│
                    └───────────────┬───────────────┘   └──────────┬────────┘
                                    │                               │
                                    └───────────────┬───────────────┘
                                                    │
                                    ┌───────────────▼───────────────┐
                                    │  Code: Anruf-Script generieren │
                                    │  (Dynamisch basierend auf      │
                                    │   Intent + Dringlichkeit)      │
                                    └───────────────┬───────────────┘
                                                    │
                                    ┌───────────────▼───────────────┐
                                    │    VAPI: Telefon-Agent        │
                                    │    (ElevenLabs Voice + GPT-4) │
                                    └───────────────┬───────────────┘
                                                    │
                    ┌───────────────────────────────┴───────────────────────┐
                    │                                                       │
        ┌───────────▼───────────┐                           ┌───────────────▼──┐
        │  DB: Anruf loggen     │                           │  Response: JSON  │
        │  (call_id, status)    │                           │  an Desktop App  │
        └───────────────────────┘                           └──────────────────┘


                         ═══════════════════════════════
                              CALLBACK-VERARBEITUNG
                         ═══════════════════════════════

┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│VAPI Callback │───▶│   Switch:    │───▶│  DB: Status  │───▶│   GPT-4:     │
│  Webhook     │    │ Callback-Typ │    │ aktualisieren│    │  Analysieren │
└──────────────┘    └──────────────┘    └──────────────┘    └──────┬───────┘
                                                                    │
                                                    ┌───────────────▼───────┐
                                                    │   DB: Analyse         │
                                                    │   speichern           │
                                                    └───────────────┬───────┘
                                                                    │
                                                    ┌───────────────▼───────┐
                                                    │  IF: Follow-up nötig? │
                                                    └───────────────┬───────┘
                                                                    │ JA
                                                    ┌───────────────▼───────┐
                                                    │  Slack: Team          │
                                                    │  benachrichtigen      │
                                                    └───────────────────────┘
```

## Sprachbefehle (Beispiele)

| Befehl | Intent | Aktion |
|--------|--------|--------|
| "Ruf Müller GmbH an wegen der offenen Rechnung" | rechnung_erinnerung | Lädt Rechnungsdaten, ruft an |
| "Erinnere Kunde Schmidt an seinen Termin morgen" | termin_erinnerung | Lädt Termindaten, ruft an |
| "Dringende Mahnung an Firma Weber, Rechnung 2024-001" | rechnung_erinnerung (dringend) | Strengeres Script |
| "Freundliche Terminerinnerung für Frau Bauer" | termin_erinnerung (freundlich) | Sanfteres Script |

## Voraussetzungen

### 1. API-Schlüssel

```env
# .env - Gemini + ElevenLabs Stack (empfohlen)
GOOGLE_AI_API_KEY=AIza...              # Gemini 2.5 Flash
ELEVENLABS_API_KEY=sk_...              # ElevenLabs Conversational AI
ELEVENLABS_PHONE_NUMBER=+49...         # ElevenLabs Telefonnummer

# .env - OpenAI Stack (Alternative)
OPENAI_API_KEY=sk-...                  # OpenAI Realtime/Whisper/GPT-4/TTS
TWILIO_ACCOUNT_SID=AC...               # Twilio für Telefonate
TWILIO_AUTH_TOKEN=...                  # Twilio Auth
TWILIO_PHONE_NUMBER=+49...             # Twilio Telefonnummer

# Gemeinsam
SLACK_BOT_TOKEN=xoxb-...               # Slack Notifications
N8N_WEBHOOK_URL=https://...            # n8n Webhook Base URL

# Optional: Legacy VAPI Stack
VAPI_API_KEY=vapi-...                  # VAPI Telefon-Agent
VAPI_PHONE_NUMBER_ID=pn-...            # VAPI Telefonnummer
```

### 2. Datenbank-Schema

```sql
-- Kunden-Tabelle (falls nicht vorhanden)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Rechnungen-Tabelle
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id),
    invoice_number VARCHAR(50) UNIQUE,
    amount DECIMAL(10,2),
    due_date DATE,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Termine-Tabelle
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id),
    appointment_date DATE,
    appointment_time TIME,
    description TEXT,
    location VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Anruf-Protokoll
CREATE TABLE IF NOT EXISTS call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id),
    call_type VARCHAR(50),
    call_id VARCHAR(100),
    status VARCHAR(20),
    script_used TEXT,
    transcript TEXT,
    duration_seconds INTEGER,
    outcome_analysis TEXT,
    next_action TEXT,
    sentiment VARCHAR(20),
    initiated_at TIMESTAMP,
    ended_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 3. VAPI Konfiguration

1. Account erstellen: https://vapi.ai
2. Telefonnummer kaufen (DE: +49)
3. Webhook URL setzen: `https://your-n8n.com/webhook/vapi-webhook`

## Installation

### 1. Workflow importieren

```bash
# In n8n:
# Settings → Import from File → voice-triggered-phone-agent.json
```

### 2. Credentials einrichten

| Credential | Typ | Felder |
|------------|-----|--------|
| postgres-voiceinvoice | PostgreSQL | host, database, user, password |
| vapi-auth | HTTP Header Auth | Name: `Authorization`, Value: `Bearer {VAPI_API_KEY}` |
| slack-api | Slack API | Bot Token |

### 3. Webhook URLs konfigurieren

Nach Aktivierung des Workflows:

```
Sprachbefehl-Webhook: https://your-n8n.com/webhook/voice-command
VAPI-Callback:        https://your-n8n.com/webhook/vapi-webhook
```

## Integration mit VoiceInvoice Desktop

### API-Aufruf vom Desktop

```typescript
// apps/desktop/src/lib/phone-agent/phone-agent-client.ts

interface PhoneAgentRequest {
  audioData: string;  // Base64-encoded audio
}

interface PhoneAgentResponse {
  success: boolean;
  message: string;
  call_id: string;
  intent: 'rechnung_erinnerung' | 'termin_erinnerung';
  kunde_phone: string;
}

export async function triggerPhoneAgent(
  audioBlob: Blob
): Promise<PhoneAgentResponse> {
  const base64Audio = await blobToBase64(audioBlob);

  const response = await fetch(
    process.env.N8N_WEBHOOK_URL + '/voice-command',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audioData: base64Audio,
      }),
    }
  );

  return response.json();
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

### React Hook

```typescript
// apps/desktop/src/hooks/use-phone-agent.ts

import { useState } from 'react';
import { triggerPhoneAgent } from '../lib/phone-agent/phone-agent-client';

export function usePhoneAgent() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastCall, setLastCall] = useState<PhoneAgentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initiateCall = async (audioBlob: Blob) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await triggerPhoneAgent(audioBlob);
      setLastCall(response);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anruf fehlgeschlagen');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    initiateCall,
    isLoading,
    lastCall,
    error,
  };
}
```

## Anruf-Scripts

### Rechnungserinnerung (Normal)

```
Guten Tag, hier spricht der automatische Assistent von [Firmenname].

Ich rufe an bezüglich der Rechnung Nummer {invoice_number}
über {amount} Euro, fällig am {due_date}.

Könnten Sie mir bitte mitteilen, wann wir mit der Zahlung rechnen können?

[WARTE AUF ANTWORT]

Vielen Dank für die Information. Haben Sie noch Fragen zur Rechnung?

[WARTE AUF ANTWORT]

Wunderbar, ich wünsche Ihnen noch einen schönen Tag. Auf Wiederhören.
```

### Rechnungserinnerung (Dringend)

```
Guten Tag, hier spricht der automatische Assistent von [Firmenname].

Es ist dringend, dass wir über die überfällige Rechnung Nummer {invoice_number}
über {amount} Euro sprechen. Die Fälligkeit war am {due_date}.

Wann können wir mit dem Zahlungseingang rechnen?

[WARTE AUF ANTWORT]

...
```

### Terminerinnerung

```
Guten Tag, hier spricht der automatische Assistent von [Firmenname].

Ich möchte Sie freundlich an Ihren Termin am {appointment_date}
um {appointment_time} Uhr erinnern.

Der Termin findet statt bei: {location}
Betreff: {description}

Können Sie den Termin bestätigen?

[WARTE AUF ANTWORT]

Perfekt, vielen Dank. Wir freuen uns auf Sie. Auf Wiederhören.
```

## Outcome-Analyse

Der GPT-4 Analyzer kategorisiert Anrufergebnisse:

| Outcome | Beschreibung | Follow-up |
|---------|--------------|-----------|
| `zahlung_zugesagt` | Kunde hat Zahlung versprochen | Zahlungseingang prüfen |
| `termin_bestaetigt` | Termin wurde bestätigt | Keine Aktion |
| `rueckruf_gewuenscht` | Kunde möchte zurückgerufen werden | Slack-Notification |
| `nicht_erreicht` | Anruf nicht angenommen | Erneut versuchen |
| `abgelehnt` | Kunde lehnt ab | Eskalation |

## Kosten-Schätzung

### Gemini + ElevenLabs Stack (empfohlen)

| Service | Kosten | Pro Anruf (1 Min) |
|---------|--------|-------------------|
| Gemini 2.5 Flash (Audio + Intent) | $0.015/min | $0.015 |
| ElevenLabs Conversational AI | $0.05/min | $0.05 |
| **Gesamt** | | **~€0.07/Anruf** |

### Legacy VAPI Stack

| Service | Kosten | Pro Anruf (1 Min) |
|---------|--------|-------------------|
| Whisper | $0.006/min | $0.006 |
| GPT-4 (Intent) | ~$0.01 | $0.01 |
| VAPI | $0.05/min | $0.05 |
| GPT-4 (Analyse) | ~$0.02 | $0.02 |
| **Gesamt** | | **~$0.09/Anruf** |

## Voice Agent Factory (TypeScript)

Die `VoiceAgentFactory` bietet ein einheitliches Interface für alle Provider:

```typescript
import { VoiceAgentFactory, type VoiceAgentProvider } from '@/lib/voice-agent';

// Provider auswählen
const provider: VoiceAgentProvider = 'gemini'; // oder 'elevenlabs', 'openai-realtime', 'openai-pipeline'

// Agent erstellen
const agent = VoiceAgentFactory.create({
  provider,
  apiKey: process.env.GOOGLE_AI_API_KEY!,
  voice: 'Kore',
  systemInstruction: 'Du bist ein freundlicher Telefon-Assistent für Rechnungserinnerungen.',
  language: 'de-DE',
  tools: [{
    name: 'record_outcome',
    description: 'Speichert das Ergebnis des Gesprächs',
    parameters: {
      type: 'object',
      properties: {
        outcome: { type: 'string', enum: ['payment_promised', 'callback_requested', 'dispute'] },
        notes: { type: 'string' }
      },
      required: ['outcome']
    }
  }]
});

// Events abonnieren
agent.on('connected', () => console.log('Verbunden'));
agent.on('transcribed', (text, isFinal) => console.log('Kunde:', text));
agent.on('responseText', (text) => console.log('Agent:', text));
agent.on('responseAudio', (audio) => playAudio(audio));
agent.on('functionCall', (name, callId, args) => {
  // Tool-Aufruf verarbeiten
  agent.sendFunctionResult(callId, { success: true });
});

// Verbinden und Audio senden
await agent.connect();
agent.sendAudio(audioBuffer);

// Empfehlung basierend auf Anforderungen
const recommended = VoiceAgentFactory.recommend({
  prioritizeLatency: true,    // → 'gemini'
  prioritizeVoiceQuality: true, // → 'elevenlabs'
  prioritizeControl: true,    // → 'openai-pipeline'
  prioritizeCost: true        // → 'gemini'
});
```

### Provider-Charakteristiken

```typescript
const characteristics = VoiceAgentFactory.getCharacteristics('gemini');
// {
//   name: 'Gemini 2.5 Flash Live',
//   latency: '~250ms',
//   voiceQuality: 'Good',
//   control: 'Medium',
//   cost: 'Low',
//   strengths: ['Lowest latency', 'Native audio understanding', 'Good German'],
//   weaknesses: ['Fewer voice options', 'Less natural prosody']
// }
```

## OpenAI Realtime API Details

Der OpenAI Stack nutzt die GPT-4o Realtime API für native Audio-Verarbeitung:

### Realtime-Modus (empfohlen)
- WebSocket-basiert für Echtzeit-Streaming
- Native Audio-Verständnis (kein separates STT)
- Server-seitige VAD (Voice Activity Detection)
- Barge-in Support durch `cancelResponse()`

### Pipeline-Modus (für mehr Kontrolle)
- Whisper STT → GPT-4o → OpenAI TTS
- Höhere Latenz (~800-1200ms)
- Volle Kontrolle über jeden Schritt
- Ideal für Debugging und komplexe Logik

### n8n Workflow (OpenAI)

```bash
# Import
n8n import:workflow --input=voice-phone-agent-openai.json
```

Webhooks:
- `POST /voice-command-openai` - Sprachbefehl empfangen
- `POST /openai-realtime-twiml` - TwiML für Twilio
- `POST /call-status-openai` - Anruf-Status Updates
- `POST /openai-function-result` - Function Call Ergebnisse

## Erweiterungsmöglichkeiten

1. **SMS-Fallback**: Wenn Anruf nicht angenommen, SMS senden
2. **Email-Follow-up**: Nach Anruf automatisch Zusammenfassung per Email
3. **Kalender-Integration**: Terminbestätigungen in Google Calendar
4. **CRM-Sync**: Anrufprotokolle in HubSpot/Salesforce
5. **Multi-Language**: Englische Scripts für internationale Kunden
6. **Sentiment-Dashboard**: Visualisierung der Kundenstimmung über Zeit
7. **Provider-Fallback**: Automatischer Wechsel bei Provider-Ausfall
