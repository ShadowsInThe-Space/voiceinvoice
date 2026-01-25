/**
 * Voice Agent Factory for VoiceInvoice.
 *
 * Provides a unified interface for different voice agent providers:
 * - Gemini 2.5 Flash Live (lowest latency, native audio)
 * - ElevenLabs Conversational AI (best voice quality)
 * - OpenAI Realtime (GPT-4o native audio)
 * - OpenAI Pipeline (most control, Whisper → GPT-4 → TTS)
 *
 * @module lib/voice-agent
 */

import { EventEmitter } from 'events';
import { GeminiLiveClient, type GeminiLiveConfig, type GeminiTool } from './gemini-live-client';
import { ElevenLabsConversationalAgent } from './elevenlabs-conversational';
import { OpenAIRealtimeClient, type OpenAIRealtimeConfig } from './openai-realtime-client';
import { OpenAIPipelineClient, type OpenAIPipelineConfig } from './openai-pipeline-client';

/**
 * Available voice agent providers.
 */
export type VoiceAgentProvider = 'gemini' | 'elevenlabs' | 'openai-realtime' | 'openai-pipeline';

/**
 * Unified tool definition that works across all providers.
 */
export interface UnifiedTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description?: string; enum?: string[] }>;
    required?: string[];
  };
}

/**
 * Unified configuration for voice agents.
 */
export interface UnifiedVoiceAgentConfig {
  /** Provider to use */
  provider: VoiceAgentProvider;
  /** API key for the provider */
  apiKey: string;
  /** Secondary API key (for ElevenLabs phone number) */
  secondaryApiKey?: string;
  /** Voice name/ID */
  voice?: string;
  /** System instruction */
  systemInstruction?: string;
  /** Language code */
  language?: string;
  /** Tools/functions */
  tools?: UnifiedTool[];
  /** Provider-specific options */
  providerOptions?: Record<string, unknown>;
}

/**
 * Unified events emitted by all voice agents.
 */
export interface UnifiedVoiceAgentEvents {
  /** Connection established (for WebSocket-based providers) */
  connected: () => void;
  /** Connection closed */
  disconnected: (reason?: string) => void;
  /** User speech transcribed */
  transcribed: (text: string, isFinal: boolean) => void;
  /** Agent text response */
  responseText: (text: string, isDelta: boolean) => void;
  /** Agent audio response */
  responseAudio: (audioData: ArrayBuffer) => void;
  /** Audio response complete */
  audioDone: () => void;
  /** Function call requested */
  functionCall: (name: string, callId: string, args: Record<string, unknown>) => void;
  /** Voice activity detected */
  voiceActivity: (isActive: boolean) => void;
  /** Turn completed */
  turnComplete: () => void;
  /** Error occurred */
  error: (error: Error) => void;
}

/**
 * Unified voice agent interface.
 */
export interface UnifiedVoiceAgent extends EventEmitter {
  /** Provider type */
  readonly provider: VoiceAgentProvider;
  /** Whether connected/ready */
  readonly isReady: boolean;
  /** Connect to the service */
  connect(): Promise<void>;
  /** Disconnect from the service */
  disconnect(): void;
  /** Send audio data */
  sendAudio(audioData: ArrayBuffer | Blob): void;
  /** Send text input */
  sendText(text: string): void;
  /** Send function result */
  sendFunctionResult(callId: string, result: unknown): void;
  /** Interrupt/cancel current response (barge-in) */
  interrupt(): void;
}

/**
 * Provider characteristics for decision making.
 */
export const PROVIDER_CHARACTERISTICS = {
  gemini: {
    name: 'Gemini 2.5 Flash Live',
    latency: '~250ms',
    voiceQuality: 'Good',
    control: 'Medium',
    cost: 'Low',
    strengths: ['Lowest latency', 'Native audio understanding', 'Good German'],
    weaknesses: ['Fewer voice options', 'Less natural prosody'],
  },
  elevenlabs: {
    name: 'ElevenLabs Conversational AI',
    latency: '~300ms',
    voiceQuality: 'Excellent',
    control: 'Medium',
    cost: 'Medium',
    strengths: ['Best voice quality', 'Natural prosody', 'Many voice options'],
    weaknesses: ['Requires separate LLM', 'Higher cost'],
  },
  'openai-realtime': {
    name: 'OpenAI Realtime API',
    latency: '~400ms',
    voiceQuality: 'Good',
    control: 'Medium',
    cost: 'High',
    strengths: ['GPT-4o native audio', 'Good reasoning', 'Built-in VAD'],
    weaknesses: ['Higher latency', 'Limited voices', 'Premium pricing'],
  },
  'openai-pipeline': {
    name: 'OpenAI Pipeline (Whisper → GPT-4 → TTS)',
    latency: '~800-1200ms',
    voiceQuality: 'Good',
    control: 'High',
    cost: 'Medium',
    strengths: ['Full control over each step', 'Best for debugging', 'Flexible'],
    weaknesses: ['Highest latency', 'More complex', 'No real-time streaming'],
  },
} as const;

/**
 * Adapter for Gemini Live Client.
 */
class GeminiAdapter extends EventEmitter implements UnifiedVoiceAgent {
  readonly provider: VoiceAgentProvider = 'gemini';
  private client: GeminiLiveClient;

  constructor(config: UnifiedVoiceAgentConfig) {
    super();
    const geminiConfig = {
      apiKey: config.apiKey,
      voice: config.voice as GeminiLiveConfig['voice'],
      systemInstruction: config.systemInstruction,
      languageCode: config.language || 'de-DE',
      tools: config.tools?.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })) as GeminiTool[],
      ...config.providerOptions,
    } as any;
    this.client = new GeminiLiveClient(geminiConfig);
    this.setupEventForwarding();
  }

  private setupEventForwarding(): void {
    this.client.on('connected', () => this.emit('connected'));
    this.client.on('disconnected', (reason) => this.emit('disconnected', reason));
    this.client.on('transcriptInterim', (text) => this.emit('transcribed', text, false));
    this.client.on('transcriptFinal', (text) => this.emit('transcribed', text, true));
    this.client.on('textResponse', (text) => this.emit('responseText', text, false));
    this.client.on('audioResponse', (audio) => this.emit('responseAudio', audio));
    this.client.on('functionCall', (name, args) => this.emit('functionCall', name, name, args));
    this.client.on('voiceActivity', (active) => this.emit('voiceActivity', active));
    this.client.on('turnComplete', () => {
      this.emit('audioDone');
      this.emit('turnComplete');
    });
    this.client.on('error', (err) => this.emit('error', err));
  }

  get isReady(): boolean {
    return this.client.connected;
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  disconnect(): void {
    this.client.disconnect();
  }

  sendAudio(audioData: ArrayBuffer | Blob): void {
    if (audioData instanceof Blob) {
      audioData.arrayBuffer().then((buffer) => this.client.sendAudio(buffer));
    } else {
      this.client.sendAudio(audioData);
    }
  }

  sendText(text: string): void {
    this.client.sendText(text);
  }

  sendFunctionResult(callId: string, result: unknown): void {
    this.client.sendFunctionResult(callId, result);
  }

  interrupt(): void {
    this.client.interrupt();
  }
}

/**
 * Adapter for ElevenLabs Conversational Agent.
 */
class ElevenLabsAdapter extends EventEmitter implements UnifiedVoiceAgent {
  readonly provider: VoiceAgentProvider = 'elevenlabs';
  private client: ElevenLabsConversationalAgent;
  private ready = false;

  constructor(config: UnifiedVoiceAgentConfig) {
    super();
    const elevenlabsConfig = {
      apiKey: config.apiKey,
      voiceId: config.voice || 'pNInz6obpgDQGcFmaJgB', // Adam
      systemPrompt: config.systemInstruction,
      language: config.language || 'de',
      tools: config.tools as any,
      ...config.providerOptions,
    } as any;
    this.client = new ElevenLabsConversationalAgent(elevenlabsConfig);
    this.setupEventForwarding();
  }

  private setupEventForwarding(): void {
    this.client.on('conversationStarted', () => {
      this.ready = true;
      this.emit('connected');
    });
    this.client.on('conversationEnded', () => {
      this.ready = false;
      this.emit('disconnected');
    });
    this.client.on('transcriptInterim', (text) => this.emit('transcribed', text, false));
    this.client.on('transcriptFinal', (text) => this.emit('transcribed', text, true));
    this.client.on('agentResponse', (text) => this.emit('responseText', text, false));
    this.client.on('audioData', (audio) => this.emit('responseAudio', audio));
    this.client.on('audioComplete', () => this.emit('audioDone'));
    this.client.on('functionCall', (name, args) => this.emit('functionCall', name, name, args));
    this.client.on('userSpeaking', (speaking) => this.emit('voiceActivity', speaking));
    this.client.on('turnComplete', () => this.emit('turnComplete'));
    this.client.on('error', (err) => this.emit('error', err));
  }

  get isReady(): boolean {
    return this.ready;
  }

  async connect(): Promise<void> {
    await this.client.startConversation();
  }

  disconnect(): void {
    this.client.endConversation();
  }

  sendAudio(audioData: ArrayBuffer | Blob): void {
    if (audioData instanceof Blob) {
      audioData.arrayBuffer().then((buffer) => this.client.sendAudio(buffer));
    } else {
      this.client.sendAudio(audioData);
    }
  }

  sendText(text: string): void {
    this.client.sendText(text);
  }

  sendFunctionResult(callId: string, result: unknown): void {
    this.client.sendFunctionResult(callId, result);
  }

  interrupt(): void {
    this.client.interrupt();
  }
}

/**
 * Adapter for OpenAI Realtime Client.
 */
class OpenAIRealtimeAdapter extends EventEmitter implements UnifiedVoiceAgent {
  readonly provider: VoiceAgentProvider = 'openai-realtime';
  private client: OpenAIRealtimeClient;

  constructor(config: UnifiedVoiceAgentConfig) {
    super();
    const openaiConfig = {
      apiKey: config.apiKey,
      voice: config.voice as OpenAIRealtimeConfig['voice'],
      systemInstruction: config.systemInstruction,
      tools: config.tools as any,
      ...config.providerOptions,
    } as any;
    this.client = new OpenAIRealtimeClient(openaiConfig);
    this.setupEventForwarding();
  }

  private setupEventForwarding(): void {
    this.client.on('connected', () => this.emit('connected'));
    this.client.on('disconnected', (reason) => this.emit('disconnected', reason));
    this.client.on('transcriptDone', (text) => this.emit('transcribed', text, true));
    this.client.on('responseDelta', (text) => this.emit('responseText', text, true));
    this.client.on('responseDone', (text) => this.emit('responseText', text, false));
    this.client.on('audioDelta', (audio) => this.emit('responseAudio', audio));
    this.client.on('audioDone', () => {
      this.emit('audioDone');
      this.emit('turnComplete');
    });
    this.client.on('functionCall', (name, callId, args) =>
      this.emit('functionCall', name, callId, args)
    );
    this.client.on('speechStarted', () => this.emit('voiceActivity', true));
    this.client.on('speechStopped', () => this.emit('voiceActivity', false));
    this.client.on('error', (err) => this.emit('error', err));
  }

  get isReady(): boolean {
    return this.client.connected;
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  disconnect(): void {
    this.client.disconnect();
  }

  sendAudio(audioData: ArrayBuffer | Blob): void {
    if (audioData instanceof Blob) {
      audioData.arrayBuffer().then((buffer) => this.client.sendAudio(buffer));
    } else {
      this.client.sendAudio(audioData);
    }
  }

  sendText(text: string): void {
    this.client.sendText(text);
  }

  sendFunctionResult(callId: string, result: unknown): void {
    this.client.sendFunctionResult(callId, result);
  }

  interrupt(): void {
    this.client.cancelResponse();
  }
}

/**
 * Adapter for OpenAI Pipeline Client.
 */
class OpenAIPipelineAdapter extends EventEmitter implements UnifiedVoiceAgent {
  readonly provider: VoiceAgentProvider = 'openai-pipeline';
  private client: OpenAIPipelineClient;
  private ready = false;

  constructor(config: UnifiedVoiceAgentConfig) {
    super();
    const pipelineConfig = {
      apiKey: config.apiKey,
      voice: config.voice as OpenAIPipelineConfig['voice'],
      systemInstruction: config.systemInstruction,
      language: config.language?.split('-')[0] || 'de',
      tools: config.tools as any,
      ...config.providerOptions,
    } as any;
    this.client = new OpenAIPipelineClient(pipelineConfig);
    this.setupEventForwarding();
  }

  private setupEventForwarding(): void {
    this.client.on('transcribing', () => this.emit('voiceActivity', true));
    this.client.on('transcribed', (text) => {
      this.emit('voiceActivity', false);
      this.emit('transcribed', text, true);
    });
    this.client.on('responseDelta', (text) => this.emit('responseText', text, true));
    this.client.on('responseDone', (text) => this.emit('responseText', text, false));
    this.client.on('audioDelta', (audio) => this.emit('responseAudio', audio));
    this.client.on('audioDone', () => {
      this.emit('audioDone');
      this.emit('turnComplete');
    });
    this.client.on('functionCall', (name, args) => this.emit('functionCall', name, name, args));
    this.client.on('error', (err) => this.emit('error', err));
  }

  get isReady(): boolean {
    return this.ready;
  }

  async connect(): Promise<void> {
    // Pipeline doesn't need persistent connection
    this.ready = true;
    this.emit('connected');
  }

  disconnect(): void {
    this.ready = false;
    this.client.clearHistory();
    this.emit('disconnected');
  }

  sendAudio(audioData: ArrayBuffer | Blob): void {
    const blob =
      audioData instanceof Blob ? audioData : new Blob([audioData], { type: 'audio/wav' });
    this.client.processAudio(blob);
  }

  sendText(text: string): void {
    this.client.sendText(text);
  }

  sendFunctionResult(callId: string, result: unknown): void {
    this.client.sendFunctionResult(callId, result);
  }

  interrupt(): void {
    // Pipeline doesn't support interruption (not streaming)
    console.warn('OpenAI Pipeline does not support interruption');
  }
}

/**
 * Factory for creating voice agents.
 *
 * @example
 * ```typescript
 * // Create a Gemini agent
 * const agent = VoiceAgentFactory.create({
 *   provider: 'gemini',
 *   apiKey: process.env.GOOGLE_AI_API_KEY!,
 *   voice: 'Kore',
 *   systemInstruction: 'Du bist ein freundlicher Assistent.',
 *   tools: [{ name: 'get_invoice', description: '...', parameters: { ... } }]
 * });
 *
 * agent.on('transcribed', (text, isFinal) => console.log('User:', text));
 * agent.on('responseText', (text) => console.log('Agent:', text));
 * agent.on('responseAudio', (audio) => playAudio(audio));
 *
 * await agent.connect();
 * agent.sendAudio(audioBuffer);
 * ```
 */
export class VoiceAgentFactory {
  /**
   * Create a voice agent for the specified provider.
   * @param config
   */
  static create(config: UnifiedVoiceAgentConfig): UnifiedVoiceAgent {
    switch (config.provider) {
      case 'gemini':
        return new GeminiAdapter(config);
      case 'elevenlabs':
        return new ElevenLabsAdapter(config);
      case 'openai-realtime':
        return new OpenAIRealtimeAdapter(config);
      case 'openai-pipeline':
        return new OpenAIPipelineAdapter(config);
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }

  /**
   * Get characteristics for a provider.
   * @param provider
   */
  static getCharacteristics(provider: VoiceAgentProvider) {
    return PROVIDER_CHARACTERISTICS[provider];
  }

  /**
   * Get all provider characteristics.
   */
  static getAllCharacteristics() {
    return PROVIDER_CHARACTERISTICS;
  }

  /**
   * Recommend a provider based on requirements.
   * @param requirements
   * @param requirements.prioritizeLatency
   * @param requirements.prioritizeVoiceQuality
   * @param requirements.prioritizeControl
   * @param requirements.prioritizeCost
   */
  static recommend(requirements: {
    prioritizeLatency?: boolean;
    prioritizeVoiceQuality?: boolean;
    prioritizeControl?: boolean;
    prioritizeCost?: boolean;
  }): VoiceAgentProvider {
    const { prioritizeLatency, prioritizeVoiceQuality, prioritizeControl, prioritizeCost } =
      requirements;

    if (prioritizeLatency) return 'gemini';
    if (prioritizeVoiceQuality) return 'elevenlabs';
    if (prioritizeControl) return 'openai-pipeline';
    if (prioritizeCost) return 'gemini';

    // Default recommendation
    return 'gemini';
  }
}

export default VoiceAgentFactory;
