import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PipelineOrchestrator, PipelineStage } from '../src/pipeline';

// Mock the cleaner module
vi.mock('../src/cleaner', () => ({
  cleanTranscript: vi.fn().mockResolvedValue({
    cleanedTranscript: 'Rechnung für Müller GmbH über 500 Euro',
    removedElements: ['äh (2x)', 'ähm (1x)'],
    latencyMs: 200,
  }),
}));

describe('PipelineOrchestrator', () => {
  describe('Construction', () => {
    it('should create pipeline with default configuration', () => {
      const pipeline = new PipelineOrchestrator();
      const config = pipeline.getConfig();

      expect(config.routingThresholds.autoSave).toBe(0.85);
      expect(config.routingThresholds.preview).toBe(0.6);
    });

    it('should accept custom routing thresholds', () => {
      const pipeline = new PipelineOrchestrator({
        routingThresholds: {
          autoSave: 0.9,
          preview: 0.7,
        },
      });
      const config = pipeline.getConfig();

      expect(config.routingThresholds.autoSave).toBe(0.9);
      expect(config.routingThresholds.preview).toBe(0.7);
    });

    it('should accept custom transcription handler', () => {
      const customTranscriber = vi.fn().mockResolvedValue({
        text: 'test',
        confidence: 0.95,
        latencyMs: 100,
      });

      const pipeline = new PipelineOrchestrator({
        transcriptionHandler: customTranscriber,
      });

      expect(pipeline.getConfig().transcriptionHandler).toBe(customTranscriber);
    });
  });

  describe('Pipeline execution', () => {
    it('should execute full pipeline with audio input', async () => {
      const mockTranscriber = vi.fn().mockResolvedValue({
        text: 'Rechnung für Müller GmbH über 500 Euro',
        confidence: 0.95,
        latencyMs: 100,
      });

      const pipeline = new PipelineOrchestrator({
        transcriptionHandler: mockTranscriber,
      });

      const result = await pipeline.processAudio(new ArrayBuffer(100));

      expect(result.transcription).toBeDefined();
      expect(result.transcription?.text).toBe('Rechnung für Müller GmbH über 500 Euro');
      expect(result.classification).toBeDefined();
      expect(result.classification?.intent).toBe('INVOICE');
      expect(result.routing).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should execute pipeline from text (skip transcription)', async () => {
      const pipeline = new PipelineOrchestrator();

      const result = await pipeline.processText('Rechnung für Kunde');

      expect(result.transcription).toBeUndefined();
      expect(result.classification).toBeDefined();
      expect(result.classification?.intent).toBe('INVOICE');
      expect(result.routing).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should track total latency', async () => {
      const pipeline = new PipelineOrchestrator();

      const result = await pipeline.processText('Rechnung für Kunde');

      expect(result.totalLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should track individual stage latencies', async () => {
      const mockTranscriber = vi.fn().mockResolvedValue({
        text: 'Rechnung für Kunde',
        confidence: 0.9,
        latencyMs: 150,
      });

      const pipeline = new PipelineOrchestrator({
        transcriptionHandler: mockTranscriber,
      });

      const result = await pipeline.processAudio(new ArrayBuffer(100));

      expect(result.stageLatencies.transcription).toBe(150);
      expect(result.stageLatencies.classification).toBeGreaterThanOrEqual(0);
      expect(result.stageLatencies.routing).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Stage callbacks', () => {
    it('should call onTranscription callback', async () => {
      const onTranscription = vi.fn();
      const mockTranscriber = vi.fn().mockResolvedValue({
        text: 'Test text',
        confidence: 0.9,
        latencyMs: 100,
      });

      const pipeline = new PipelineOrchestrator({
        transcriptionHandler: mockTranscriber,
        callbacks: { onTranscription },
      });

      await pipeline.processAudio(new ArrayBuffer(100));

      expect(onTranscription).toHaveBeenCalledTimes(1);
      expect(onTranscription).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Test text',
          confidence: 0.9,
        })
      );
    });

    it('should call onClassification callback', async () => {
      const onClassification = vi.fn();

      const pipeline = new PipelineOrchestrator({
        callbacks: { onClassification },
      });

      await pipeline.processText('Rechnung für Kunde');

      expect(onClassification).toHaveBeenCalledTimes(1);
      expect(onClassification).toHaveBeenCalledWith(
        expect.objectContaining({
          intent: 'INVOICE',
        })
      );
    });

    it('should call onRouting callback', async () => {
      const onRouting = vi.fn();

      const pipeline = new PipelineOrchestrator({
        callbacks: { onRouting },
      });

      await pipeline.processText('Rechnung für Kunde über 1000 Euro plus MwSt');

      expect(onRouting).toHaveBeenCalledTimes(1);
      expect(onRouting).toHaveBeenCalledWith(
        expect.objectContaining({
          route: expect.stringMatching(/auto_save|preview|manual/),
        })
      );
    });

    it('should call onComplete callback', async () => {
      const onComplete = vi.fn();

      const pipeline = new PipelineOrchestrator({
        callbacks: { onComplete },
      });

      await pipeline.processText('Rechnung für Kunde');

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('should call callbacks in order', async () => {
      const callOrder: string[] = [];
      const mockTranscriber = vi.fn().mockResolvedValue({
        text: 'Rechnung',
        confidence: 0.9,
        latencyMs: 100,
      });

      const pipeline = new PipelineOrchestrator({
        transcriptionHandler: mockTranscriber,
        callbacks: {
          onTranscription: (): void => {
            callOrder.push('transcription');
          },
          onClassification: (): void => {
            callOrder.push('classification');
          },
          onRouting: (): void => {
            callOrder.push('routing');
          },
          onComplete: (): void => {
            callOrder.push('complete');
          },
        },
      });

      await pipeline.processAudio(new ArrayBuffer(100));

      expect(callOrder).toEqual(['transcription', 'classification', 'routing', 'complete']);
    });

    it('should not call onTranscription when processing text', async () => {
      const onTranscription = vi.fn();
      const onClassification = vi.fn();

      const pipeline = new PipelineOrchestrator({
        callbacks: { onTranscription, onClassification },
      });

      await pipeline.processText('Rechnung für Kunde');

      expect(onTranscription).not.toHaveBeenCalled();
      expect(onClassification).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle transcription errors gracefully', async () => {
      const mockTranscriber = vi.fn().mockRejectedValue(new Error('Transcription failed'));
      const onError = vi.fn();

      const pipeline = new PipelineOrchestrator({
        transcriptionHandler: mockTranscriber,
        callbacks: { onError },
      });

      const result = await pipeline.processAudio(new ArrayBuffer(100));

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.stage).toBe('transcription');
      expect(result.error?.message).toContain('Transcription failed');
      expect(onError).toHaveBeenCalled();
    });

    it('should handle classification errors gracefully', async () => {
      const onError = vi.fn();

      const pipeline = new PipelineOrchestrator({
        callbacks: { onError },
      });

      // Force an error by passing invalid input
      // @ts-expect-error - intentionally passing invalid input
      const result = await pipeline.processText(null);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should call onError callback with error details', async () => {
      const mockTranscriber = vi.fn().mockRejectedValue(new Error('Network error'));
      const onError = vi.fn();

      const pipeline = new PipelineOrchestrator({
        transcriptionHandler: mockTranscriber,
        callbacks: { onError },
      });

      await pipeline.processAudio(new ArrayBuffer(100));

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'transcription',
          message: expect.stringContaining('Network error'),
        })
      );
    });

    it('should include partial results on error', async () => {
      const mockTranscriber = vi.fn().mockResolvedValue({
        text: 'Test',
        confidence: 0.9,
        latencyMs: 100,
      });

      // Create a pipeline that will fail during classification
      const pipeline = new PipelineOrchestrator({
        transcriptionHandler: mockTranscriber,
      });

      // Process valid audio
      const result = await pipeline.processAudio(new ArrayBuffer(100));

      // Should have transcription result even if later stages might fail
      expect(result.transcription).toBeDefined();
    });
  });

  describe('Pipeline stages', () => {
    it('should have correct stage enum values', () => {
      expect(PipelineStage.TRANSCRIPTION).toBe('transcription');
      expect(PipelineStage.CLASSIFICATION).toBe('classification');
      expect(PipelineStage.ROUTING).toBe('routing');
    });

    it('should track current stage during execution', async () => {
      const stages: string[] = [];

      const pipeline = new PipelineOrchestrator({
        callbacks: {
          onStageStart: (stage): void => {
            stages.push(`start:${stage}`);
          },
          onStageEnd: (stage): void => {
            stages.push(`end:${stage}`);
          },
        },
      });

      await pipeline.processText('Rechnung');

      expect(stages).toContain('start:classification');
      expect(stages).toContain('end:classification');
      expect(stages).toContain('start:routing');
      expect(stages).toContain('end:routing');
    });
  });

  describe('Routing integration', () => {
    it('should route high confidence INVOICE to auto_save', async () => {
      const pipeline = new PipelineOrchestrator();

      // This phrase has very high confidence for INVOICE
      const result = await pipeline.processText(
        'Erstelle Rechnung an Müller GmbH über 1500 Euro plus MwSt'
      );

      expect(result.routing?.route).toBe('auto_save');
    });

    it('should route medium confidence to preview', async () => {
      const pipeline = new PipelineOrchestrator();

      // Simple phrase with lower confidence
      const result = await pipeline.processText('Rechnung');

      expect(result.routing?.route).toBe('preview');
    });

    it('should route unknown intent to manual', async () => {
      const pipeline = new PipelineOrchestrator();

      const result = await pipeline.processText('Hallo wie geht es');

      expect(result.routing?.route).toBe('manual');
    });

    it('should respect custom routing thresholds', async () => {
      const pipeline = new PipelineOrchestrator({
        routingThresholds: {
          autoSave: 0.9, // High threshold
          preview: 0.8,
        },
      });

      // Simple "Rechnung" has confidence around 0.65 - below both thresholds
      const result = await pipeline.processText('Rechnung');

      // With these strict thresholds, ~0.65 confidence goes to manual
      expect(result.routing?.route).toBe('manual');
    });
  });

  describe('Pipeline result structure', () => {
    it('should have complete result structure on success', async () => {
      const mockTranscriber = vi.fn().mockResolvedValue({
        text: 'Rechnung für Kunde',
        confidence: 0.95,
        latencyMs: 100,
      });

      const pipeline = new PipelineOrchestrator({
        transcriptionHandler: mockTranscriber,
      });

      const result = await pipeline.processAudio(new ArrayBuffer(100));

      expect(result).toMatchObject({
        success: true,
        transcription: {
          text: 'Rechnung für Kunde',
          confidence: 0.95,
          latencyMs: 100,
        },
        classification: expect.objectContaining({
          intent: 'INVOICE',
          confidence: expect.any(Number),
          method: 'RULES',
        }),
        routing: expect.objectContaining({
          route: expect.any(String),
          confidence: expect.any(Number),
          intent: 'INVOICE',
        }),
        stageLatencies: expect.objectContaining({
          transcription: 100,
          classification: expect.any(Number),
          routing: expect.any(Number),
        }),
        totalLatencyMs: expect.any(Number),
      });
    });

    it('should have error structure on failure', async () => {
      const mockTranscriber = vi.fn().mockRejectedValue(new Error('Test error'));

      const pipeline = new PipelineOrchestrator({
        transcriptionHandler: mockTranscriber,
      });

      const result = await pipeline.processAudio(new ArrayBuffer(100));

      expect(result).toMatchObject({
        success: false,
        error: {
          stage: 'transcription',
          message: expect.stringContaining('Test error'),
        },
      });
    });
  });

  describe('Transcript Cleaning', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should enable cleaning by default', () => {
      const pipeline = new PipelineOrchestrator();
      const config = pipeline.getConfig();

      expect(config.enableCleaning).toBe(true);
    });

    it('should allow disabling cleaning', () => {
      const pipeline = new PipelineOrchestrator({
        enableCleaning: false,
      });
      const config = pipeline.getConfig();

      expect(config.enableCleaning).toBe(false);
    });

    it('should include CLEANING stage when enabled', async () => {
      const { cleanTranscript } = await import('../src/cleaner');
      const mockClean = cleanTranscript as ReturnType<typeof vi.fn>;

      const pipeline = new PipelineOrchestrator({
        enableCleaning: true,
      });

      await pipeline.processText('Äh, Rechnung für Kunde');

      expect(mockClean).toHaveBeenCalledWith({
        rawTranscript: 'Äh, Rechnung für Kunde',
      });
    });

    it('should skip CLEANING stage when disabled', async () => {
      const { cleanTranscript } = await import('../src/cleaner');
      const mockClean = cleanTranscript as ReturnType<typeof vi.fn>;

      const pipeline = new PipelineOrchestrator({
        enableCleaning: false,
      });

      await pipeline.processText('Rechnung für Kunde');

      expect(mockClean).not.toHaveBeenCalled();
    });

    it('should include cleaning result in pipeline result', async () => {
      const pipeline = new PipelineOrchestrator({
        enableCleaning: true,
      });

      const result = await pipeline.processText('Äh, Rechnung für Kunde');

      expect(result.cleaning).toBeDefined();
      expect(result.cleaning?.text).toBe('Rechnung für Müller GmbH über 500 Euro');
      expect(result.cleaning?.removedElements).toContain('äh (2x)');
      expect(result.cleaning?.latencyMs).toBe(200);
    });

    it('should track cleaning stage latency', async () => {
      const pipeline = new PipelineOrchestrator({
        enableCleaning: true,
      });

      const result = await pipeline.processText('Äh, Rechnung');

      expect(result.stageLatencies.cleaning).toBe(200);
    });

    it('should call onCleaning callback', async () => {
      const onCleaning = vi.fn();

      const pipeline = new PipelineOrchestrator({
        enableCleaning: true,
        callbacks: { onCleaning },
      });

      await pipeline.processText('Äh, Rechnung');

      expect(onCleaning).toHaveBeenCalledTimes(1);
      expect(onCleaning).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Rechnung für Müller GmbH über 500 Euro',
          removedElements: ['äh (2x)', 'ähm (1x)'],
          latencyMs: 200,
        })
      );
    });

    it('should call cleaning stage callbacks', async () => {
      const onStageStart = vi.fn();
      const onStageEnd = vi.fn();

      const pipeline = new PipelineOrchestrator({
        enableCleaning: true,
        callbacks: { onStageStart, onStageEnd },
      });

      await pipeline.processText('Äh, Rechnung');

      expect(onStageStart).toHaveBeenCalledWith(PipelineStage.CLEANING);
      expect(onStageEnd).toHaveBeenCalledWith(PipelineStage.CLEANING);
    });

    it('should use cleaned text for classification', async () => {
      const { cleanTranscript } = await import('../src/cleaner');
      const mockClean = cleanTranscript as ReturnType<typeof vi.fn>;

      mockClean.mockResolvedValueOnce({
        cleanedTranscript: 'Rechnung für Test GmbH',
        removedElements: ['äh (3x)'],
        latencyMs: 150,
      });

      const onClassification = vi.fn();

      const pipeline = new PipelineOrchestrator({
        enableCleaning: true,
        callbacks: { onClassification },
      });

      await pipeline.processText('Äh, äh, äh, Rechnung für Test GmbH');

      // Classification should receive the cleaned text
      expect(onClassification).toHaveBeenCalled();
      const classificationArg = onClassification.mock.calls[0][0];
      expect(classificationArg.intent).toBe('INVOICE');
    });

    it('should continue with raw text if cleaning fails', async () => {
      const { cleanTranscript } = await import('../src/cleaner');
      const mockClean = cleanTranscript as ReturnType<typeof vi.fn>;

      mockClean.mockRejectedValueOnce(new Error('Cleaning API failed'));

      const pipeline = new PipelineOrchestrator({
        enableCleaning: true,
      });

      const result = await pipeline.processText('Rechnung für Kunde');

      // Pipeline should succeed despite cleaning failure
      expect(result.success).toBe(true);
      expect(result.classification).toBeDefined();
      expect(result.cleaning).toBeUndefined(); // Cleaning failed, so no result
    });

    it('should call onError when cleaning fails', async () => {
      const { cleanTranscript } = await import('../src/cleaner');
      const mockClean = cleanTranscript as ReturnType<typeof vi.fn>;

      mockClean.mockRejectedValueOnce(new Error('API timeout'));

      const onError = vi.fn();

      const pipeline = new PipelineOrchestrator({
        enableCleaning: true,
        callbacks: { onError },
      });

      await pipeline.processText('Rechnung');

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: PipelineStage.CLEANING,
          message: 'API timeout',
        })
      );
    });

    it('should include cleaning in callbacks order', async () => {
      const callOrder: string[] = [];
      const mockTranscriber = vi.fn().mockResolvedValue({
        text: 'Äh, Rechnung',
        confidence: 0.9,
        latencyMs: 100,
      });

      const pipeline = new PipelineOrchestrator({
        transcriptionHandler: mockTranscriber,
        enableCleaning: true,
        callbacks: {
          onTranscription: (): void => {
            callOrder.push('transcription');
          },
          onCleaning: (): void => {
            callOrder.push('cleaning');
          },
          onClassification: (): void => {
            callOrder.push('classification');
          },
          onRouting: (): void => {
            callOrder.push('routing');
          },
          onComplete: (): void => {
            callOrder.push('complete');
          },
        },
      });

      await pipeline.processAudio(new ArrayBuffer(100));

      expect(callOrder).toEqual([
        'transcription',
        'cleaning',
        'classification',
        'routing',
        'complete',
      ]);
    });

    it('should have CLEANING stage in enum', () => {
      expect(PipelineStage.CLEANING).toBe('cleaning');
    });

    it('should track all stages including cleaning', async () => {
      const mockTranscriber = vi.fn().mockResolvedValue({
        text: 'Äh, Rechnung',
        confidence: 0.9,
        latencyMs: 100,
      });

      const pipeline = new PipelineOrchestrator({
        transcriptionHandler: mockTranscriber,
        enableCleaning: true,
      });

      const result = await pipeline.processAudio(new ArrayBuffer(100));

      expect(result.stageLatencies).toMatchObject({
        transcription: 100,
        cleaning: 200,
        classification: expect.any(Number),
        routing: expect.any(Number),
      });
    });
  });
});
