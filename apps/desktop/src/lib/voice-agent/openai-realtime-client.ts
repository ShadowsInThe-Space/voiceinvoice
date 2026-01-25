/**
 * OpenAI Realtime API Client for VoiceInvoice.
 *
 * Provides speech-to-speech capabilities using OpenAI's Realtime API
 * with GPT-4o for native audio understanding and generation.
 *
 * @see https://platform.openai.com/docs/guides/realtime
 *
 * @module lib/voice-agent
 */

import { EventEmitter } from 'events';

/**
 * Configuration for OpenAI Realtime API client.
 */
export interface OpenAIRealtimeConfig {
  /** OpenAI API key */
  apiKey: string;
  /** Model to use (default: gpt-4o-realtime-preview) */
  model?: string;
  /** Voice for responses */
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  /** System instruction for the model */
  systemInstruction?: string;
  /** Input audio format */
  inputAudioFormat?: 'pcm16' | 'g711_ulaw' | 'g711_alaw';
  /** Output audio format */
  outputAudioFormat?: 'pcm16' | 'g711_ulaw' | 'g711_alaw';
  /** Enable input audio transcription */
  enableTranscription?: boolean;
  /** Turn detection configuration */
  turnDetection?: {
    type: 'server_vad';
    threshold?: number;
    prefixPaddingMs?: number;
    silenceDurationMs?: number;
  };
  /** Tools/functions the model can call */
  tools?: OpenAITool[];
}

/**
 * Tool definition for function calling.
 */
export interface OpenAITool {
  type: 'function';
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description?: string; enum?: string[] }>;
    required?: string[];
  };
}

/**
 * Events emitted by the OpenAI Realtime client.
 */
export interface OpenAIRealtimeEvents {
  connected: () => void;
  disconnected: (reason?: string) => void;
  transcriptDelta: (text: string) => void;
  transcriptDone: (text: string) => void;
  responseDelta: (text: string) => void;
  responseDone: (text: string) => void;
  audioDelta: (audioData: ArrayBuffer) => void;
  audioDone: () => void;
  functionCall: (name: string, callId: string, args: Record<string, unknown>) => void;
  speechStarted: () => void;
  speechStopped: () => void;
  error: (error: Error) => void;
}

const DEFAULT_CONFIG: Partial<OpenAIRealtimeConfig> = {
  model: 'gpt-4o-realtime-preview',
  voice: 'nova',
  inputAudioFormat: 'pcm16',
  outputAudioFormat: 'pcm16',
  enableTranscription: true,
  turnDetection: {
    type: 'server_vad',
    threshold: 0.5,
    prefixPaddingMs: 300,
    silenceDurationMs: 500,
  },
};

/**
 * OpenAI Realtime API client for speech-to-speech interactions.
 *
 * Uses WebSocket connection for bidirectional audio streaming with
 * GPT-4o's native audio capabilities.
 *
 * @example
 * ```typescript
 * const client = new OpenAIRealtimeClient({
 *   apiKey: process.env.OPENAI_API_KEY!,
 *   voice: 'nova',
 *   systemInstruction: 'Du bist ein Assistent für Rechnungserinnerungen.',
 *   tools: [{
 *     type: 'function',
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
 * client.on('transcriptDone', (text) => console.log('User said:', text));
 * client.on('audioDelta', (audio) => playAudio(audio));
 *
 * await client.connect();
 * client.sendAudio(audioChunk);
 * ```
 */
export class OpenAIRealtimeClient extends EventEmitter {
  private config: OpenAIRealtimeConfig;
  private ws: WebSocket | null = null;
  private isConnected = false;
  private currentResponseId: string | null = null;

  constructor(config: OpenAIRealtimeConfig) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config } as OpenAIRealtimeConfig;
  }

  /**
   * Connect to OpenAI Realtime API via WebSocket.
   */
  async connect(): Promise<void> {
    const { apiKey, model } = this.config;

    const wsUrl = `wss://api.openai.com/v1/realtime?model=${model}`;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl, {
        // @ts-expect-error - WebSocket headers in Node.js
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      });

      this.ws.onopen = (): void => {
        this.isConnected = true;
        this.sendSessionUpdate();
        this.emit('connected');
        resolve();
      };

      this.ws.onclose = (event): void => {
        this.isConnected = false;
        this.emit('disconnected', event.reason);
      };

      this.ws.onerror = (): void => {
        const err = new Error('WebSocket error');
        this.emit('error', err);
        reject(err);
      };

      this.ws.onmessage = (event): void => {
        this.handleMessage(event.data as string);
      };
    });
  }

  /**
   * Send session update to configure the session.
   */
  private sendSessionUpdate(): void {
    const { voice, systemInstruction, inputAudioFormat, outputAudioFormat, enableTranscription, turnDetection, tools } =
      this.config;

    const sessionConfig: Record<string, unknown> = {
      modalities: ['text', 'audio'],
      voice,
      input_audio_format: inputAudioFormat,
      output_audio_format: outputAudioFormat,
      turn_detection: turnDetection,
    };

    if (enableTranscription) {
      sessionConfig.input_audio_transcription = {
        model: 'whisper-1',
      };
    }

    if (systemInstruction) {
      sessionConfig.instructions = systemInstruction;
    }

    if (tools && tools.length > 0) {
      sessionConfig.tools = tools.map((tool) => ({
        type: tool.type,
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }));
    }

    this.send({
      type: 'session.update',
      session: sessionConfig,
    });
  }

  /**
   * Handle incoming WebSocket messages.
   */
  private handleMessage(data: string): void {
    try {
      const event = JSON.parse(data);

      switch (event.type) {
        // Session events
        case 'session.created':
        case 'session.updated':
          // Session ready
          break;

        // Input audio transcription
        case 'conversation.item.input_audio_transcription.completed':
          this.emit('transcriptDone', event.transcript);
          break;

        // Response events
        case 'response.created':
          this.currentResponseId = event.response.id;
          break;

        case 'response.text.delta':
          this.emit('responseDelta', event.delta);
          break;

        case 'response.text.done':
          this.emit('responseDone', event.text);
          break;

        case 'response.audio.delta':
          if (event.delta) {
            const audioData = this.base64ToArrayBuffer(event.delta);
            this.emit('audioDelta', audioData);
          }
          break;

        case 'response.audio.done':
          this.emit('audioDone');
          break;

        case 'response.audio_transcript.delta':
          this.emit('responseDelta', event.delta);
          break;

        case 'response.audio_transcript.done':
          this.emit('responseDone', event.transcript);
          break;

        // Function calling
        case 'response.function_call_arguments.done':
          try {
            const args = JSON.parse(event.arguments);
            this.emit('functionCall', event.name, event.call_id, args);
          } catch {
            this.emit('functionCall', event.name, event.call_id, {});
          }
          break;

        // Speech detection
        case 'input_audio_buffer.speech_started':
          this.emit('speechStarted');
          break;

        case 'input_audio_buffer.speech_stopped':
          this.emit('speechStopped');
          break;

        // Errors
        case 'error':
          this.emit('error', new Error(event.error?.message || 'Unknown error'));
          break;
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  /**
   * Send audio data to the model.
   *
   * @param audioData - PCM16 audio at 24kHz, mono
   */
  sendAudio(audioData: ArrayBuffer): void {
    if (!this.isConnected || !this.ws) return;

    this.send({
      type: 'input_audio_buffer.append',
      audio: this.arrayBufferToBase64(audioData),
    });
  }

  /**
   * Commit the audio buffer and trigger response.
   */
  commitAudio(): void {
    if (!this.isConnected || !this.ws) return;

    this.send({
      type: 'input_audio_buffer.commit',
    });

    this.send({
      type: 'response.create',
    });
  }

  /**
   * Send text input to the model.
   */
  sendText(text: string): void {
    if (!this.isConnected || !this.ws) return;

    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text,
          },
        ],
      },
    });

    this.send({
      type: 'response.create',
    });
  }

  /**
   * Send function call result back to the model.
   */
  sendFunctionResult(callId: string, result: unknown): void {
    if (!this.isConnected || !this.ws) return;

    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify(result),
      },
    });

    this.send({
      type: 'response.create',
    });
  }

  /**
   * Cancel the current response (barge-in).
   */
  cancelResponse(): void {
    if (!this.isConnected || !this.ws || !this.currentResponseId) return;

    this.send({
      type: 'response.cancel',
    });
  }

  /**
   * Clear the input audio buffer.
   */
  clearAudioBuffer(): void {
    if (!this.isConnected || !this.ws) return;

    this.send({
      type: 'input_audio_buffer.clear',
    });
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

export default OpenAIRealtimeClient;
