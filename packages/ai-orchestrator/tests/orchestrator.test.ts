import { describe, it, expect, vi } from 'vitest';
import { AgentOrchestrator, EntityExtractor } from '../src/index';

describe('AgentOrchestrator', () => {
  describe('constructor', () => {
    it('should use default configuration when no config provided', () => {
      const orchestrator = new AgentOrchestrator();
      const config = orchestrator.getConfig();

      expect(config.directSaveThreshold).toBe(0.85);
      expect(config.useGeminiFallback).toBe(true);
      expect(config.maxLatencyMs).toBe(2000);
    });

    it('should accept custom configuration', () => {
      const orchestrator = new AgentOrchestrator({
        directSaveThreshold: 0.9,
        useGeminiFallback: false,
        maxLatencyMs: 3000,
      });
      const config = orchestrator.getConfig();

      expect(config.directSaveThreshold).toBe(0.9);
      expect(config.useGeminiFallback).toBe(false);
      expect(config.maxLatencyMs).toBe(3000);
    });

    it('should merge partial configuration with defaults', () => {
      const orchestrator = new AgentOrchestrator({
        directSaveThreshold: 0.7,
      });
      const config = orchestrator.getConfig();

      expect(config.directSaveThreshold).toBe(0.7);
      expect(config.useGeminiFallback).toBe(true);
      expect(config.maxLatencyMs).toBe(2000);
    });
  });

  describe('process', () => {
    it('should return orchestration result with transcription', async () => {
      const orchestrator = new AgentOrchestrator();
      const transcription = 'Rechnung an Müller GmbH';

      const result = await orchestrator.process(transcription);

      expect(result.transcription).toBe(transcription);
      expect(result.intent).toBeDefined();
      expect(result.totalLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should require preview for placeholder implementation', async () => {
      const orchestrator = new AgentOrchestrator();

      const result = await orchestrator.process('Test transcription');

      expect(result.requiresPreview).toBe(true);
    });
  });

  describe('classifyIntent', () => {
    it('should return UNKNOWN for ambiguous text without clear intent', async () => {
      const orchestrator = new AgentOrchestrator();

      const result = await orchestrator.classifyIntent('Any text');

      expect(result.intent).toBe('UNKNOWN');
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.method).toBe('RULES');
    });

    it('should detect INVOICE intent for invoice-related text', async () => {
      const orchestrator = new AgentOrchestrator();

      const result = await orchestrator.classifyIntent('Rechnung für Müller GmbH');

      expect(result.intent).toBe('INVOICE');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      expect(result.method).toBe('RULES');
    });

    it('should detect ANALYTICS intent for analytics-related text', async () => {
      const orchestrator = new AgentOrchestrator();

      const result = await orchestrator.classifyIntent('Zeige mir die Statistik');

      expect(result.intent).toBe('ANALYTICS');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      expect(result.method).toBe('RULES');
    });
  });

  describe('getConfig', () => {
    it('should return a copy of the configuration', () => {
      const orchestrator = new AgentOrchestrator();
      const config1 = orchestrator.getConfig();
      const config2 = orchestrator.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });
  });

  describe('process with EntityExtractor', () => {
    const mockExtractor: EntityExtractor = {
      extract: async () => ({
        customerName: 'Test Customer',
        netAmount: 100,
        taxAmount: 19,
        grossAmount: 119,
        currency: 'EUR',
        confidence: 0.95,
      }),
    };

    it('should extract entity data when intent is INVOICE', async () => {
      const orchestrator = new AgentOrchestrator({
        entityExtractor: mockExtractor,
      });

      const result = await orchestrator.process('Rechnung an Test Customer');

      expect(result.intent.intent).toBe('INVOICE');
      expect(result.invoiceData).toBeDefined();
      expect(result.invoiceData?.customerName).toBe('Test Customer');
      expect(result.requiresPreview).toBe(false); // 0.95 > 0.85
    });

    it('should handle extraction errors gracefully', async () => {
      const failingExtractor: EntityExtractor = {
        extract: async () => {
          throw new Error('Extraction failed');
        },
      };
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const orchestrator = new AgentOrchestrator({
        entityExtractor: failingExtractor,
      });

      const result = await orchestrator.process('Rechnung an Test Customer');

      expect(result.intent.intent).toBe('INVOICE');
      expect(result.invoiceData).toBeUndefined();
      expect(result.requiresPreview).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should require preview if confidence is low', async () => {
      const lowConfidenceExtractor: EntityExtractor = {
        extract: async () => ({
          customerName: 'Maybe Customer',
          confidence: 0.5,
        }),
      };
      const orchestrator = new AgentOrchestrator({
        entityExtractor: lowConfidenceExtractor,
      });

      const result = await orchestrator.process('Rechnung an Maybe Customer');

      expect(result.requiresPreview).toBe(true);
    });
  });
});
