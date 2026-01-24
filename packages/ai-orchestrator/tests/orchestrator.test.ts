import { describe, it, expect } from 'vitest';
import { AgentOrchestrator } from '../src/index';

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
    it('should return UNKNOWN for placeholder implementation', async () => {
      const orchestrator = new AgentOrchestrator();

      const result = await orchestrator.classifyIntent('Any text');

      expect(result.intent).toBe('UNKNOWN');
      expect(result.confidence).toBe(0);
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
});
