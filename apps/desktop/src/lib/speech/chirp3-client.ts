/**
 * Google Cloud Speech-to-Text Client with Chirp 3
 *
 * Provides audio transcription using Google's Chirp 3 model
 * with Speech Adaptation for invoice-specific terminology.
 *
 * IMPORTANT: This runs SERVER-SIDE only (API routes).
 * Chirp 3 requires:
 * 1. A custom recognizer in a regional location (eu)
 * 2. The regional API endpoint (eu-speech.googleapis.com)
 * 3. Application Default Credentials (service account or gcloud auth)
 *
 */
import { SpeechClient } from '@google-cloud/speech/build/src/v2';
import type { google } from '@google-cloud/speech/build/protos/protos';

/**
 * Speech recognition configuration
 */
interface SpeechConfig {
  languageCode: string;
  enableAutomaticPunctuation: boolean;
  phraseHints?: string[];
}

/**
 * Default configuration for German invoice transcription
 */
const DEFAULT_CONFIG: SpeechConfig = {
  languageCode: 'de-DE',
  enableAutomaticPunctuation: true,
};

/**
 * Regional API endpoints for Speech-to-Text v2
 */
const REGIONAL_ENDPOINTS: Record<string, string> = {
  us: 'us-speech.googleapis.com',
  eu: 'eu-speech.googleapis.com',
  global: 'speech.googleapis.com',
};

/**
 * Invoice-specific phrase hints for Speech Adaptation
 */
export const INVOICE_PHRASE_HINTS = [
  // Rechnungsbegriffe
  'Rechnung',
  'Rechnungsnummer',
  'Kunde',
  'Kundenname',
  'Rechnungsdatum',
  'Fälligkeitsdatum',
  'Zahlungsziel',

  // Beträge und Steuern
  'Euro',
  'Betrag',
  'Nettobetrag',
  'Bruttobetrag',
  'Umsatzsteuer',
  'Mehrwertsteuer',
  'MwSt',
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
  'Workshop',
  'Redesign',
  'Webseite',
  'pauschal',

  // Orte
  'Berlin',
  'München',
  'Hamburg',
  'Frankfurt',
  'Köln',
  'Stuttgart',
  'Düsseldorf',

  // Firmenbegriffe
  'GmbH',
  'AG',
  'UG',
  'Agentur',
  'Design Agentur',

  // Zahlungsbegriffe
  'zahlbar',
  'sofort',
  'ohne Abzug',
  'innerhalb',
  'Tage',
];

/**
 * Speech client instance (lazy-loaded)
 */
let speechClient: SpeechClient | null = null;
let clientLocation: string | null = null;

/**
 * Extract location from recognizer path
 * @param recognizerPath
 */
function getLocationFromRecognizer(recognizerPath: string): string {
  const match = recognizerPath.match(/locations\/([^/]+)/);
  return match?.[1] || 'global';
}

/**
 * Get Speech-to-Text client configured for the recognizer's region
 * @param recognizerPath
 */
function getSpeechClient(recognizerPath: string): SpeechClient {
  const location = getLocationFromRecognizer(recognizerPath);

  if (!speechClient || clientLocation !== location) {
    const apiEndpoint = REGIONAL_ENDPOINTS[location] || REGIONAL_ENDPOINTS.global;
    console.log(`[Chirp3] Initializing SpeechClient with endpoint: ${apiEndpoint}`);

    speechClient = new SpeechClient({
      apiEndpoint,
    });
    clientLocation = location;
  }

  return speechClient;
}

/**
 * Get the Chirp 3 recognizer path from environment
 */
function getRecognizerPath(): string {
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT || process.env.NEXT_PUBLIC_GOOGLE_CLOUD_PROJECT;
  const location =
    process.env.GOOGLE_CLOUD_LOCATION || process.env.NEXT_PUBLIC_GOOGLE_CLOUD_LOCATION || 'eu';
  const recognizerId = process.env.CHIRP3_RECOGNIZER || process.env.NEXT_PUBLIC_CHIRP3_RECOGNIZER;

  if (recognizerId && projectId) {
    // Full path format
    if (recognizerId.startsWith('projects/')) {
      return recognizerId;
    }
    // Just the recognizer name
    return `projects/${projectId}/locations/${location}/recognizers/${recognizerId}`;
  }

  console.warn('[Chirp3] WARNING: Chirp 3 not fully configured');
  console.warn('[Chirp3] Required: GOOGLE_CLOUD_PROJECT, CHIRP3_RECOGNIZER');
  return '';
}

/**
 * Check if Chirp 3 is available
 */
export function isChirp3Available(): boolean {
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT || process.env.NEXT_PUBLIC_GOOGLE_CLOUD_PROJECT;
  const recognizerId = process.env.CHIRP3_RECOGNIZER || process.env.NEXT_PUBLIC_CHIRP3_RECOGNIZER;
  return !!(projectId && recognizerId);
}

/**
 * Transcribe audio to text using Chirp 3 model
 *
 * @param audioBuffer - Audio data as Buffer
 * @param config - Optional speech recognition configuration
 * @returns Transcribed text
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  config: Partial<SpeechConfig> = {}
): Promise<{ success: boolean; text: string; confidence: number; error?: string }> {
  const recognizerPath = getRecognizerPath();

  if (!recognizerPath) {
    return {
      success: false,
      text: '',
      confidence: 0,
      error: 'Chirp 3 not configured',
    };
  }

  const client = getSpeechClient(recognizerPath);
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  console.log('[Chirp3] Starting transcription...');
  console.log('[Chirp3] Recognizer:', recognizerPath);
  console.log('[Chirp3] Audio buffer size:', (audioBuffer.length / 1024).toFixed(2), 'KB');

  const phraseHints = fullConfig.phraseHints || INVOICE_PHRASE_HINTS;

  const request: google.cloud.speech.v2.IRecognizeRequest = {
    recognizer: recognizerPath,
    config: {
      autoDecodingConfig: {},
      languageCodes: [fullConfig.languageCode],
      features: {
        enableAutomaticPunctuation: fullConfig.enableAutomaticPunctuation,
      },
      adaptation: {
        phraseSets: [
          {
            inlinePhraseSet: {
              phrases: phraseHints.map((phrase) => ({ value: phrase, boost: 10 })),
            },
          },
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    },
    content: audioBuffer,
  };

  try {
    const [response] = await client.recognize(request);
    console.log('[Chirp3] API call successful');

    const transcripts = response.results
      ?.map((result) => result.alternatives?.[0]?.transcript)
      .filter(Boolean)
      .join(' ');

    if (!transcripts) {
      console.warn('[Chirp3] No speech detected in audio');
      return { success: true, text: '', confidence: 0 };
    }

    const confidence = response.results?.[0]?.alternatives?.[0]?.confidence || 0.9;

    console.log('[Chirp3] Transcript:', transcripts);
    return {
      success: true,
      text: transcripts.trim(),
      confidence: confidence as number,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Chirp3] API call failed:', errorMessage);

    return {
      success: false,
      text: '',
      confidence: 0,
      error: errorMessage,
    };
  }
}
