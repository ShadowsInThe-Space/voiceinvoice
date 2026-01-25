import { v2 } from '@google-cloud/speech';
import type { google } from '@google-cloud/speech/build/protos/protos';
import {
  ChirpClient,
  ChirpRedactionConfig,
  ChirpTranscriptionResult,
  ChirpRedaction,
} from './dual-layer-privacy';
import { anonymize, detectPII, PIIPattern } from './index';

/**
 * Regional API endpoints for Speech-to-Text v2
 * Chirp 3 is only available in regional locations, not global
 */
const REGIONAL_ENDPOINTS: Record<string, string> = {
  us: 'us-speech.googleapis.com',
  eu: 'eu-speech.googleapis.com',
  global: 'speech.googleapis.com',
};

/**
 * Invoice-specific phrase hints for Speech Adaptation
 *
 * These phrases help Chirp 3 recognize domain-specific terminology:
 * - Common invoice terms
 * - German financial vocabulary
 * - Date and number formats
 * - Payment terms
 *
 * Note: Chirp 3 supports up to 1,000 phrases for adaptation.
 * Keep the list focused to prevent degradation on non-adaptation terms.
 */
export const INVOICE_PHRASE_HINTS = [
  // Rechnungsbegriffe
  'Rechnung',
  'Rechnungsnummer',
  'Kunde',
  'Kundenname',
  'Kundennummer',
  'Rechnungsdatum',
  'Leistungsdatum',
  'Fälligkeitsdatum',
  'Zahlungsziel',
  'Zahlungsbedingungen',

  // Beträge und Steuern
  'Euro',
  'Betrag',
  'Nettobetrag',
  'Bruttobetrag',
  'Endbetrag',
  'Gesamtbetrag',
  'Umsatzsteuer',
  'Mehrwertsteuer',
  'MwSt',
  'USt',
  'Prozent',

  // Leistungen
  'Dienstleistung',
  'Beratung',
  'Entwicklung',
  'Design',
  'Webdesign',
  'Programmierung',
  'Stundensatz',
  'Arbeitsstunden',

  // Adressen
  'Straße',
  'Postleitzahl',
  'PLZ',
  'Stadt',
  'Adresse',

  // Firmenbegriffe
  'GmbH',
  'AG',
  'UG',
  'GbR',
  'e.V.',
  'Einzelunternehmen',

  // Zahlungsbegriffe
  'Bankverbindung',
  'IBAN',
  'BIC',
  'Überweisung',
  'Zahlungsfrist',
  'sofort fällig',
  'innerhalb',
  'Tage',
  'Werktage',
];

/**
 * Client for Google Cloud Speech-to-Text (Chirp 3).
 * Implements the ChirpClient interface for the privacy engine.
 * Uses Google Cloud Application Default Credentials (gcloud auth).
 */
export class GoogleChirpClient implements ChirpClient {
  private client: v2.SpeechClient;
  private projectId: string;
  private location: string;
  private recognizerId: string;

  /**
   * Creates a new Google Chirp client.
   *
   * @param options - Configuration options
   * @param options.projectId - Google Cloud Project ID (defaults to env GOOGLE_CLOUD_PROJECT)
   * @param options.location - Google Cloud location (defaults to env GOOGLE_CLOUD_LOCATION or 'eu')
   * @param options.recognizerId - Chirp recognizer ID (defaults to env CHIRP3_RECOGNIZER)
   */
  constructor(
    options: {
      projectId?: string;
      location?: string;
      recognizerId?: string;
    } = {}
  ) {
    this.projectId = options.projectId || process.env.GOOGLE_CLOUD_PROJECT || 'voice-invoice-dev';
    this.location = options.location || process.env.GOOGLE_CLOUD_LOCATION || 'eu';
    this.recognizerId = options.recognizerId || process.env.CHIRP3_RECOGNIZER || 'chirp-german';

    // Use regional endpoint matching the recognizer location
    const apiEndpoint = REGIONAL_ENDPOINTS[this.location] || REGIONAL_ENDPOINTS.global;
    console.log(`[Chirp3] Initializing SpeechClient with endpoint: ${apiEndpoint}`);

    this.client = new v2.SpeechClient({
      apiEndpoint,
    });
  }

  /**
   * Transcribes audio using Google Cloud Speech-to-Text v2 (Chirp)
   * and applies local PII redaction.
   * @param audio
   * @param languageCode
   * @param config
   */
  async transcribeWithRedaction(
    audio: Buffer,
    languageCode: string,
    config: ChirpRedactionConfig
  ): Promise<ChirpTranscriptionResult> {
    // 1. Transcribe
    const transcript = await this.transcribe(audio, languageCode);

    // 2. Map config to PII patterns
    const patternsToRedact: PIIPattern[] = [];
    if (config.redactEmails) patternsToRedact.push('EMAIL');
    if (config.redactPhoneNumbers) patternsToRedact.push('PHONE');
    // Note: IBAN/TAX_ID are not explicitly in config but are good defaults for privacy
    // If strict adherence to config is required, we might skip them,
    // but for 'Enterprise Privacy' we likely want them.
    // For now we add them if any redaction is requested or maybe always?
    // Let's stick to what's requested plus critical financial data if likely.
    patternsToRedact.push('IBAN', 'TAX_ID');

    // 3. Detect PII to get indices for the result
    const matches = detectPII(transcript, patternsToRedact);

    // 4. Create redaction objects (using original indices)
    const redactions: ChirpRedaction[] = matches.map((m) => ({
      type: m.type,
      original: m.value,
      start: m.start,
      end: m.end,
    }));

    // 5. Anonymize
    const anonymized = anonymize(transcript, {
      strategy: 'redact',
      patterns: patternsToRedact,
    });

    return {
      text: anonymized.anonymizedText,
      redactions: redactions,
    };
  }

  private async transcribe(audio: Buffer, languageCode: string): Promise<string> {
    const parent = `projects/${this.projectId}/locations/${this.location}`;
    const recognizerName = `${parent}/recognizers/${this.recognizerId}`;

    console.log('[Chirp3] Starting transcription...');
    console.log('[Chirp3] Recognizer:', recognizerName);
    console.log('[Chirp3] Audio buffer size:', (audio.length / 1024).toFixed(2), 'KB');

    // Chirp 3 recognition request with Speech Adaptation
    // The recognizer already has chirp_3 model configured
    const request: google.cloud.speech.v2.IRecognizeRequest = {
      recognizer: recognizerName,
      config: {
        autoDecodingConfig: {}, // Auto-detect audio format (WAV, FLAC, WebM, etc.)
        languageCodes: [languageCode],
        features: {
          enableAutomaticPunctuation: true,
        },
        // Speech Adaptation with inline PhraseSet
        // Boosts recognition of invoice-specific terminology
        // See: https://cloud.google.com/speech-to-text/v2/docs/adaptation
        adaptation: {
          phraseSets: [
            {
              inlinePhraseSet: {
                phrases: INVOICE_PHRASE_HINTS.map((phrase) => ({ value: phrase, boost: 10 })),
              },
            },
          ],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any, // TypeScript doesn't have full type coverage for v2 API
      },
      content: audio,
    };

    console.log('[Chirp3] Calling Speech-to-Text API...');

    try {
      const [response] = await this.client.recognize(request);
      console.log('[Chirp3] API call successful');
      console.log('[Chirp3] Results count:', response.results?.length || 0);

      if (!response.results || response.results.length === 0) {
        console.warn('[Chirp3] No speech detected in audio');
        return '';
      }

      // Concatenate results
      const transcript = response.results
        .map((result) => result.alternatives?.[0]?.transcript || '')
        .join(' ')
        .trim();

      console.log('[Chirp3] Transcript length:', transcript.length, 'characters');
      return transcript;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = (error as { code?: number })?.code;
      console.error('[Chirp3] API call failed:', errorMessage);
      console.error('[Chirp3] Error code:', errorCode);

      // Provide helpful error messages
      if (errorCode === 3) {
        console.error('[Chirp3] INVALID_ARGUMENT - Check recognizer path and configuration');
      } else if (errorCode === 7) {
        console.error('[Chirp3] PERMISSION_DENIED - Check API is enabled and credentials');
      }

      throw new Error(`Transcription failed: ${errorMessage}`);
    }
  }
}
