/**
 * Google Cloud Text-to-Speech Client for VoiceInvoice.
 *
 * Provides speech synthesis using Google Cloud TTS API with German Wavenet voices.
 * Includes queue management and audio playback controls for a voice-first experience.
 *
 * @module lib/tts/tts-client
 */

/**
 * Playback state enumeration.
 */
export enum PlaybackState {
  IDLE = 'IDLE',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
}

/**
 * Configuration for TTSClient.
 */
export interface TTSConfig {
  /** Google Cloud API key */
  apiKey: string;

  /** Voice name (default: 'de-DE-Wavenet-C') */
  voice?: string;

  /** Speaking rate 0.5-2.0 (default: 1.0) */
  speakingRate?: number;

  /** Pitch -20 to 20 (default: 0) */
  pitch?: number;
}

/**
 * Options for speak method.
 */
export interface SpeakOptions {
  /** Text to speak */
  text: string;

  /** Override voice for this request */
  voice?: string;

  /** Stop current playback before speaking */
  interrupt?: boolean;
}

/**
 * Invoice interface for VoiceResponseHelper.
 */
export interface Invoice {
  id: string;
  number: string;
  customerName: string;
  total: number;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  createdAt: Date;
}

/**
 * Internal configuration with defaults applied.
 */
interface InternalConfig {
  apiKey: string;
  voice: string;
  speakingRate: number;
  pitch: number;
}

/**
 * Google Cloud TTS API request body.
 */
interface TTSRequest {
  input: {
    text?: string;
    ssml?: string;
  };
  voice: {
    languageCode: string;
    name: string;
  };
  audioConfig: {
    audioEncoding: string;
    speakingRate: number;
    pitch: number;
  };
}

/**
 * Google Cloud TTS API response.
 */
interface TTSResponse {
  audioContent: string;
}

/**
 * Queue item for sequential playback.
 */
interface QueueItem {
  text: string;
  voice?: string;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG = {
  voice: 'de-DE-Wavenet-C',
  speakingRate: 1.0,
  pitch: 0,
};

/**
 * Available German Wavenet voices.
 */
export const GERMAN_VOICES = {
  WAVENET_A: 'de-DE-Wavenet-A', // Female
  WAVENET_B: 'de-DE-Wavenet-B', // Male
  WAVENET_C: 'de-DE-Wavenet-C', // Female (default)
  WAVENET_D: 'de-DE-Wavenet-D', // Male
  WAVENET_E: 'de-DE-Wavenet-E', // Male
  WAVENET_F: 'de-DE-Wavenet-F', // Female
} as const;

/**
 * Google Cloud Text-to-Speech Client.
 *
 * Provides speech synthesis with German voices, queue management,
 * and playback controls for a voice-first invoice application.
 *
 * @example
 * const tts = new TTSClient({ apiKey: 'your-api-key' });
 *
 * tts.onStart = () => console.log('Speaking...');
 * tts.onEnd = () => console.log('Done');
 *
 * await tts.speak({ text: 'Rechnung erstellt' });
 */
export class TTSClient {
  private config: InternalConfig;
  private state: PlaybackState = PlaybackState.IDLE;
  private audioElement: HTMLAudioElement | null = null;
  private queue: QueueItem[] = [];
  private isProcessingQueue: boolean = false;
  private currentReject: ((error: Error) => void) | null = null;

  private readonly TTS_API_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';

  /** Callback when playback starts */
  onStart?: () => void;

  /** Callback when playback ends */
  onEnd?: () => void;

  /** Callback on error */
  onError?: (error: Error) => void;

  /**
   * Creates a new TTSClient instance.
   *
   * @param {TTSConfig} config - Configuration options
   */
  constructor(config: TTSConfig) {
    this.config = {
      apiKey: config.apiKey,
      voice: config.voice ?? DEFAULT_CONFIG.voice,
      speakingRate: this.clamp(config.speakingRate ?? DEFAULT_CONFIG.speakingRate, 0.5, 2.0),
      pitch: this.clamp(config.pitch ?? DEFAULT_CONFIG.pitch, -20, 20),
    };
  }

  /**
   * Speaks the given text using Google Cloud TTS.
   *
   * @param {SpeakOptions} options - Speak options
   * @returns {Promise<void>} Resolves when playback completes
   * @throws {Error} If API call fails or playback is interrupted
   */
  async speak(options: SpeakOptions): Promise<void> {
    const { text, voice, interrupt = false } = options;

    if (interrupt && this.state !== PlaybackState.IDLE) {
      this.stopInternal('Playback interrupted');
    }

    const audioContent = await this.synthesize({ text }, voice);
    await this.playAudio(audioContent);
  }

  /**
   * Speaks SSML content using Google Cloud TTS.
   *
   * @param {string} ssml - SSML markup to speak
   * @returns {Promise<void>} Resolves when playback completes
   */
  async speakSSML(ssml: string): Promise<void> {
    const audioContent = await this.synthesize({ ssml });
    await this.playAudio(audioContent);
  }

  /**
   * Stops current playback and clears the queue.
   */
  stop(): void {
    this.stopInternal('Playback stopped');
    this.clearQueue();
  }

  /**
   * Pauses current playback.
   */
  pause(): void {
    if (this.state !== PlaybackState.PLAYING || !this.audioElement) {
      return;
    }

    this.audioElement.pause();
    this.state = PlaybackState.PAUSED;
  }

  /**
   * Resumes paused playback.
   */
  resume(): void {
    if (this.state !== PlaybackState.PAUSED || !this.audioElement) {
      return;
    }

    this.audioElement.play();
    this.state = PlaybackState.PLAYING;
  }

  /**
   * Returns whether audio is currently playing.
   */
  get isSpeaking(): boolean {
    return this.state === PlaybackState.PLAYING;
  }

  /**
   * Returns whether playback is paused.
   */
  get isPaused(): boolean {
    return this.state === PlaybackState.PAUSED;
  }

  /**
   * Returns the current playback state.
   */
  getState(): PlaybackState {
    return this.state;
  }

  /**
   * Returns the current configuration.
   */
  getConfig(): InternalConfig {
    return { ...this.config };
  }

  /**
   * Adds text to the playback queue.
   *
   * @param {string} text - Text to queue
   * @param {string} voice - Optional voice override
   */
  queueText(text: string, voice?: string): void {
    const item: QueueItem = { text };
    if (voice) {
      item.voice = voice;
    }
    this.queue.push(item);
  }

  /**
   * Clears the playback queue without stopping current playback.
   */
  clearQueue(): void {
    this.queue = [];
  }

  /**
   * Returns the number of items in the queue.
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Processes the queue, playing items sequentially.
   *
   * @returns {Promise<void>} Resolves when queue is empty
   */
  async processQueue(): Promise<void> {
    if (this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.queue.length > 0) {
        const item = this.queue.shift();
        if (item) {
          const options: SpeakOptions = { text: item.text };
          if (item.voice) {
            options.voice = item.voice;
          }
          await this.speak(options);
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Synthesizes text to audio using Google Cloud TTS API.
   *
   * @param {object} input - Input text or SSML
   * @param {string} voiceOverride - Optional voice override
   * @returns {Promise<string>} Base64 encoded audio content
   */
  private async synthesize(
    input: { text?: string; ssml?: string },
    voiceOverride?: string
  ): Promise<string> {
    const voice = voiceOverride ?? this.config.voice;
    const languageCode = voice.substring(0, 5); // e.g., 'de-DE'

    const requestBody: TTSRequest = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      input: (input.ssml ? { ssml: input.ssml } : { text: input.text }) as any,
      voice: {
        languageCode,
        name: voice,
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: this.config.speakingRate,
        pitch: this.config.pitch,
      },
    };

    try {
      const response = await fetch(`${this.TTS_API_URL}?key=${this.config.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const status = response.status;
        let errorMessage: string;

        switch (status) {
          case 401:
            errorMessage = 'Unauthorized: Invalid API key';
            break;
          case 429:
            errorMessage = 'Rate limit exceeded';
            break;
          case 400:
            errorMessage = 'Bad request: Invalid parameters';
            break;
          default:
            errorMessage = `API error: ${status} ${response.statusText}`;
        }

        const error = new Error(errorMessage);
        this.onError?.(error);
        throw error;
      }

      const data: TTSResponse = await response.json();
      return data.audioContent;
    } catch (error) {
      if (error instanceof Error) {
        this.onError?.(error);
        throw error;
      }
      const unknownError = new Error('Unknown error during synthesis');
      this.onError?.(unknownError);
      throw unknownError;
    }
  }

  /**
   * Plays base64 encoded audio content.
   *
   * @param {string} audioContent - Base64 encoded audio
   * @returns {Promise<void>} Resolves when playback completes
   */
  private async playAudio(audioContent: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.currentReject = reject;

      // Create audio element with data URL
      const audioData = `data:audio/mp3;base64,${audioContent}`;
      this.audioElement = new Audio(audioData);

      this.audioElement.onplay = (): void => {
        this.state = PlaybackState.PLAYING;
        this.onStart?.();
      };

      this.audioElement.onended = (): void => {
        this.state = PlaybackState.IDLE;
        this.audioElement = null;
        this.currentReject = null;
        this.onEnd?.();
        resolve();
      };

      this.audioElement.onerror = (): void => {
        const error = new Error('Audio playback error');
        this.state = PlaybackState.IDLE;
        this.audioElement = null;
        this.currentReject = null;
        this.onError?.(error);
        reject(error);
      };

      this.audioElement.play().catch((error) => {
        this.state = PlaybackState.IDLE;
        this.audioElement = null;
        this.currentReject = null;
        this.onError?.(error);
        reject(error);
      });
    });
  }

  /**
   * Internal stop method with custom error message.
   *
   * @param {string} message - Error message for interrupted playback
   */
  private stopInternal(message: string): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement = null;
    }

    if (this.currentReject) {
      this.currentReject(new Error(message));
      this.currentReject = null;
    }

    this.state = PlaybackState.IDLE;
  }

  /**
   * Clamps a value to a range.
   *
   * @param {number} value - Value to clamp
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} Clamped value
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}

/**
 * Helper class for common voice responses in German.
 *
 * Provides pre-formatted voice responses for invoice-related actions.
 *
 * @example
 * const tts = new TTSClient({ apiKey: 'key' });
 * const voice = new VoiceResponseHelper(tts);
 *
 * await voice.confirmInvoiceCreated(invoice);
 * await voice.askForConfirmation('Soll ich die Rechnung senden?');
 */
export class VoiceResponseHelper {
  private tts: TTSClient;

  /**
   * Creates a new VoiceResponseHelper.
   *
   * @param {TTSClient} tts - TTSClient instance to use
   */
  constructor(tts: TTSClient) {
    this.tts = tts;
  }

  /**
   * Confirms that an invoice was created.
   *
   * @param {Invoice} invoice - The created invoice
   * @returns {Promise<void>}
   */
  async confirmInvoiceCreated(invoice: Invoice): Promise<void> {
    const total = this.formatCurrency(invoice.total);
    const text = `Rechnung ${invoice.number} für ${invoice.customerName} über ${total} Euro wurde erstellt.`;
    await this.tts.speak({ text });
  }

  /**
   * Reports an error to the user.
   *
   * @param {string} error - Error message
   * @returns {Promise<void>}
   */
  async reportError(error: string): Promise<void> {
    const text = `Es ist ein Fehler aufgetreten: ${error}`;
    await this.tts.speak({ text });
  }

  /**
   * Asks for user confirmation.
   *
   * @param {string} question - Question to ask
   * @returns {Promise<void>}
   */
  async askForConfirmation(question: string): Promise<void> {
    await this.tts.speak({ text: question });
  }

  /**
   * Reads an invoice summary.
   *
   * @param {Invoice} invoice - Invoice to summarize
   * @returns {Promise<void>}
   */
  async readInvoiceSummary(invoice: Invoice): Promise<void> {
    const total = this.formatCurrency(invoice.total);
    const itemCount = invoice.items.length;
    const text = `Die Rechnung enthält ${itemCount} Positionen mit einem Gesamtbetrag von ${total} Euro.`;
    await this.tts.speak({ text });
  }

  /**
   * Speaks custom text.
   *
   * @param {string} text - Text to speak
   * @returns {Promise<void>}
   */
  async speakCustom(text: string): Promise<void> {
    await this.tts.speak({ text });
  }

  /**
   * Formats a number as German currency string.
   *
   * @param {number} amount - Amount to format
   * @returns {string} Formatted amount with comma as decimal separator
   */
  private formatCurrency(amount: number): string {
    return amount.toFixed(2).replace('.', ',');
  }
}
