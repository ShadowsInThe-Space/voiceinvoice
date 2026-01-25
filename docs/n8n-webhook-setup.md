# n8n Webhook Setup für VoiceInvoice

Diese Anleitung beschreibt, wie die Webhook-Trigger für die 10 KMU-Workflows in n8n konfiguriert werden.

## Voraussetzungen

- n8n läuft auf `http://localhost:5678`
- Die 10 Workflows sind bereits erstellt

## Webhook-Endpoints

Jeder Workflow benötigt einen Webhook-Node als Trigger mit folgendem Pfad:

| Workflow                    | Webhook-Pfad                   |
| --------------------------- | ------------------------------ |
| 01-Rechnungseingangs-Agent  | `/webhook/rechnungseingang`    |
| 02-Mahnwesen-Agent          | `/webhook/mahnwesen`           |
| 03-Zahlungsabgleich-Agent   | `/webhook/zahlungsabgleich`    |
| 04-Ausgaben-Kategorisierung | `/webhook/ausgaben`            |
| 05-Monatsabschluss-Report   | `/webhook/monatsreport`        |
| 06-Lead-Qualifizierung      | `/webhook/lead-qualifizierung` |
| 07-Follow-up-Agent          | `/webhook/follow-up`           |
| 08-Kundenfeedback-Sammler   | `/webhook/kundenfeedback`      |
| 09-Vertrags-Erinnerung      | `/webhook/vertrags-erinnerung` |
| 10-Kundenanfragen-Router    | `/webhook/kundenanfragen`      |

## Schritt-für-Schritt Anleitung

### 1. Workflow öffnen

1. Öffne n8n unter http://localhost:5678
2. Navigiere zu einem Workflow (z.B. "01-Rechnungseingangs-Agent")

### 2. Webhook-Node hinzufügen

1. Klicke auf **"+ Add first step"** oder **"+"** am Anfang des Workflows
2. Suche nach **"Webhook"**
3. Wähle **"Webhook"** (nicht "Webhook Trigger")

### 3. Webhook konfigurieren

1. **HTTP Method**: `POST`
2. **Path**: Den Pfad aus der Tabelle oben (z.B. `rechnungseingang`)
3. **Authentication**: `None` (für lokale Entwicklung)
4. **Response Code**: `200`
5. **Response Data**: `Last Node`

### 4. Response-Node hinzufügen

Am Ende des Workflows einen **"Respond to Webhook"** Node hinzufügen:

```json
{
  "success": true,
  "message": "{{ $json.resultMessage }}",
  "data": {
    "processedItems": "{{ $json.count }}",
    "details": "{{ $json.details }}"
  }
}
```

### 5. Workflow aktivieren

1. Klicke auf den Toggle **"Active"** oben rechts
2. Der Workflow ist nun unter der Production-URL erreichbar

## Webhook-URLs

Nach der Aktivierung sind die Webhooks erreichbar unter:

- **Test-URL**: `http://localhost:5678/webhook-test/<path>`
- **Production-URL**: `http://localhost:5678/webhook/<path>`

Beispiel:

```
POST http://localhost:5678/webhook/mahnwesen
Content-Type: application/json

{
  "intent": "WORKFLOW_MAHNWESEN",
  "workflowName": "Mahnwesen-Agent",
  "triggeredAt": "2026-01-25T03:20:00.000Z",
  "params": {
    "transcription": "Prüfe überfällige Rechnungen"
  }
}
```

## VoiceInvoice Konfiguration

In der App die Workflows aktivieren:

```javascript
// In der Browser-Console oder Settings-Seite:
localStorage.setItem('voiceinvoice_workflows_enabled', 'true');
localStorage.setItem('voiceinvoice_workflows_base_url', 'http://localhost:5678');
```

## Response-Format

Die Workflows sollten JSON mit diesem Format zurückgeben:

```json
{
  "success": true,
  "message": "3 überfällige Rechnungen gefunden. Mahnungen wurden erstellt.",
  "data": {
    "count": 3,
    "invoices": [...]
  }
}
```

Das `message`-Feld wird für die Sprachausgabe verwendet.

## Troubleshooting

### Webhook nicht erreichbar

- Prüfe ob der Workflow **aktiviert** ist
- Prüfe den korrekten Pfad (ohne führenden Slash im n8n Node)
- Test mit: `curl -X POST http://localhost:5678/webhook/mahnwesen -H "Content-Type: application/json" -d '{}'`

### Timeout

- Workflows haben ein Standard-Timeout von 30 Sekunden
- Für längere Operationen: Async-Pattern mit Callback verwenden

### CORS-Fehler

- n8n erlaubt standardmäßig alle Origins
- Bei Problemen: `N8N_CORS_ORIGIN=*` in den Environment-Variablen setzen
