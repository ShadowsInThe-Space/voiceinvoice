/**
 * Voice-to-Invoice Pipeline.
 *
 * Orchestrates the complete flow from voice recording to invoice creation:
 * 1. Audio recording (AudioRecorder)
 * 2. Transcription using Chirp 3 (GeminiClient.transcribe)
 * 3. Invoice data extraction (GeminiClient.parseInvoice)
 * 4. Database persistence (DatabaseService.createInvoice)
 *
 * @module lib/pipeline/voice-invoice-pipeline
 */

import type {
  GeminiClient,
  TranscriptionResult,
  InvoiceParseResult,
  ParsedInvoice,
} from '../ai/gemini-client';
import type {
  DatabaseService,
  CreateInvoiceInput,
  CreateCustomerInput,
  InvoiceWithRelations,
} from '../database/database-service';
import type { PrivacyEngine, ConsentType } from '../privacy/privacy-engine';
import {
  AgentOrchestrator,
  type Intent,
  type IntentResult,
  type WorkflowIntent,
} from '@voiceinvoice/ai-orchestrator';
import { triggerWorkflow, type WorkflowResult, type WorkflowParams } from '../workflow';

/**
 * Result returned from pipeline processing.
 */
export interface PipelineResult {
  /** Whether the pipeline completed successfully */
  success: boolean;

  /** Detected intent from the transcription */
  intent?: Intent;

  /** Intent classification details */
  intentResult?: IntentResult;

  /** The created invoice (if intent is INVOICE and successful) */
  invoice?: InvoiceWithRelations;

  /** Workflow execution result (if intent is WORKFLOW_*) */
  workflowResult?: WorkflowResult;

  /** The transcription text */
  transcription?: string;

  /** Confidence score from AI processing (0.0-1.0) */
  confidence?: number;

  /** Error message (if failed) */
  error?: string;

  /** Human-readable message for voice output */
  message?: string;
}

/**
 * Configuration for VoiceInvoicePipeline.
 */
export interface PipelineConfig {
  /** Gemini client for AI operations */
  geminiClient: GeminiClient;

  /** Database service for persistence */
  databaseService: DatabaseService;

  /** Privacy engine for consent and encryption */
  privacyEngine?: PrivacyEngine;

  /** Agent orchestrator for intent classification (optional, created if not provided) */
  orchestrator?: AgentOrchestrator;

  /** Default language for transcription (default: de-DE) */
  language?: string;

  /** Default tax rate (default: 19) */
  defaultTaxRate?: number;

  /** Whether to enable workflow triggers (default: true) */
  enableWorkflows?: boolean;
}

/**
 * Internal pipeline state.
 */
interface PipelineState {
  isProcessing: boolean;
  lastResult: PipelineResult | null;
}

/**
 * VoiceInvoicePipeline orchestrates the voice-to-invoice workflow.
 *
 * @example
 * const pipeline = new VoiceInvoicePipeline({
 *   geminiClient,
 *   databaseService,
 *   privacyEngine,
 * });
 *
 * // Process from audio
 * const result = await pipeline.processRecording(audioBlob);
 *
 * // Or process from text
 * const result = await pipeline.processTranscription("Rechnung fuer...");
 */
export class VoiceInvoicePipeline {
  private geminiClient: GeminiClient;
  private databaseService: DatabaseService;
  private privacyEngine?: PrivacyEngine;
  private orchestrator: AgentOrchestrator;
  private language: string;
  private defaultTaxRate: number;
  private enableWorkflows: boolean;
  private state: PipelineState;

  /**
   * Creates a new VoiceInvoicePipeline instance.
   *
   * @param config - Pipeline configuration
   */
  constructor(config: PipelineConfig) {
    this.geminiClient = config.geminiClient;
    this.databaseService = config.databaseService;
    if (config.privacyEngine) {
      this.privacyEngine = config.privacyEngine;
    }
    this.orchestrator = config.orchestrator ?? new AgentOrchestrator();
    this.language = config.language ?? 'de-DE';
    this.defaultTaxRate = config.defaultTaxRate ?? 19;
    this.enableWorkflows = config.enableWorkflows ?? true;
    this.state = {
      isProcessing: false,
      lastResult: null,
    };
  }

  /**
   * Processes an audio recording through the complete pipeline.
   *
   * Flow:
   * 1. Check privacy consent
   * 2. Convert blob to base64
   * 3. Transcribe with Chirp 3
   * 4. Parse invoice data with Gemini
   * 5. Create/find customer
   * 6. Create invoice in database
   *
   * @param audioBlob - The recorded audio as a Blob
   * @returns Pipeline result with invoice or error
   */
  async processRecording(audioBlob: Blob): Promise<PipelineResult> {
    this.state.isProcessing = true;

    try {
      // Step 1: Check privacy consent
      if (this.privacyEngine) {
        const consentStatus = await this.privacyEngine.getConsentStatus(
          'VOICE_RECORDING' as ConsentType
        );
        if (!consentStatus.granted) {
          const result: PipelineResult = {
            success: false,
            error: 'Voice recording consent not granted',
          };
          this.state.lastResult = result;
          this.state.isProcessing = false;
          return result;
        }
      }

      // Step 2: Convert blob to base64
      const audioBase64 = await this.convertBlobToBase64(audioBlob);

      // Step 3: Transcribe audio
      const transcriptionResult = await this.transcribeAudio(audioBase64, audioBlob.type);

      if (!transcriptionResult.success) {
        const result: PipelineResult = {
          success: false,
          error: transcriptionResult.error ?? 'Transcription failed',
        };
        this.state.lastResult = result;
        this.state.isProcessing = false;
        return result;
      }

      const transcription = transcriptionResult.text ?? '';

      if (!transcription.trim()) {
        const result: PipelineResult = {
          success: false,
          error: 'Empty transcription received',
        };
        this.state.lastResult = result;
        this.state.isProcessing = false;
        return result;
      }

      // Step 4-6: Process the transcription
      const pipelineResult = await this.processTranscriptionInternal(transcription);
      this.state.lastResult = pipelineResult;
      this.state.isProcessing = false;
      return pipelineResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const result: PipelineResult = {
        success: false,
        error: errorMessage,
      };
      this.state.lastResult = result;
      this.state.isProcessing = false;
      return result;
    }
  }

  /**
   * Processes a transcription text through the pipeline.
   *
   * Skips the audio recording and transcription steps.
   * Useful for processing manually entered text or re-processing.
   *
   * @param text - The transcription text
   * @returns Pipeline result with invoice or error
   */
  async processTranscription(text: string): Promise<PipelineResult> {
    this.state.isProcessing = true;

    try {
      if (!text.trim()) {
        const result: PipelineResult = {
          success: false,
          error: 'Empty transcription provided',
        };
        this.state.lastResult = result;
        this.state.isProcessing = false;
        return result;
      }

      const pipelineResult = await this.processTranscriptionInternal(text);
      this.state.lastResult = pipelineResult;
      this.state.isProcessing = false;
      return pipelineResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const result: PipelineResult = {
        success: false,
        error: errorMessage,
        transcription: text,
      };
      this.state.lastResult = result;
      this.state.isProcessing = false;
      return result;
    }
  }

  /**
   * Internal method to process transcription text.
   *
   * Routes to workflow, invoice, or analytics processing based on intent.
   *
   * @param transcription - The transcription text
   * @returns Pipeline result
   */
  private async processTranscriptionInternal(transcription: string): Promise<PipelineResult> {
    // Step 1: Classify intent
    const intentResult = await this.orchestrator.classifyIntent(transcription);

    // Step 2: Route based on intent
    if (AgentOrchestrator.isWorkflowIntent(intentResult.intent) && this.enableWorkflows) {
      // Handle workflow intent
      return this.processWorkflowIntent(
        intentResult.intent as WorkflowIntent,
        intentResult,
        transcription
      );
    }

    if (intentResult.intent === 'ANALYTICS') {
      // Analytics intent - return message for now (could be extended)
      return {
        success: true,
        intent: intentResult.intent,
        intentResult,
        transcription,
        confidence: intentResult.confidence,
        message: 'Analytics-Anfrage erkannt. Diese Funktion wird bald verfügbar sein.',
      };
    }

    if (intentResult.intent === 'UNKNOWN' && intentResult.confidence < 0.5) {
      // Low confidence - ask user for clarification
      return {
        success: false,
        intent: intentResult.intent,
        intentResult,
        transcription,
        confidence: intentResult.confidence,
        error: 'Ich konnte Ihre Anfrage nicht verstehen. Bitte versuchen Sie es erneut.',
      };
    }

    // Default: Invoice processing
    return this.processInvoiceIntent(intentResult, transcription);
  }

  /**
   * Processes a workflow intent by triggering the n8n workflow.
   *
   * @param intent - The workflow intent
   * @param intentResult - Full intent classification result
   * @param transcription - Original transcription
   * @returns Pipeline result with workflow execution details
   */
  private async processWorkflowIntent(
    intent: WorkflowIntent,
    intentResult: IntentResult,
    transcription: string
  ): Promise<PipelineResult> {
    // Extract parameters from transcription for the workflow
    const params: WorkflowParams = {
      transcription,
      // Could add entity extraction here for more parameters
    };

    // Trigger the workflow
    const workflowResult = await triggerWorkflow(intent, params);

    const result: PipelineResult = {
      success: workflowResult.success,
      intent,
      intentResult,
      workflowResult,
      transcription,
      confidence: intentResult.confidence,
      message: workflowResult.message,
    };

    if (!workflowResult.success && workflowResult.error) {
      result.error = workflowResult.error;
    }

    return result;
  }

  /**
   * Processes an invoice intent by parsing and creating the invoice.
   *
   * @param intentResult - Intent classification result
   * @param transcription - Original transcription
   * @returns Pipeline result with created invoice
   */
  private async processInvoiceIntent(
    intentResult: IntentResult,
    transcription: string
  ): Promise<PipelineResult> {
    // Parse invoice data
    const parseResult = await this.parseInvoiceData(transcription);

    if (!parseResult.success || !parseResult.invoice) {
      return {
        success: false,
        intent: intentResult.intent,
        intentResult,
        error: parseResult.error ?? 'Could not extract invoice data',
        transcription,
      };
    }

    // Create invoice in database
    try {
      const invoice = await this.createInvoiceFromParsed(parseResult.invoice, transcription);

      return {
        success: true,
        intent: intentResult.intent,
        intentResult,
        invoice,
        transcription,
        confidence: parseResult.confidence,
        message: `Rechnung für ${parseResult.invoice.customerName} wurde erstellt.`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Database error';
      return {
        success: false,
        intent: intentResult.intent,
        intentResult,
        error: `Failed to save invoice: ${errorMessage}`,
        transcription,
        confidence: parseResult.confidence,
      };
    }
  }

  /**
   * Converts a Blob to base64 string.
   *
   * @param blob - The blob to convert
   * @returns Base64 encoded string
   */
  async convertBlobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Remove data URL prefix if present
        const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
        resolve(base64Data);
      };
      reader.onerror = () => reject(new Error('Failed to read blob'));
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Transcribes audio using the Gemini client.
   *
   * @param audioBase64 - Base64 encoded audio
   * @param mimeType - Audio MIME type
   * @returns Transcription result
   */
  private async transcribeAudio(
    audioBase64: string,
    mimeType: string
  ): Promise<TranscriptionResult> {
    return this.geminiClient.transcribe(audioBase64, mimeType, {
      language: this.language,
    });
  }

  /**
   * Parses invoice data from transcription text.
   *
   * @param text - The transcription text
   * @returns Invoice parse result
   */
  private async parseInvoiceData(text: string): Promise<InvoiceParseResult> {
    return this.geminiClient.parseInvoice(text);
  }

  /**
   * Creates an invoice in the database from parsed data.
   *
   * @param parsedInvoice - The parsed invoice data
   * @param transcription - Original transcription
   * @returns The created invoice
   */
  private async createInvoiceFromParsed(
    parsedInvoice: ParsedInvoice,
    transcription: string
  ): Promise<InvoiceWithRelations> {
    // Find or create customer
    const customerId = await this.findOrCreateCustomer(parsedInvoice);

    // Map parsed invoice to database input
    const items = parsedInvoice.items.map((item) => {
      const dbItem: {
        description: string;
        quantity: number;
        unitPrice: number;
        category?: string;
      } = {
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      };
      if (item.category) {
        dbItem.category = item.category;
      }
      return dbItem;
    });

    const invoiceInput: CreateInvoiceInput = {
      customerId,
      items,
      taxRate: this.defaultTaxRate,
      transcription,
    };

    if (parsedInvoice.notes) {
      invoiceInput.notes = parsedInvoice.notes;
    }
    if (parsedInvoice.paymentTerms) {
      invoiceInput.paymentTerms = parsedInvoice.paymentTerms;
    }

    return this.databaseService.createInvoice(invoiceInput);
  }

  /**
   * Finds an existing customer or creates a new one.
   *
   * @param parsedInvoice - The parsed invoice data
   * @returns Customer ID
   */
  private async findOrCreateCustomer(parsedInvoice: ParsedInvoice): Promise<string> {
    // Search for existing customer by name
    const existingCustomers = await this.databaseService.searchCustomers(
      parsedInvoice.customerName
    );

    if (existingCustomers.length > 0) {
      // Use the first matching customer
      return existingCustomers[0].id;
    }

    // Create new customer with all extracted fields
    const customerInput: CreateCustomerInput = {
      name: parsedInvoice.customerName,
    };

    // Add all optional customer fields if present
    if (parsedInvoice.customerEmail) {
      customerInput.email = parsedInvoice.customerEmail;
    }
    if (parsedInvoice.customerPhone) {
      customerInput.phone = parsedInvoice.customerPhone;
    }
    if (parsedInvoice.customerAddress) {
      customerInput.address = parsedInvoice.customerAddress;
    }
    if (parsedInvoice.customerCity) {
      customerInput.city = parsedInvoice.customerCity;
    }
    if (parsedInvoice.customerZipCode) {
      customerInput.zipCode = parsedInvoice.customerZipCode;
    }
    if (parsedInvoice.customerCountry) {
      customerInput.country = parsedInvoice.customerCountry;
    }
    if (parsedInvoice.customerTaxId) {
      customerInput.taxId = parsedInvoice.customerTaxId;
    }

    const newCustomer = await this.databaseService.createCustomer(customerInput);
    return newCustomer.id;
  }

  /**
   * Returns whether the pipeline is currently processing.
   *
   * @returns True if processing is in progress
   */
  isProcessing(): boolean {
    return this.state.isProcessing;
  }

  /**
   * Returns the last processing result.
   *
   * @returns The last result or null if no processing has occurred
   */
  getLastResult(): PipelineResult | null {
    return this.state.lastResult;
  }

  /**
   * Resets the pipeline state.
   */
  reset(): void {
    this.state = {
      isProcessing: false,
      lastResult: null,
    };
  }
}
