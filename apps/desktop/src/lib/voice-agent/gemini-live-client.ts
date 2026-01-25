/**
 * Gemini 2.5 Flash Live API Client for VoiceInvoice.
 *
 * Provides real-time speech-to-speech capabilities using Google's
 * Gemini Live API with native audio processing.
 *
 * @see https://ai.google.dev/gemini-api/docs/live
 * @see https://cloud.google.com/blog/topics/developers-practitioners/how-to-use-gemini-live-api-native-audio-in-vertex-ai
 *
 * @module lib/voice-agent
 */

import { EventEmitter } from 'events';

/**
 * Configuration for Gemini Live API client.
 */
export interface GeminiLiveConfig {
  /** Google AI API key */
  apiKey: string;
  /** Model to use (default: gemini-2.5-flash-preview-native-audio-dialog) */
  model?: string;
  /** Voice for responses */
  voice?: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Aoede';
  /** System instruction for the model */
  systemInstruction?: string;
  /** Language code (default: de-DE) */
  languageCode?: string;
  /** Enable voice activity detection */
  enableVAD?: boolean;
  /** Tools/functions the model can call */
  tools?: GeminiTool[];
}

/**
 * Tool definition for function calling.
 */
export interface GeminiTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

/**
 * Events emitted by the Gemini Live client.
 */
export interface GeminiLiveEvents {
  /** Connection established */
  connected: () => void;
  /** Connection closed */
  disconnected: (reason?: string) => void;
  /** Interim transcription received */
  transcriptInterim: (text: string) => void;
  /** Final transcription received */
  transcriptFinal: (text: string) => void;
  /** Model text response */
  textResponse: (text: string) => void;
  /** Model audio response chunk */
  audioResponse: (audioData: ArrayBuffer) => void;
  /** Function call requested by model */
  functionCall: (name: string, args: Record<string, unknown>) => void;
  /** Voice activity detected */
  voiceActivity: (isActive: boolean) => void;
  /** Turn completed */
  turnComplete: () => void;
  /** Error occurred */
  error: (error: Error) => void;
}

const DEFAULT_CONFIG: Partial<GeminiLiveConfig> = {
  model: 'gemini-2.5-flash-preview-native-audio-dialog',
  voice: 'Kore',
  languageCode: 'de-DE',
  enableVAD: true,
};

/**
 * Gemini 2.5 Flash Live API client for real-time voice interactions.
 *
 * Uses WebSocket connection for bidirectional audio streaming with
 * native audio understanding and generation.
 *
 * @example
 * ```typescript
 * const client = new GeminiLiveClient({
 *   apiKey: process.env.GOOGLE_AI_API_KEY!,
 *   systemInstruction: 'Du bist ein Assistent für Rechnungserinnerungen.',
 *   tools: [{
 *     name: 'get_invoice',
 *     description: 'Lade Rechnungsdaten',
 *     parameters: {
 *       type: 'object',
 *       properties: {
 *         invoiceNumber: { type: 'string' }
 *       }
 *     }
 *   }]
 * });
 *
 * client.on('transcriptFinal', (text) => console.log('User said:', text));
 * client.on('audioResponse', (audio) => playAudio(audio));
 *
 * await client.connect();
 * client.sendAudio(audioChunk);
 * ```
 */
export class GeminiLiveClient extends EventEmitter {
  private config: GeminiLiveConfig;
  private ws: WebSocket | null = null;
  private isConnected = false;
  private audioQueue: ArrayBuffer[] = [];

  constructor(config: GeminiLiveConfig) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Connect to Gemini Live API via WebSocket.
   */
  async connect(): Promise<void> {
    const { apiKey } = this.config;

    // Gemini Live API WebSocket URL
    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.sendSetupMessage();
        this.emit('connected');
        resolve();
      };

      this.ws.onclose = (event) => {
        this.isConnected = false;
        this.emit('disconnected', event.reason);
      };

      this.ws.onerror = () => {
        const err = new Error('WebSocket error');
        this.emit('error', err);
        reject(err);
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    });
  }

  /**
   * Send initial setup message to configure the session.
   */
  private sendSetupMessage(): void {
    const { model, voice, systemInstruction, languageCode, tools, enableVAD } = this.config;

    const setupMessage = {
      setup: {
        model: `models/${model}`,
        generationConfig: {
          responseModalities: ['AUDIO', 'TEXT'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice,
              },
            },
            languageCode,
          },
        },
        systemInstruction: systemInstruction
          ? {
              parts: [{ text: systemInstruction }],
            }
          : undefined,
        tools: tools?.map((tool) => ({
          functionDeclarations: [
            {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            },
          ],
        })),
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: !enableVAD,
          },
        },
      },
    };

    this.send(setupMessage);
  }

  /**
   * Handle incoming WebSocket messages.
   */
  private handleMessage(data: string | ArrayBuffer): void {
    try {
      const message = typeof data === 'string' ? JSON.parse(data) : JSON.parse(new TextDecoder().decode(data));

      // Setup complete
      if (message.setupComplete) {
        return;
      }

      // Server content (response)
      if (message.serverContent) {
        const content = message.serverContent;

        // Model turn complete
        if (content.turnComplete) {
          this.emit('turnComplete');
          return;
        }

        // Process parts
        if (content.modelTurn?.parts) {
          for (const part of content.modelTurn.parts) {
            // Text response
            if (part.text) {
              this.emit('textResponse', part.text);
            }

            // Audio response
            if (part.inlineData?.mimeType?.startsWith('audio/')) {
              const audioData = this.base64ToArrayBuffer(part.inlineData.data);
              this.emit('audioResponse', audioData);
            }

            // Function call
            if (part.functionCall) {
              this.emit('functionCall', part.functionCall.name, part.functionCall.args || {});
            }
          }
        }

        // Transcription (input audio)
        if (content.inputTranscript) {
          if (content.inputTranscript.isFinal) {
            this.emit('transcriptFinal', content.inputTranscript.text);
          } else {
            this.emit('transcriptInterim', content.inputTranscript.text);
          }
        }
      }

      // Tool call response needed
      if (message.toolCall) {
        const { functionCalls } = message.toolCall;
        for (const call of functionCalls || []) {
          this.emit('functionCall', call.name, call.args || {});
        }
      }

      // Voice activity
      if (message.realtimeInput?.activityStart) {
        this.emit('voiceActivity', true);
      }
      if (message.realtimeInput?.activityEnd) {
        this.emit('voiceActivity', false);
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  /**
   * Send audio data to the model.
   *
   * @param audioData - PCM16 audio at 16kHz, mono
   */
  sendAudio(audioData: ArrayBuffer): void {
    if (!this.isConnected || !this.ws) {
      this.audioQueue.push(audioData);
      return;
    }

    const message = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: 'audio/pcm;rate=16000',
            data: this.arrayBufferToBase64(audioData),
          },
        ],
      },
    };

    this.send(message);
  }

  /**
   * Send text input to the model.
   */
  sendText(text: string): void {
    const message = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text }],
          },
        ],
        turnComplete: true,
      },
    };

    this.send(message);
  }

  /**
   * Send function call result back to the model.
   */
  sendFunctionResult(name: string, result: unknown): void {
    const message = {
      toolResponse: {
        functionResponses: [
          {
            name,
            response: { result },
          },
        ],
      },
    };

    this.send(message);
  }

  /**
   * Interrupt the current model response (barge-in).
   */
  interrupt(): void {
    // Send empty audio to trigger interruption
    const message = {
      realtimeInput: {
        activityStart: {},
      },
    };
    this.send(message);
  }

  /**
   * Disconnect from the API.
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  /**
   * Check if connected.
   */
  get connected(): boolean {
    return this.isConnected;
  }

  private send(message: unknown): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

export default GeminiLiveClient;
