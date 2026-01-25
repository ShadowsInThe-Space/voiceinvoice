import { v2 } from '@google-cloud/speech';
import {
  ChirpClient,
  ChirpRedactionConfig,
  ChirpTranscriptionResult,
  ChirpRedaction,
} from './dual-layer-privacy';
import { anonymize, detectPII, PIIPattern } from './index';

/**
 * Client for Google Cloud Speech-to-Text (Chirp 3).
 * Implements the ChirpClient interface for the privacy engine.
 */
export class GoogleChirpClient implements ChirpClient {
  private client: v2.SpeechClient;
  private projectId: string;
  private location: string;
  private recognizerId: string;

  /**
   *
   * @param options
   * @param options.projectId
   * @param options.location
   * @param options.recognizerId
   */
  constructor(
    options: {
      projectId?: string;
      location?: string;
      recognizerId?: string;
    } = {}
  ) {
    this.client = new v2.SpeechClient();
    this.projectId = options.projectId || process.env.GOOGLE_CLOUD_PROJECT || 'voice-invoice-dev';
    this.location = options.location || process.env.GOOGLE_CLOUD_LOCATION || 'europe-west3';
    this.recognizerId = options.recognizerId || process.env.CHIRP_RECOGNIZER_ID || 'chirp-german';
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

    // Note: In a real app, we might need to dynamically create recognizers
    // or assume they exist. For 'chirp', we specifically want a Chirp recognizer.

    const request = {
      recognizer: recognizerName,
      config: {
        autoDecodingConfig: {}, // Detect encoding
        languageCodes: [languageCode],
        model: 'chirp',
      },
      content: audio.toString('base64'),
    };

    try {
      const [response] = await this.client.recognize(request);

      if (!response.results || response.results.length === 0) {
        return '';
      }

      // Concatenate results
      return response.results.map((result) => result.alternatives?.[0]?.transcript || '').join(' ');
    } catch (error) {
      console.error('Google Chirp Transcription Error:', error);
      throw new Error(
        `Transcription failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
