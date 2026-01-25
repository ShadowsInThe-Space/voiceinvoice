/**
 * Pipeline Orchestrator for VoiceInvoice Enterprise.
 *
 * Chains the complete voice-to-invoice processing pipeline:
 * 1. Transcription (audio -> text)
 * 2. Classification (text -> intent)
 * 3. Routing (intent -> action)
 *
 * Provides callbacks for each stage and graceful error handling.
 */

import { AgentOrchestrator, IntentResult } from './index';
import {
  makeRoutingDecision,
  RoutingDecision,
  RoutingThresholds,
  DEFAULT_ROUTING_THRESHOLDS,
} from './routing';

/**
 * Pipeline processing stages.
 */
export enum PipelineStage {
  TRANSCRIPTION = 'transcription',
  CLASSIFICATION = 'classification',
  ROUTING = 'routing',
}

/**
 * Result from the transcription stage.
 */
export interface TranscriptionResult {
  /** Transcribed text */
  text: string;

  /** Confidence score from speech recognition */
  confidence: number;

  /** Processing time in milliseconds */
  latencyMs: number;
}

/**
 * Error information from a failed pipeline stage.
 */
export interface PipelineError {
  /** Stage where the error occurred */
  stage: PipelineStage | string;

  /** Error message */
  message: string;

  /** Original error (if available) */
  originalError?: Error | undefined;
}

/**
 * Latency tracking for each pipeline stage.
 */
export interface StageLatencies {
  /** Transcription stage latency (ms) */
  transcription?: number;

  /** Classification stage latency (ms) */
  classification?: number;

  /** Routing stage latency (ms) */
  routing?: number;
}

/**
 * Complete result from pipeline execution.
 */
export interface PipelineResult {
  /** Whether the pipeline completed successfully */
  success: boolean;

  /** Transcription result (if audio was processed) */
  transcription?: TranscriptionResult | undefined;

  /** Classification result */
  classification?: IntentResult | undefined;

  /** Routing decision */
  routing?: RoutingDecision | undefined;

  /** Error information (if pipeline failed) */
  error?: PipelineError | undefined;

  /** Individual stage latencies */
  stageLatencies: StageLatencies;

  /** Total pipeline latency */
  totalLatencyMs: number;
}

/**
 * Callbacks for pipeline stage events.
 */
export interface PipelineCallbacks {
  /** Called when transcription completes */
  onTranscription?: (result: TranscriptionResult) => void;

  /** Called when classification completes */
  onClassification?: (result: IntentResult) => void;

  /** Called when routing decision is made */
  onRouting?: (decision: RoutingDecision) => void;

  /** Called when pipeline completes (success or failure) */
  onComplete?: (result: PipelineResult) => void;

  /** Called when an error occurs */
  onError?: (error: PipelineError) => void;

  /** Called when a stage starts */
  onStageStart?: (stage: PipelineStage) => void;

  /** Called when a stage ends */
  onStageEnd?: (stage: PipelineStage) => void;
}

/**
 * Handler function for transcription.
 * Takes audio data and returns transcription result.
 */
export type TranscriptionHandler = (audio: ArrayBuffer) => Promise<TranscriptionResult>;

/**
 * Configuration for the pipeline orchestrator.
 */
export interface PipelineConfig {
  /** Routing thresholds */
  routingThresholds: RoutingThresholds;

  /** Custom transcription handler (for dependency injection) */
  transcriptionHandler?: TranscriptionHandler | undefined;

  /** Pipeline callbacks */
  callbacks: PipelineCallbacks;
}

/**
 * Pipeline Orchestrator for voice-to-invoice processing.
 *
 * This class manages the complete pipeline from audio input
 * to routing decision, providing callbacks for each stage
 * and graceful error handling.
 *
 * @example
 * const pipeline = new PipelineOrchestrator({
 *   routingThresholds: { autoSave: 0.85, preview: 0.6 },
 *   callbacks: {
 *     onClassification: (result) => console.log('Intent:', result.intent),
 *     onRouting: (decision) => console.log('Route:', decision.route),
 *   }
 * });
 *
 * // Process from text
 * const result = await pipeline.processText('Rechnung für Müller GmbH');
 *
 * // Process from audio
 * const audioResult = await pipeline.processAudio(audioBuffer);
 */
export class PipelineOrchestrator {
  private readonly config: PipelineConfig;
  private readonly orchestrator: AgentOrchestrator;

  /**
   * Creates a new PipelineOrchestrator instance.
   *
   * @param config - Partial configuration (merged with defaults)
   */
  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = {
      routingThresholds: config.routingThresholds ?? { ...DEFAULT_ROUTING_THRESHOLDS },
      transcriptionHandler: config.transcriptionHandler,
      callbacks: config.callbacks ?? {},
    };

    this.orchestrator = new AgentOrchestrator({
      directSaveThreshold: this.config.routingThresholds.autoSave,
    });
  }

  /**
   * Returns the current pipeline configuration.
   *
   * @returns Current pipeline configuration
   */
  getConfig(): PipelineConfig {
    return {
      ...this.config,
      routingThresholds: { ...this.config.routingThresholds },
      callbacks: { ...this.config.callbacks },
    };
  }

  /**
   * Processes audio through the complete pipeline.
   *
   * Pipeline stages:
   * 1. Transcription (audio -> text)
   * 2. Classification (text -> intent)
   * 3. Routing (intent -> action)
   *
   * @param audio - Audio data as ArrayBuffer
   * @returns Pipeline result with all stage outputs
   */
  async processAudio(audio: ArrayBuffer): Promise<PipelineResult> {
    const startTime = Date.now();
    const stageLatencies: StageLatencies = {};

    let transcriptionResult: TranscriptionResult | undefined;

    try {
      // Stage 1: Transcription
      if (!this.config.transcriptionHandler) {
        throw new Error('No transcription handler configured');
      }

      this.config.callbacks.onStageStart?.(PipelineStage.TRANSCRIPTION);

      try {
        transcriptionResult = await this.config.transcriptionHandler(audio);
        stageLatencies.transcription = transcriptionResult.latencyMs;
        this.config.callbacks.onTranscription?.(transcriptionResult);
      } catch (error) {
        const pipelineError: PipelineError = {
          stage: PipelineStage.TRANSCRIPTION,
          message: error instanceof Error ? error.message : 'Transcription failed',
          originalError: error instanceof Error ? error : undefined,
        };
        this.config.callbacks.onError?.(pipelineError);

        const result: PipelineResult = {
          success: false,
          error: pipelineError,
          stageLatencies,
          totalLatencyMs: Date.now() - startTime,
        };
        this.config.callbacks.onComplete?.(result);
        return result;
      }

      this.config.callbacks.onStageEnd?.(PipelineStage.TRANSCRIPTION);

      // Continue with text processing
      return this.processTextInternal(
        transcriptionResult.text,
        startTime,
        stageLatencies,
        transcriptionResult
      );
    } catch (error) {
      const pipelineError: PipelineError = {
        stage: 'unknown',
        message: error instanceof Error ? error.message : 'Pipeline failed',
        originalError: error instanceof Error ? error : undefined,
      };
      this.config.callbacks.onError?.(pipelineError);

      const result: PipelineResult = {
        success: false,
        transcription: transcriptionResult,
        error: pipelineError,
        stageLatencies,
        totalLatencyMs: Date.now() - startTime,
      };
      this.config.callbacks.onComplete?.(result);
      return result;
    }
  }

  /**
   * Processes text through classification and routing (skips transcription).
   *
   * Pipeline stages:
   * 1. Classification (text -> intent)
   * 2. Routing (intent -> action)
   *
   * @param text - Text to process
   * @returns Pipeline result with classification and routing outputs
   */
  async processText(text: string): Promise<PipelineResult> {
    const startTime = Date.now();
    const stageLatencies: StageLatencies = {};

    return this.processTextInternal(text, startTime, stageLatencies);
  }

  /**
   * Internal method for text processing (shared between audio and text paths).
   *
   * @param text - Text to process
   * @param startTime - Start time for latency tracking
   * @param stageLatencies - Stage latencies tracker
   * @param transcriptionResult - Optional transcription result from audio processing
   * @returns Pipeline result
   */
  private async processTextInternal(
    text: string,
    startTime: number,
    stageLatencies: StageLatencies,
    transcriptionResult?: TranscriptionResult
  ): Promise<PipelineResult> {
    let classificationResult: IntentResult | undefined;
    let routingDecision: RoutingDecision | undefined;

    try {
      // Stage 2: Classification
      this.config.callbacks.onStageStart?.(PipelineStage.CLASSIFICATION);

      try {
        classificationResult = await this.orchestrator.classifyIntent(text);
        stageLatencies.classification = classificationResult.latencyMs;
        this.config.callbacks.onClassification?.(classificationResult);
      } catch (error) {
        const pipelineError: PipelineError = {
          stage: PipelineStage.CLASSIFICATION,
          message: error instanceof Error ? error.message : 'Classification failed',
          originalError: error instanceof Error ? error : undefined,
        };
        this.config.callbacks.onError?.(pipelineError);

        const result: PipelineResult = {
          success: false,
          transcription: transcriptionResult,
          error: pipelineError,
          stageLatencies,
          totalLatencyMs: Date.now() - startTime,
        };
        this.config.callbacks.onComplete?.(result);
        return result;
      }

      this.config.callbacks.onStageEnd?.(PipelineStage.CLASSIFICATION);

      // Stage 3: Routing
      this.config.callbacks.onStageStart?.(PipelineStage.ROUTING);

      const routingStart = Date.now();
      try {
        routingDecision = makeRoutingDecision(classificationResult, this.config.routingThresholds);
        stageLatencies.routing = Date.now() - routingStart;
        this.config.callbacks.onRouting?.(routingDecision);
      } catch (error) {
        const pipelineError: PipelineError = {
          stage: PipelineStage.ROUTING,
          message: error instanceof Error ? error.message : 'Routing failed',
          originalError: error instanceof Error ? error : undefined,
        };
        this.config.callbacks.onError?.(pipelineError);

        const result: PipelineResult = {
          success: false,
          transcription: transcriptionResult,
          classification: classificationResult,
          error: pipelineError,
          stageLatencies,
          totalLatencyMs: Date.now() - startTime,
        };
        this.config.callbacks.onComplete?.(result);
        return result;
      }

      this.config.callbacks.onStageEnd?.(PipelineStage.ROUTING);

      // Success!
      const result: PipelineResult = {
        success: true,
        transcription: transcriptionResult,
        classification: classificationResult,
        routing: routingDecision,
        stageLatencies,
        totalLatencyMs: Date.now() - startTime,
      };

      this.config.callbacks.onComplete?.(result);
      return result;
    } catch (error) {
      const pipelineError: PipelineError = {
        stage: 'unknown',
        message: error instanceof Error ? error.message : 'Pipeline failed',
        ...(error instanceof Error && { originalError: error }),
      };
      this.config.callbacks.onError?.(pipelineError);

      const result: PipelineResult = {
        success: false,
        ...(transcriptionResult && { transcription: transcriptionResult }),
        ...(classificationResult && { classification: classificationResult }),
        ...(routingDecision && { routing: routingDecision }),
        error: pipelineError,
        stageLatencies,
        totalLatencyMs: Date.now() - startTime,
      };
      this.config.callbacks.onComplete?.(result);
      return result;
    }
  }
}
