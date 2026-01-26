# Text-to-Speech (TTS) Konfiguration

## Funktionierende Lösung

Die App verwendet Google Cloud Text-to-Speech API über die REST API mit API-Key.

### API Route
- **Pfad**: `/api/speech/tts`
- **Datei**: `apps/desktop/src/pages/api/speech/tts.ts`

### Konfiguration
- **Voice**: `de-DE-Wavenet-F` (hochwertige weibliche deutsche WaveNet-Stimme)
- **Audio Format**: LINEAR16 (WAV)
- **Sample Rate**: 24000 Hz

### API Key Handling
**WICHTIG**: Next.js lädt die `.env` Variablen im Dev-Server nicht zuverlässig. Deshalb gibt es einen Fallback direkt im Code:

```typescript
const apiKey = process.env.GEMINI_API_KEY
  || process.env.NEXT_PUBLIC_GOOGLE_API_KEY
  || 'AIzaSyAhM6S1SWtsMoKptlsxhYr84lWNgSep8fE'; // Fallback für Dev
```

### Wichtige Hinweise
1. **Kein ADC verwenden**: Application Default Credentials (ADC) verursachen Quota-Projekt-Probleme
2. **REST API direkt nutzen**: Nicht den `@google-cloud/text-to-speech` Client verwenden
3. **Cloud TTS API muss aktiviert sein**: https://console.developers.google.com/apis/api/texttospeech.googleapis.com/overview
4. **Frontend Hook**: `apps/desktop/src/hooks/useSpeechSynthesis.ts` ruft die API-Route auf
5. **Default Voice**: `de-DE-Wavenet-F` ist in `useSpeechSynthesis.ts` Zeile 78 definiert

### Fallback
Falls Google TTS fehlschlägt, fällt der Hook auf die Browser Web Speech API zurück (niedrigere Qualität).
