/**
 * OpenAI Pipeline Client for VoiceInvoice.
 *
 * Classic STT → LLM → TTS pipeline using:
 * - Whisper for speech-to-text
 * - GPT-4o for conversation
 * - OpenAI TTS for text-to-speech
 *
 * Higher latency (~800-1200ms) but more control over each step.
 *
 * @see https://platform.openai.com/docs/guides/speech-to-text
 * @see https://platform.openai.com/docs/guides/text-to-speech
 *
 * @module lib/voice-agent
 */

import { EventEmitter } from 'events';

/**
 * Configuration for OpenAI Pipeline client.
 */
export interface OpenAIPipelineConfig {
  /** OpenAI API key */
  apiKey: string;
  /** Whisper model (default: whisper-1) */
  whisperModel?: string;
  /** Chat model (default: gpt-4o) */
  chatModel?: string;
  /** TTS model (default: tts-1) */
  ttsModel?: 'tts-1' | 'tts-1-hd';
  /** Voice for TTS */
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  /** System instruction for GPT */
  systemInstruction?: string;
  /** Language hint for Whisper */
  language?: string;
  /** TTS output format */
  responseFormat?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
  /** TTS speed (0.25 to 4.0) */
  speed?: number;
  /** Tools/functions the model can call */
  tools?: OpenAIPipelineTool[];
}

/**
 * Tool definition for function calling.
 */
export interface OpenAIPipelineTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description?: string; enum?: string[] }>;
      required?: string[];
    };
  };
}

/**
 * Events emitted by the OpenAI Pipeline client.
 */
export interface OpenAIPipelineEvents {
  /** Transcription started */
  transcribing: () => void;
  /** Transcription complete */
  transcribed: (text: string) => void;
  /** LLM processing started */
  thinking: () => void;
  /** LLM response streaming */
  responseDelta: (text: string) => void;
  /** LLM response complete */
  responseDone: (text: string) => void;
  /** TTS started */
  synthesizing: () => void;
  /** TTS audio chunk */
  audioDelta: (audioData: ArrayBuffer) => void;
  /** TTS complete */
  audioDone: () => void;
  /** Function call requested */
  functionCall: (name: string, args: Record<string, unknown>) => void;
  /** Error occurred */
  error: (error: Error) => void;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

const DEFAULT_CONFIG: Partial<OpenAIPipelineConfig> = {
  whisperModel: 'whisper-1',
  chatModel: 'gpt-4o',
  ttsModel: 'tts-1',
  voice: 'nova',
  language: 'de',
  responseFormat: 'pcm',
  speed: 1.0,
};

/**
 * OpenAI Pipeline client for voice interactions.
 *
 * Uses separate API calls for each step:
 * 1. Whisper: Audio → Text
 * 2. GPT-4o: Text → Response
 * 3. TTS: Response → Audio
 *
 * @example
 * ```typescript
 * const client = new OpenAIPipelineClient({
 *   apiKey: process.env.OPENAI_API_KEY!,
 *   voice: 'nova',
 *   systemInstruction: 'Du bist ein Assistent für Rechnungserinnerungen.',
 *   tools: [{
 *     type: 'function',
 *     function: {
 *       name: 'get_invoice',
 *       description: 'Lade Rechnungsdaten',
 *       parameters: {
 *         type: 'object',
 *         properties: {
 *           invoiceNumber: { type: 'string' }
 *         }
 *       }
 *     }
 *   }]
 * });
 *
 * client.on('transcribed', (text) => console.log('User said:', text));
 * client.on('audioDelta', (audio) => playAudio(audio));
 *
 * await client.processAudio(audioBlob);
 * ```
 */
export class OpenAIPipelineClient extends EventEmitter {
  private config: OpenAIPipelineConfig;
  private conversationHistory: ChatMessage[] = [];
  private pendingToolCalls: Map<string, { name: string; args: Record<string, unknown> }> = new Map();

  constructor(config: OpenAIPipelineConfig) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config } as OpenAIPipelineConfig;

    // Initialize conversation with system message
    if (this.config.systemInstruction) {
      this.conversationHistory.push({
        role: 'system',
        content: this.config.systemInstruction,
      });
    }
  }

  /**
   * Process audio through the full pipeline.
   *
   * @param audioBlob - Audio blob (WAV, MP3, etc.)
   */
  async processAudio(audioBlob: Blob): Promise<void> {
    try {
      // Step 1: Transcribe with Whisper
      this.emit('transcribing');
      const transcript = await this.transcribe(audioBlob);
      this.emit('transcribed', transcript);

      // Step 2: Process with GPT
      await this.chat(transcript);
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Send text directly (skip transcription).
   */
  async sendText(text: string): Promise<void> {
    try {
      await this.chat(text);
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Send function result back to continue conversation.
   */
  async sendFunctionResult(callId: string, result: unknown): Promise<void> {
    const toolCall = this.pendingToolCalls.get(callId);
    if (!toolCall) {
      this.emit('error', new Error(`Unknown tool call ID: ${callId}`));
      return;
    }

    this.pendingToolCalls.delete(callId);

    // Add tool response to history
    this.conversationHistory.push({
      role: 'tool',
      content: JSON.stringify(result),
      tool_call_id: callId,
    });

    // Continue conversation
    await this.continueAfterToolCall();
  }

  /**
   * Transcribe audio using Whisper.
   */
  private async transcribe(audioBlob: Blob): Promise<string> {
    const { apiKey, whisperModel, language } = this.config;

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav');
    formData.append('model', whisperModel!);
    if (language) {
      formData.append('language', language);
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Transcription failed');
    }

    const result = await response.json();
    return result.text;
  }

  /**
   * Chat with GPT and synthesize response.
   */
  private async chat(userMessage: string): Promise<void> {
    const { apiKey, chatModel, tools } = this.config;

    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    this.emit('thinking');

    const requestBody: Record<string, unknown> = {
      model: chatModel,
      messages: this.conversationHistory,
      stream: true,
    };

    if (tools && tools.length > 0) {
      requestBody.tools = tools;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Chat failed');
    }

    // Process streaming response
    await this.processStreamingResponse(response);
  }

  /**
   * Process streaming chat response.
   */
  private async processStreamingResponse(response: Response): Promise<void> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let fullResponse = '';
    let toolCalls: Array<{ id: string; name: string; arguments: string }> = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter((line) => line.startsWith('data: '));

      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;

          if (delta?.content) {
            fullResponse += delta.content;
            this.emit('responseDelta', delta.content);
          }

          // Handle tool calls
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.index !== undefined) {
                if (!toolCalls[tc.index]) {
                  toolCalls[tc.index] = { id: tc.id || '', name: '', arguments: '' };
                }
                if (tc.id) toolCalls[tc.index].id = tc.id;
                if (tc.function?.name) toolCalls[tc.index].name = tc.function.name;
                if (tc.function?.arguments) toolCalls[tc.index].arguments += tc.function.arguments;
              }
            }
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }

    // Handle tool calls if any
    if (toolCalls.length > 0) {
      // Add assistant message with tool calls to history
      this.conversationHistory.push({
        role: 'assistant',
        content: fullResponse,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      });

      // Emit function calls
      for (const tc of toolCalls) {
        try {
          const args = JSON.parse(tc.arguments);
          this.pendingToolCalls.set(tc.id, { name: tc.name, args });
          this.emit('functionCall', tc.name, args);
        } catch {
          this.pendingToolCalls.set(tc.id, { name: tc.name, args: {} });
          this.emit('functionCall', tc.name, {});
        }
      }
      return;
    }

    // Add assistant response to history
    this.conversationHistory.push({
      role: 'assistant',
      content: fullResponse,
    });

    this.emit('responseDone', fullResponse);

    // Step 3: Synthesize response
    if (fullResponse) {
      await this.synthesize(fullResponse);
    }
  }

  /**
   * Continue conversation after tool call results.
   */
  private async continueAfterToolCall(): Promise<void> {
    const { apiKey, chatModel, tools } = this.config;

    this.emit('thinking');

    const requestBody: Record<string, unknown> = {
      model: chatModel,
      messages: this.conversationHistory,
      stream: true,
    };

    if (tools && tools.length > 0) {
      requestBody.tools = tools;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Chat continuation failed');
    }

    await this.processStreamingResponse(response);
  }

  /**
   * Synthesize text to speech using OpenAI TTS.
   */
  private async synthesize(text: string): Promise<void> {
    const { apiKey, ttsModel, voice, responseFormat, speed } = this.config;

    this.emit('synthesizing');

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ttsModel,
        input: text,
        voice,
        response_format: responseFormat,
        speed,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'TTS failed');
    }

    // Stream audio response
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No audio response');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      this.emit('audioDelta', value.buffer);
    }

    this.emit('audioDone');
  }

  /**
   * Clear conversation history.
   */
  clearHistory(): void {
    this.conversationHistory = [];
    if (this.config.systemInstruction) {
      this.conversationHistory.push({
        role: 'system',
        content: this.config.systemInstruction,
      });
    }
    this.pendingToolCalls.clear();
  }

  /**
   * Get conversation history.
   */
  getHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }
}

export default OpenAIPipelineClient;
