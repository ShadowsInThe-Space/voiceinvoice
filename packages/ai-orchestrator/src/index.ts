/**
 * AI Orchestrator for VoiceInvoice Enterprise.
 *
 * Manages the flow from voice input to structured invoice data:
 * 1. Intent classification (Invoice vs Analytics)
 * 2. Privacy pre-processing
 * 3. Gemini API integration for entity extraction
 * 4. Confidence-based routing (direct save vs user preview)
 *
 * Uses a hybrid approach with rule-based heuristics for common
 * patterns and Gemini fallback for complex cases.
 *
 * @packageDocumentation
 * @module @voiceinvoice/ai-orchestrator
 */

/**
 * Detected intent from voice input.
 *
 * - INVOICE: User wants to create or manage an invoice
 * - ANALYTICS: User is asking for reports or statistics
 * - UNKNOWN: Intent could not be determined
 */
export type Intent = 'INVOICE' | 'ANALYTICS' | 'UNKNOWN';

/**
 * Result of intent classification.
 *
 * Contains the detected intent and confidence score
 * for routing decisions.
 */
export interface IntentResult {
  /** Detected intent category */
  intent: Intent;

  /** Confidence score (0.0 to 1.0) */
  confidence: number;

  /** Method used for classification */
  method: 'RULES' | 'GEMINI';

  /** Processing time in milliseconds */
  latencyMs: number;
}

/**
 * Extracted invoice data from voice input.
 *
 * Contains all structured fields extracted by Gemini
 * with confidence scores for each field.
 */
export interface ExtractedInvoiceData {
  /** Extracted customer name */
  customerName?: string;

  /** Extracted amount in EUR */
  amount?: number;

  /** Extracted or default tax rate */
  taxRate?: number;

  /** Extracted description/notes */
  description?: string;

  /** Overall extraction confidence */
  confidence: number;

  /** Per-field confidence scores */
  fieldConfidences: Record<string, number>;
}

/**
 * Orchestration result for the complete pipeline.
 *
 * Contains all processing results and routing decision.
 */
export interface OrchestrationResult {
  /** Original transcription */
  transcription: string;

  /** Intent classification result */
  intent: IntentResult;

  /** Extracted invoice data (if intent is INVOICE) */
  invoiceData?: ExtractedInvoiceData;

  /** Whether to show preview or save directly */
  requiresPreview: boolean;

  /** Total processing time in milliseconds */
  totalLatencyMs: number;
}

/**
 * Configuration for the Agent Orchestrator.
 *
 * Controls behavior thresholds and API settings.
 */
export interface OrchestratorConfig {
  /** Confidence threshold for direct save (default: 0.85) */
  directSaveThreshold: number;

  /** Whether to use Gemini fallback for intent (default: true) */
  useGeminiFallback: boolean;

  /** Maximum latency budget in ms (default: 2000) */
  maxLatencyMs: number;
}

/**
 * AI Agent Orchestrator for voice-to-invoice processing.
 *
 * This class manages the complete pipeline from voice transcription
 * to structured invoice data, implementing the hybrid smart one-shot
 * approach defined in the architecture.
 *
 * The orchestrator uses a two-stage intent classification:
 * 1. Fast rule-based matching (< 50ms)
 * 2. Gemini fallback for ambiguous cases
 *
 * For invoice extraction, it uses Gemini's Function Calling API
 * to ensure type-safe, structured output.
 *
 * @example
 * const orchestrator = new AgentOrchestrator({
 *   directSaveThreshold: 0.85,
 *   useGeminiFallback: true,
 *   maxLatencyMs: 2000
 * });
 *
 * const result = await orchestrator.process(
 *   'Rechnung an Müller GmbH über tausend Euro'
 * );
 *
 * if (result.requiresPreview) {
 *   // Show confirmation dialog
 * } else {
 *   // Save directly
 * }
 */
export class AgentOrchestrator {
  private readonly config: OrchestratorConfig;

  /**
   * Creates a new AgentOrchestrator instance.
   *
   * @param {Partial<OrchestratorConfig>} config - Configuration overrides
   */
  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = {
      directSaveThreshold: config.directSaveThreshold ?? 0.85,
      useGeminiFallback: config.useGeminiFallback ?? true,
      maxLatencyMs: config.maxLatencyMs ?? 2000,
    };
  }

  /**
   * Processes transcribed text through the full pipeline.
   *
   * This is the main entry point for voice-to-invoice processing.
   * It handles intent classification, privacy processing, and
   * entity extraction in an optimized pipeline.
   *
   * @param {string} transcription - The transcribed voice input
   * @returns {Promise<OrchestrationResult>} Processing result
   *
   * @example
   * const result = await orchestrator.process(
   *   'Erstelle Rechnung für Acme Corp, 1500 Euro plus MwSt'
   * );
   */
  async process(transcription: string): Promise<OrchestrationResult> {
    const startTime = Date.now();

    // Placeholder implementation - will be completed in Subagent #6
    const intentResult: IntentResult = {
      intent: 'INVOICE',
      confidence: 0.5,
      method: 'RULES',
      latencyMs: 10,
    };

    return {
      transcription,
      intent: intentResult,
      requiresPreview: true,
      totalLatencyMs: Date.now() - startTime,
    };
  }

  /**
   * Classifies the intent of a transcription.
   *
   * Uses rule-based heuristics first, falling back to Gemini
   * for ambiguous cases if configured.
   *
   * @param _transcription - Text to classify (prefixed with _ as placeholder)
   * @returns Classification result
   */
  async classifyIntent(_transcription: string): Promise<IntentResult> {
    // Placeholder - will be implemented in Subagent #6.5
    // _transcription will be analyzed for intent patterns
    return {
      intent: 'UNKNOWN',
      confidence: 0,
      method: 'RULES',
      latencyMs: 0,
    };
  }

  /**
   * Returns the current configuration.
   *
   * @returns {OrchestratorConfig} Current configuration
   */
  getConfig(): OrchestratorConfig {
    return { ...this.config };
  }
}

/**
 * AI Orchestrator version for compatibility checking.
 */
export const AI_ORCHESTRATOR_VERSION = '0.1.0';
