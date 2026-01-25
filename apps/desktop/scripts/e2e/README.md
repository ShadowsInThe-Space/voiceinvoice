# E2E Test Suite - VoiceInvoice Enterprise

Umfassende End-to-End-Tests für alle kritischen User-Flows.

## 🎯 Test-Abdeckung

| Test                   | Beschreibung                                    | Validierung                         |
| ---------------------- | ----------------------------------------------- | ----------------------------------- |
| **Voice-to-Invoice**   | Voice Recording → Transkription → AI-Extraktion | Auto-Save, Privacy Redaction        |
| **Invoice Management** | CRUD Operations für Rechnungen                  | Create, Edit, PDF Export, Mahnungen |
| **RAG Chat**           | Chat-Interface mit AI-Antworten                 | Message Senden, Kontext-Verständnis |
| **Settings**           | Workflow-Konfiguration                          | Einstellungen Persistenz            |

## 🚀 Schnellstart

### Voraussetzungen

1. **Development Server muss laufen:**

   ```bash
   pnpm dev:electron
   ```

2. **Playwright installieren:**

   ```bash
   pip install playwright
   playwright install chromium
   ```

3. **Environment-Variablen konfiguriert** (`.env`):
   - `GEMINI_API_KEY`
   - `NEXT_PUBLIC_N8N_CHAT_WEBHOOK`
   - Supabase-Keys

### Alle Tests ausführen

```bash
# Option 1: Mit laufendem Server
cd apps/desktop
python3 scripts/e2e/run_all_tests.py

# Option 2: Automatischer Server-Start
python3 scripts/with_server.py \
  --server "pnpm dev:electron" \
  --port 3002 \
  -- python3 scripts/e2e/run_all_tests.py
```

### Einzelne Tests ausführen

```bash
# Voice-to-Invoice
python3 scripts/e2e/test_voice_to_invoice.py

# Invoice Management
python3 scripts/e2e/test_invoice_management.py

# RAG Chat
python3 scripts/e2e/test_rag_chat.py

# Settings
python3 scripts/e2e/test_settings.py
```

## 📸 Screenshots & Artefakte

Alle Test-Ergebnisse werden in `test-results/` gespeichert:

```
test-results/
├── voice_invoice_initial.png
├── voice_recording_active.png
├── invoice_form_filled.png
├── chat_response.png
├── settings_saved.png
└── *_failure.png  (bei Fehlern)
```

## 🔍 Test-Details

### Test 1-3: Voice-to-Invoice Pipeline

**Was wird getestet:**

- Voice Recorder Button erkannt
- Recording-Simulation funktioniert
- Transcription API-Calls werden gemacht
- Form wird mit AI-extrahierten Daten befüllt
- Privacy Engine anonymisiert sensible Daten

**Erwartete API-Calls:**

- POST zu Chirp 3 Transcription
- POST zu Gemini Entity Extraction

### Test 4-7: Invoice Management

**Was wird getestet:**

- Neue Rechnung manuell erstellen
- Rechnung in Liste anzeigen
- Rechnung bearbeiten (Betrag ändern)
- PDF exportieren

**Validierung:**

- Daten in DB persistiert
- PDF-Download erfolgreich

### Test 8-9: RAG Chat

**Was wird getestet:**

- Chat-Nachricht senden
- AI-Antwort empfangen
- Folge-Frage mit Kontext

**Erwartete Webhooks:**

- POST zu n8n Chat Webhook

### Test 10: Settings

**Was wird getestet:**

- Einstellungen ändern
- Speichern
- Nach Reload noch vorhanden

## 🐛 Debugging

### Fehlgeschlagene Tests analysieren

1. **Screenshots prüfen:**

   ```bash
   ls -lh test-results/
   ```

2. **Console-Errors:**
   Tests loggen alle Console-Errors automatisch

3. **Network-Requests:**
   Tests tracken API-Calls zu n8n/Gemini/Chirp

### Häufige Probleme

**Server nicht erreichbar:**

```
❌ Failed to load: ERR_CONNECTION_REFUSED
```

→ Stelle sicher, dass `pnpm dev:electron` läuft

**Timeout beim Laden:**

```
❌ Timeout 60000ms exceeded
```

→ Server braucht länger zum Starten, erhöhe Timeout

**Elemente nicht gefunden:**

```
⚠️  Button not found
```

→ Prüfe Screenshots, UI könnte sich geändert haben

## 🔧 Anpassungen

### Selektoren aktualisieren

Wenn UI-Komponenten sich ändern, passe die Selektoren in den Test-Files an:

```python
# Beispiel: Voice Button Selector
voice_button = page.locator('button:has-text("Aufnahme")')
```

### Timeouts anpassen

```python
# Für langsame API-Calls
page.wait_for_timeout(10000)  # 10s statt 5s
```

### Neue Tests hinzufügen

1. Erstelle `test_feature_name.py` in `scripts/e2e/`
2. Folge dem bestehenden Pattern (siehe andere Tests)
3. Füge zu `run_all_tests.py` hinzu

## 📚 Weitere Ressourcen

- [Playwright Python Docs](https://playwright.dev/python/)
- [VoiceInvoice Architecture](../../../../docs/architecture.md)
- [Testing Strategy](../../../../docs/testing-strategy.md)
