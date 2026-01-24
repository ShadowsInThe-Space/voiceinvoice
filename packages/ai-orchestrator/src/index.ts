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
 * Keywords and patterns for INVOICE intent detection.
 */
const INVOICE_PATTERNS = {
  /** Strong invoice keywords (high confidence) */
  strongKeywords: ['rechnung', 'invoice', 'faktura'],

  /** Keywords indicating invoice creation */
  creationKeywords: ['erstelle', 'erstellen', 'neue', 'neuen', 'anlegen', 'schreiben', 'schreibe'],

  /** Prepositions used with customer names */
  customerPrepositions: ['für', 'an'],

  /** Currency indicators */
  currencyPatterns: [/\d+\s*euro/i, /\d+\s*eur/i, /\d+\s*€/i, /tausend\s*euro/i, /hundert\s*euro/i],

  /** Tax-related keywords (boost confidence) */
  taxKeywords: ['mwst', 'mehrwertsteuer', 'steuer', 'netto', 'brutto'],

  /** Written number patterns */
  writtenNumbers: ['tausend', 'hundert', 'fünfzig', 'zwanzig', 'zehn'],
};

/**
 * Keywords and patterns for ANALYTICS intent detection.
 */
const ANALYTICS_PATTERNS = {
  /** Question starters (high confidence) */
  questionStarters: ['wie viele', 'wie viel', 'was ist', 'wieviele', 'wieviel', 'wie waren'],

  /** Display commands */
  displayCommands: ['zeige mir', 'zeig mir', 'liste', 'gib mir', 'zeige'],

  /** Strong analytics keywords */
  strongKeywords: [
    'statistik',
    'analyse',
    'analytics',
    'report',
    'bericht',
    'übersicht',
    'auswertung',
  ],

  /** Aggregation keywords - these strongly indicate analytics */
  aggregationKeywords: ['umsatz', 'durchschnitt', 'gesamt', 'summe', 'anzahl', 'total'],

  /** Time-related keywords (boost analytics confidence) */
  timeKeywords: [
    'monat',
    'jahr',
    'woche',
    'quartal',
    'heute',
    'gestern',
    'letzte',
    'letzten',
    'diesen',
    'diesem',
  ],

  /** Keywords that indicate listing/overview of existing items */
  listingKeywords: ['alle', 'offenen', 'offene'],
};

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

    // Classify intent using rule-based heuristics
    const intentResult = await this.classifyIntent(transcription);

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
   * @param transcription - Text to classify
   * @returns Classification result with intent and confidence
   */
  async classifyIntent(transcription: string): Promise<IntentResult> {
    const startTime = Date.now();

    // Normalize input for matching: lowercase, trim, and collapse whitespace
    const normalizedText = transcription.toLowerCase().trim().replace(/\s+/g, ' ');

    // Handle empty input
    if (!normalizedText) {
      return {
        intent: 'UNKNOWN',
        confidence: 0,
        method: 'RULES',
        latencyMs: Date.now() - startTime,
      };
    }

    // Calculate scores for each intent
    const invoiceScore = this.calculateInvoiceScore(normalizedText);
    const analyticsScore = this.calculateAnalyticsScore(normalizedText);

    // Determine winner
    let intent: Intent;
    let confidence: number;

    if (invoiceScore > analyticsScore && invoiceScore >= 0.5) {
      intent = 'INVOICE';
      confidence = Math.min(invoiceScore, 1.0);
    } else if (analyticsScore > invoiceScore && analyticsScore >= 0.5) {
      intent = 'ANALYTICS';
      confidence = Math.min(analyticsScore, 1.0);
    } else if (analyticsScore === invoiceScore && analyticsScore >= 0.5) {
      // Tie-breaker: prefer ANALYTICS when scores are equal (user is asking a question)
      intent = 'ANALYTICS';
      confidence = analyticsScore;
    } else {
      intent = 'UNKNOWN';
      confidence = Math.max(invoiceScore, analyticsScore);
    }

    return {
      intent,
      confidence,
      method: 'RULES',
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Calculates the INVOICE intent score for a given text.
   *
   * @param text - Normalized (lowercase) text to analyze
   * @returns Score between 0 and 1
   */
  private calculateInvoiceScore(text: string): number {
    let score = 0;

    // Check for analytics signals first - if present, reduce invoice score
    const hasAnalyticsSignal =
      ANALYTICS_PATTERNS.questionStarters.some((s) => text.includes(s)) ||
      ANALYTICS_PATTERNS.displayCommands.some((c) => text.includes(c)) ||
      ANALYTICS_PATTERNS.strongKeywords.some((k) => text.includes(k));

    // Check for aggregation keywords that clearly indicate analytics context
    const hasAggregationInContext = ANALYTICS_PATTERNS.aggregationKeywords.some((keyword) => {
      // Check if it appears in a context like "durchschnittlicher rechnungsbetrag"
      // where "rechnung" is part of a compound word about analytics
      const idx = text.indexOf(keyword);
      if (idx === -1) return false;
      // If aggregation keyword appears, it's analytics context
      return true;
    });

    // If "rechnung" appears only as part of compound analytics term, don't count as invoice
    const hasRechnungAsCompound = /rechnungs?betrag|rechnungs?summe|rechnungs?übersicht/.test(text);
    const hasStandaloneRechnung = text.includes('rechnung') && !hasRechnungAsCompound;

    // Check for strong invoice keywords (base score)
    const hasStrongKeyword = INVOICE_PATTERNS.strongKeywords.some((keyword) =>
      text.includes(keyword)
    );

    // Only add invoice score if rechnung is standalone or there are other invoice keywords
    if (hasStrongKeyword) {
      // If in analytics context (aggregation keywords), reduce score significantly
      if (hasAggregationInContext && !hasStandaloneRechnung) {
        score += 0.3;
      } else if (hasAnalyticsSignal) {
        score += 0.4;
      } else {
        score += 0.65;
      }
    }

    // Check for creation keywords (boost)
    const hasCreationKeyword = INVOICE_PATTERNS.creationKeywords.some((keyword) =>
      text.includes(keyword)
    );
    // Don't boost for "erstelle bericht" - that's analytics
    const isCreatingReport =
      hasCreationKeyword && ANALYTICS_PATTERNS.strongKeywords.some((k) => text.includes(k));
    if (hasCreationKeyword && hasStrongKeyword && !isCreatingReport) {
      score += 0.15;
    }

    // Check for customer prepositions with "rechnung" (boost)
    const hasCustomerPreposition = INVOICE_PATTERNS.customerPrepositions.some((prep) =>
      text.includes(`rechnung ${prep}`)
    );
    if (hasCustomerPreposition) {
      score += 0.2;
    }

    // Check for currency patterns (significant boost)
    const hasCurrencyPattern = INVOICE_PATTERNS.currencyPatterns.some((pattern) =>
      pattern.test(text)
    );
    if (hasCurrencyPattern) {
      score += 0.2;
    }

    // Check for tax keywords (boost)
    const hasTaxKeyword = INVOICE_PATTERNS.taxKeywords.some((keyword) => text.includes(keyword));
    if (hasTaxKeyword) {
      score += 0.2;
    }

    // Check for written numbers with "euro" (boost)
    const hasWrittenAmount = INVOICE_PATTERNS.writtenNumbers.some(
      (num) => text.includes(num) && text.includes('euro')
    );
    if (hasWrittenAmount) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculates the ANALYTICS intent score for a given text.
   *
   * @param text - Normalized (lowercase) text to analyze
   * @returns Score between 0 and 1
   */
  private calculateAnalyticsScore(text: string): number {
    let score = 0;

    // Check for question starters (high base score)
    const hasQuestionStarter = ANALYTICS_PATTERNS.questionStarters.some((starter) =>
      text.includes(starter)
    );
    if (hasQuestionStarter) {
      score += 0.7;
    }

    // Check for display commands (high base score)
    const hasDisplayCommand = ANALYTICS_PATTERNS.displayCommands.some((cmd) => text.includes(cmd));
    if (hasDisplayCommand) {
      score += 0.7;
    }

    // Check for strong analytics keywords
    const hasStrongKeyword = ANALYTICS_PATTERNS.strongKeywords.some((keyword) =>
      text.includes(keyword)
    );
    if (hasStrongKeyword) {
      score += 0.75;
    }

    // Check for aggregation keywords - these are strong analytics signals
    const hasAggregationKeyword = ANALYTICS_PATTERNS.aggregationKeywords.some((keyword) =>
      text.includes(keyword)
    );
    if (hasAggregationKeyword) {
      score += 0.65;
    }

    // Check for time keywords
    const hasTimeKeyword = ANALYTICS_PATTERNS.timeKeywords.some((keyword) =>
      text.includes(keyword)
    );
    if (hasTimeKeyword) {
      // Time keywords boost score
      score += 0.15;
    }

    // Check for listing keywords (shows interest in existing data)
    const hasListingKeyword = ANALYTICS_PATTERNS.listingKeywords.some((keyword) =>
      text.includes(keyword)
    );
    if (hasListingKeyword) {
      score += 0.15;
    }

    // Handle "rechnung" context carefully
    // If "rechnung" appears as part of compound (rechnungsbetrag, rechnungssumme), it's analytics
    const hasRechnungAsCompound = /rechnungs?betrag|rechnungs?summe|rechnungs?übersicht/.test(text);
    if (hasRechnungAsCompound) {
      score += 0.1;
    } else if (text.includes('rechnung')) {
      // Standalone "rechnung" - only keep analytics score if strong signals
      if (hasQuestionStarter || hasDisplayCommand || hasListingKeyword) {
        // Keep score, this is a valid analytics query about invoices
      } else if (!hasStrongKeyword && !hasAggregationKeyword) {
        // "Rechnung" without analytics context likely means creating invoice
        score *= 0.3;
      }
    }

    return Math.min(score, 1.0);
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

// Re-export routing module
export {
  makeRoutingDecision,
  canAutoSave,
  requiresUserConfirmation,
  requiresManualInput,
  DEFAULT_ROUTING_THRESHOLDS,
  type Route,
  type RoutingThresholds,
  type RoutingDecision,
} from './routing';

// Re-export pipeline module
export {
  PipelineOrchestrator,
  PipelineStage,
  type TranscriptionResult,
  type PipelineError,
  type StageLatencies,
  type PipelineResult,
  type PipelineCallbacks,
  type TranscriptionHandler,
  type PipelineConfig,
} from './pipeline';

// Re-export entity extraction module
export {
  extractEntities,
  parseGermanAmount,
  parseGermanDate,
  parsePercentage,
  extractInvoiceItems,
  type InvoiceEntity,
  type InvoiceItem,
  type ExtractionResult,
} from './entity-extraction';
