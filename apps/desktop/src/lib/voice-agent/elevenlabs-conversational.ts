/**
 * ElevenLabs Conversational AI 2.0 Client for VoiceInvoice.
 *
 * Provides voice agent capabilities with natural turn-taking,
 * multilingual support, and integrated RAG.
 *
 * @see https://elevenlabs.io/docs/conversational-ai/overview
 * @see https://elevenlabs.io/blog/conversational-ai-2-0
 *
 * @module lib/voice-agent
 */

import { EventEmitter } from 'events';

/**
 * Configuration for ElevenLabs Conversational AI agent.
 */
export interface ElevenLabsAgentConfig {
  /** ElevenLabs API key */
  apiKey: string;
  /** Agent ID (pre-configured) or inline config */
  agentId?: string;
  /** Voice ID for TTS */
  voiceId?: string;
  /** Model for TTS (default: eleven_turbo_v2_5) */
  ttsModel?: 'eleven_multilingual_v2' | 'eleven_turbo_v2_5' | 'eleven_v3';
  /** LLM provider configuration */
  llm?: {
    provider: 'gemini' | 'openai' | 'anthropic' | 'custom';
    model: string;
    systemPrompt: string;
    temperature?: number;
  };
  /** First message spoken by agent */
  firstMessage?: string;
  /** Language (auto-detected if not set) */
  language?: string;
  /** Enable automatic language detection */
  autoDetectLanguage?: boolean;
  /** Tools/functions the agent can call */
  tools?: ElevenLabsTool[];
  /** Knowledge base IDs for RAG */
  knowledgeBaseIds?: string[];
  /** Webhook URL for events */
  webhookUrl?: string;
}

/**
 * Tool definition for ElevenLabs agent.
 */
export interface ElevenLabsTool {
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
 * Events emitted by the ElevenLabs agent.
 */
export interface ElevenLabsAgentEvents {
  connected: () => void;
  disconnected: (reason?: string) => void;
  agentResponse: (text: string) => void;
  agentAudio: (audioData: ArrayBuffer) => void;
  userTranscript: (text: string, isFinal: boolean) => void;
  functionCall: (name: string, args: Record<string, unknown>) => void;
  turnTaking: (who: 'user' | 'agent') => void;
  interrupt: () => void;
  error: (error: Error) => void;
  conversationEnd: (summary: ConversationSummary) => void;
}

/**
 * Summary of a completed conversation.
 */
export interface ConversationSummary {
  conversationId: string;
  duration: number;
  transcript: Array<{
    role: 'user' | 'agent';
    text: string;
    timestamp: number;
  }>;
  outcome?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

/**
 * German voice presets for ElevenLabs.
 */
export const GERMAN_VOICES = {
  /** Professional female voice */
  ANNA: 'XB0fDUnXU5powFXDhCwa',
  /** Professional male voice */
  MARKUS: 'CYw3kZ02Hs0563khs1Fj',
  /** Friendly female voice */
  LENA: 'jBpfuIE2acCO8z3wKNLl',
  /** Neutral male voice */
  THOMAS: 'IKne3meq5aSn9XLyUdCD',
} as const;

const DEFAULT_CONFIG: Partial<ElevenLabsAgentConfig> = {
  voiceId: GERMAN_VOICES.ANNA,
  ttsModel: 'eleven_turbo_v2_5',
  autoDetectLanguage: true,
  llm: {
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    systemPrompt: 'Du bist ein freundlicher Telefonassistent.',
    temperature: 0.7,
  },
};

/**
 * ElevenLabs Conversational AI 2.0 client for voice agents.
 *
 * Features:
 * - Natural turn-taking with custom models
 * - Automatic language detection
 * - Integrated RAG for knowledge bases
 * - Barge-in detection
 * - Function calling
 *
 * @example
 * ```typescript
 * const agent = new ElevenLabsConversationalAgent({
 *   apiKey: process.env.ELEVENLABS_API_KEY!,
 *   voiceId: GERMAN_VOICES.ANNA,
 *   llm: {
 *     provider: 'gemini',
 *     model: 'gemini-2.5-flash',
 *     systemPrompt: `Du bist ein Telefonassistent für Rechnungserinnerungen.
 *       Sei freundlich aber bestimmt. Frage nach dem Zahlungstermin.`,
 *   },
 *   firstMessage: 'Guten Tag, hier ist der automatische Assistent.',
 *   tools: [{
 *     type: 'function',
 *     function: {
 *       name: 'get_invoice',
 *       description: 'Lade Rechnungsdetails',
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
 * agent.on('userTranscript', (text, isFinal) => {
 *   if (isFinal) console.log('User said:', text);
 * });
 *
 * agent.on('functionCall', async (name, args) => {
 *   const result = await handleFunction(name, args);
 *   agent.sendFunctionResult(name, result);
 * });
 *
 * await agent.startConversation();
 * ```
 */
export class ElevenLabsConversationalAgent extends EventEmitter {
  private config: ElevenLabsAgentConfig;
  private ws: WebSocket | null = null;
  private conversationId: string | null = null;
  private isConnected = false;
  private transcript: ConversationSummary['transcript'] = [];
  private startTime = 0;

  constructor(config: ElevenLabsAgentConfig) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config } as ElevenLabsAgentConfig;
  }

  /**
   * Start a new conversation session.
   */
  async startConversation(): Promise<string> {
    const { apiKey, agentId } = this.config;

    // Get signed URL for WebSocket connection
    const response = await fetch('https://api.elevenlabs.io/v1/convai/conversation/get_signed_url', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_id: agentId,
        agent_config: agentId ? undefined : this.buildAgentConfig(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get signed URL: ${response.status}`);
    }

    const { signed_url, conversation_id } = await response.json();
    this.conversationId = conversation_id;
    this.startTime = Date.now();

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(signed_url);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.emit('connected');
        resolve(conversation_id);
      };

      this.ws.onclose = (event) => {
        this.isConnected = false;
        this.emitConversationEnd();
        this.emit('disconnected', event.reason);
      };

      this.ws.onerror = () => {
        const err = new Error('WebSocket connection failed');
        this.emit('error', err);
        reject(err);
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    });
  }

  /**
   * Build inline agent configuration.
   */
  private buildAgentConfig(): Record<string, unknown> {
    const { voiceId, ttsModel, llm, firstMessage, language, autoDetectLanguage, tools, knowledgeBaseIds } =
      this.config;

    return {
      conversation: {
        tts: {
          voice_id: voiceId,
          model_id: ttsModel,
        },
        stt: {
          provider: 'elevenlabs', // Uses ElevenLabs' optimized STT
        },
        llm: {
          provider: llm?.provider,
          model: llm?.model,
          system_prompt: llm?.systemPrompt,
          temperature: llm?.temperature,
        },
        first_message: firstMessage,
        language: autoDetectLanguage ? undefined : language,
        language_detection: autoDetectLanguage,
        turn_taking: {
          mode: 'natural', // Conversational AI 2.0 natural turn-taking
        },
        tools: tools?.map((t) => t.function),
        knowledge_base_ids: knowledgeBaseIds,
      },
    };
  }

  /**
   * Handle incoming WebSocket messages.
   */
  private handleMessage(data: string | Blob): void {
    // Handle binary audio data
    if (data instanceof Blob) {
      data.arrayBuffer().then((buffer) => {
        this.emit('agentAudio', buffer);
      });
      return;
    }

    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'audio':
          // Base64 encoded audio
          if (message.audio) {
            const audioData = this.base64ToArrayBuffer(message.audio);
            this.emit('agentAudio', audioData);
          }
          break;

        case 'agent_response':
          this.emit('agentResponse', message.text);
          this.transcript.push({
            role: 'agent',
            text: message.text,
            timestamp: Date.now() - this.startTime,
          });
          break;

        case 'user_transcript':
          this.emit('userTranscript', message.text, message.is_final);
          if (message.is_final) {
            this.transcript.push({
              role: 'user',
              text: message.text,
              timestamp: Date.now() - this.startTime,
            });
          }
          break;

        case 'function_call':
          this.emit('functionCall', message.function_name, message.arguments || {});
          break;

        case 'turn_taking':
          this.emit('turnTaking', message.speaker);
          break;

        case 'interruption':
          this.emit('interrupt');
          break;

        case 'conversation_end':
          this.emitConversationEnd(message.outcome, message.sentiment);
          break;

        case 'error':
          this.emit('error', new Error(message.message || 'Unknown error'));
          break;
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  /**
   * Send audio to the agent.
   *
   * @param audioData - PCM16 audio at 16kHz, mono
   */
  sendAudio(audioData: ArrayBuffer): void {
    if (!this.isConnected || !this.ws) return;

    // Send as binary for lower latency
    this.ws.send(audioData);
  }

  /**
   * Send text input (for text-based interaction).
   */
  sendText(text: string): void {
    if (!this.isConnected || !this.ws) return;

    this.ws.send(
      JSON.stringify({
        type: 'user_input',
        text,
      })
    );
  }

  /**
   * Send function call result.
   */
  sendFunctionResult(functionName: string, result: unknown): void {
    if (!this.isConnected || !this.ws) return;

    this.ws.send(
      JSON.stringify({
        type: 'function_result',
        function_name: functionName,
        result,
      })
    );
  }

  /**
   * Interrupt the agent (barge-in).
   */
  interrupt(): void {
    if (!this.isConnected || !this.ws) return;

    this.ws.send(
      JSON.stringify({
        type: 'interrupt',
      })
    );
  }

  /**
   * End the conversation.
   */
  endConversation(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  /**
   * Get current conversation ID.
   */
  get currentConversationId(): string | null {
    return this.conversationId;
  }

  /**
   * Check if connected.
   */
  get connected(): boolean {
    return this.isConnected;
  }

  private emitConversationEnd(outcome?: string, sentiment?: string): void {
    const summary: ConversationSummary = {
      conversationId: this.conversationId || '',
      duration: Date.now() - this.startTime,
      transcript: this.transcript,
      outcome,
      sentiment: sentiment as ConversationSummary['sentiment'],
    };
    this.emit('conversationEnd', summary);
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

/**
 * Create an ElevenLabs agent for invoice reminders.
 */
export function createInvoiceReminderAgent(
  apiKey: string,
  options: {
    customerName: string;
    invoiceNumber: string;
    amount: number;
    dueDate: string;
    urgency?: 'freundlich' | 'normal' | 'dringend';
  }
): ElevenLabsConversationalAgent {
  const urgencyPrompts = {
    freundlich: 'Sei besonders freundlich und verständnisvoll.',
    normal: 'Sei professionell und freundlich.',
    dringend: 'Sei höflich aber bestimmt. Betone die Dringlichkeit.',
  };

  return new ElevenLabsConversationalAgent({
    apiKey,
    voiceId: GERMAN_VOICES.ANNA,
    ttsModel: 'eleven_turbo_v2_5',
    llm: {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      systemPrompt: `Du bist ein Telefonassistent für Rechnungserinnerungen.
${urgencyPrompts[options.urgency || 'normal']}

Kundeninformationen:
- Name: ${options.customerName}
- Rechnungsnummer: ${options.invoiceNumber}
- Betrag: ${options.amount.toFixed(2)} €
- Fälligkeitsdatum: ${options.dueDate}

Deine Aufgabe:
1. Begrüße den Kunden höflich
2. Erkläre den Grund des Anrufs (offene Rechnung)
3. Frage nach dem voraussichtlichen Zahlungstermin
4. Beantworte Fragen zur Rechnung
5. Bedanke dich und verabschiede dich

Wichtig:
- Sprich natürlich und nicht roboterhaft
- Halte Antworten kurz (max 2-3 Sätze)
- Bei Problemen: biete Rückruf durch Mitarbeiter an
- Notiere alle wichtigen Informationen`,
      temperature: 0.7,
    },
    firstMessage: `Guten Tag, hier spricht der automatische Assistent. Spreche ich mit ${options.customerName}?`,
    tools: [
      {
        type: 'function',
        function: {
          name: 'schedule_callback',
          description: 'Plant einen Rückruf durch einen Mitarbeiter',
          parameters: {
            type: 'object',
            properties: {
              preferredTime: {
                type: 'string',
                description: 'Gewünschte Rückrufzeit',
              },
              reason: {
                type: 'string',
                description: 'Grund für den Rückruf',
              },
            },
            required: ['reason'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'record_payment_promise',
          description: 'Notiert eine Zahlungszusage',
          parameters: {
            type: 'object',
            properties: {
              promisedDate: {
                type: 'string',
                description: 'Zugesagtes Zahlungsdatum',
              },
              amount: {
                type: 'number',
                description: 'Zugesagter Betrag',
              },
              notes: {
                type: 'string',
                description: 'Zusätzliche Notizen',
              },
            },
            required: ['promisedDate'],
          },
        },
      },
    ],
  });
}

/**
 * Create an ElevenLabs agent for appointment reminders.
 */
export function createAppointmentReminderAgent(
  apiKey: string,
  options: {
    customerName: string;
    appointmentDate: string;
    appointmentTime: string;
    location?: string;
    description?: string;
  }
): ElevenLabsConversationalAgent {
  return new ElevenLabsConversationalAgent({
    apiKey,
    voiceId: GERMAN_VOICES.ANNA,
    ttsModel: 'eleven_turbo_v2_5',
    llm: {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      systemPrompt: `Du bist ein Telefonassistent für Terminerinnerungen.
Sei freundlich und hilfsbereit.

Termininformationen:
- Kunde: ${options.customerName}
- Datum: ${options.appointmentDate}
- Uhrzeit: ${options.appointmentTime}
${options.location ? `- Ort: ${options.location}` : ''}
${options.description ? `- Betreff: ${options.description}` : ''}

Deine Aufgabe:
1. Begrüße den Kunden höflich
2. Erinnere an den bevorstehenden Termin
3. Bitte um Bestätigung oder frage nach Änderungswünschen
4. Bei Absage: biete Alternativtermin an
5. Bedanke dich und verabschiede dich

Wichtig:
- Sprich natürlich und freundlich
- Halte Antworten kurz
- Sei flexibel bei Terminänderungen`,
      temperature: 0.7,
    },
    firstMessage: `Guten Tag, hier spricht der automatische Terminservice. Spreche ich mit ${options.customerName}?`,
    tools: [
      {
        type: 'function',
        function: {
          name: 'confirm_appointment',
          description: 'Bestätigt den Termin',
          parameters: {
            type: 'object',
            properties: {
              confirmed: { type: 'boolean' },
              notes: { type: 'string' },
            },
            required: ['confirmed'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'reschedule_appointment',
          description: 'Plant den Termin um',
          parameters: {
            type: 'object',
            properties: {
              newDate: { type: 'string' },
              newTime: { type: 'string' },
              reason: { type: 'string' },
            },
            required: ['reason'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'cancel_appointment',
          description: 'Sagt den Termin ab',
          parameters: {
            type: 'object',
            properties: {
              reason: { type: 'string' },
              reschedule: { type: 'boolean' },
            },
            required: ['reason'],
          },
        },
      },
    ],
  });
}

export default ElevenLabsConversationalAgent;
