import { describe, it, expect } from 'vitest';
import { makeRoutingDecision, RoutingThresholds, DEFAULT_ROUTING_THRESHOLDS } from '../src/routing';
import type { IntentResult } from '../src/index';

describe('Routing Decision Function', () => {
  describe('Default thresholds', () => {
    it('should have correct default thresholds', () => {
      expect(DEFAULT_ROUTING_THRESHOLDS.autoSave).toBe(0.85);
      expect(DEFAULT_ROUTING_THRESHOLDS.preview).toBe(0.6);
    });
  });

  describe('Auto-save routing (confidence >= 0.85)', () => {
    it('should route to auto_save when confidence is exactly 0.85', () => {
      const intentResult: IntentResult = {
        intent: 'INVOICE',
        confidence: 0.85,
        method: 'RULES',
        latencyMs: 10,
      };

      const decision = makeRoutingDecision(intentResult);

      expect(decision.route).toBe('auto_save');
      expect(decision.confidence).toBe(0.85);
      expect(decision.reason).toContain('High confidence');
    });

    it('should route to auto_save when confidence is above 0.85', () => {
      const intentResult: IntentResult = {
        intent: 'INVOICE',
        confidence: 0.95,
        method: 'RULES',
        latencyMs: 10,
      };

      const decision = makeRoutingDecision(intentResult);

      expect(decision.route).toBe('auto_save');
    });

    it('should route to auto_save when confidence is 1.0', () => {
      const intentResult: IntentResult = {
        intent: 'INVOICE',
        confidence: 1.0,
        method: 'RULES',
        latencyMs: 10,
      };

      const decision = makeRoutingDecision(intentResult);

      expect(decision.route).toBe('auto_save');
    });

    it('should include intent in decision', () => {
      const intentResult: IntentResult = {
        intent: 'INVOICE',
        confidence: 0.9,
        method: 'RULES',
        latencyMs: 10,
      };

      const decision = makeRoutingDecision(intentResult);

      expect(decision.intent).toBe('INVOICE');
    });
  });

  describe('Preview routing (0.60 <= confidence < 0.85)', () => {
    it('should route to preview when confidence is exactly 0.60', () => {
      const intentResult: IntentResult = {
        intent: 'INVOICE',
        confidence: 0.6,
        method: 'RULES',
        latencyMs: 10,
      };

      const decision = makeRoutingDecision(intentResult);

      expect(decision.route).toBe('preview');
      expect(decision.reason).toContain('Medium confidence');
    });

    it('should route to preview when confidence is 0.84', () => {
      const intentResult: IntentResult = {
        intent: 'INVOICE',
        confidence: 0.84,
        method: 'RULES',
        latencyMs: 10,
      };

      const decision = makeRoutingDecision(intentResult);

      expect(decision.route).toBe('preview');
    });

    it('should route to preview when confidence is 0.70', () => {
      const intentResult: IntentResult = {
        intent: 'ANALYTICS',
        confidence: 0.7,
        method: 'RULES',
        latencyMs: 10,
      };

      const decision = makeRoutingDecision(intentResult);

      expect(decision.route).toBe('preview');
      expect(decision.intent).toBe('ANALYTICS');
    });
  });

  describe('Manual routing (confidence < 0.60)', () => {
    it('should route to manual when confidence is 0.59', () => {
      const intentResult: IntentResult = {
        intent: 'INVOICE',
        confidence: 0.59,
        method: 'RULES',
        latencyMs: 10,
      };

      const decision = makeRoutingDecision(intentResult);

      expect(decision.route).toBe('manual');
      expect(decision.reason).toContain('Low confidence');
    });

    it('should route to manual when confidence is 0', () => {
      const intentResult: IntentResult = {
        intent: 'UNKNOWN',
        confidence: 0,
        method: 'RULES',
        latencyMs: 10,
      };

      const decision = makeRoutingDecision(intentResult);

      expect(decision.route).toBe('manual');
    });

    it('should route to manual when confidence is very low', () => {
      const intentResult: IntentResult = {
        intent: 'INVOICE',
        confidence: 0.1,
        method: 'RULES',
        latencyMs: 10,
      };

      const decision = makeRoutingDecision(intentResult);

      expect(decision.route).toBe('manual');
    });
  });

  describe('UNKNOWN intent special handling', () => {
    it('should route to manual for UNKNOWN intent even with high confidence', () => {
      const intentResult: IntentResult = {
        intent: 'UNKNOWN',
        confidence: 0.9,
        method: 'RULES',
        latencyMs: 10,
      };

      const decision = makeRoutingDecision(intentResult);

      expect(decision.route).toBe('manual');
      expect(decision.reason).toContain('Unknown intent');
    });

    it('should route to manual for UNKNOWN intent with medium confidence', () => {
      const intentResult: IntentResult = {
        intent: 'UNKNOWN',
        confidence: 0.7,
        method: 'RULES',
        latencyMs: 10,
      };

      const decision = makeRoutingDecision(intentResult);

      expect(decision.route).toBe('manual');
    });
  });

  describe('Custom thresholds', () => {
    it('should respect custom autoSave threshold', () => {
      const intentResult: IntentResult = {
        intent: 'INVOICE',
        confidence: 0.9,
        method: 'RULES',
        latencyMs: 10,
      };

      const customThresholds: RoutingThresholds = {
        autoSave: 0.95,
        preview: 0.6,
      };

      const decision = makeRoutingDecision(intentResult, customThresholds);

      expect(decision.route).toBe('preview'); // 0.9 < 0.95
    });

    it('should respect custom preview threshold', () => {
      const intentResult: IntentResult = {
        intent: 'INVOICE',
        confidence: 0.5,
        method: 'RULES',
        latencyMs: 10,
      };

      const customThresholds: RoutingThresholds = {
        autoSave: 0.85,
        preview: 0.4,
      };

      const decision = makeRoutingDecision(intentResult, customThresholds);

      expect(decision.route).toBe('preview'); // 0.5 >= 0.4
    });

    it('should route to manual with higher preview threshold', () => {
      const intentResult: IntentResult = {
        intent: 'INVOICE',
        confidence: 0.65,
        method: 'RULES',
        latencyMs: 10,
      };

      const customThresholds: RoutingThresholds = {
        autoSave: 0.9,
        preview: 0.7,
      };

      const decision = makeRoutingDecision(intentResult, customThresholds);

      expect(decision.route).toBe('manual'); // 0.65 < 0.7
    });

    it('should handle very strict thresholds', () => {
      const intentResult: IntentResult = {
        intent: 'INVOICE',
        confidence: 0.98,
        method: 'RULES',
        latencyMs: 10,
      };

      const customThresholds: RoutingThresholds = {
        autoSave: 0.99,
        preview: 0.95,
      };

      const decision = makeRoutingDecision(intentResult, customThresholds);

      expect(decision.route).toBe('preview'); // 0.98 < 0.99 but >= 0.95
    });

    it('should handle very lenient thresholds', () => {
      const intentResult: IntentResult = {
        intent: 'INVOICE',
        confidence: 0.5,
        method: 'RULES',
        latencyMs: 10,
      };

      const customThresholds: RoutingThresholds = {
        autoSave: 0.5,
        preview: 0.3,
      };

      const decision = makeRoutingDecision(intentResult, customThresholds);

      expect(decision.route).toBe('auto_save'); // 0.5 >= 0.5
    });
  });

  describe('Edge cases', () => {
    it('should handle boundary at exactly auto_save threshold', () => {
      const intentResult: IntentResult = {
        intent: 'INVOICE',
        confidence: 0.85,
        method: 'RULES',
        latencyMs: 10,
      };

      const decision = makeRoutingDecision(intentResult);

      expect(decision.route).toBe('auto_save');
    });

    it('should handle boundary just below auto_save threshold', () => {
      const intentResult: IntentResult = {
        intent: 'INVOICE',
        confidence: 0.8499999,
        method: 'RULES',
        latencyMs: 10,
      };

      const decision = makeRoutingDecision(intentResult);

      expect(decision.route).toBe('preview');
    });

    it('should handle ANALYTICS intent with auto_save confidence', () => {
      const intentResult: IntentResult = {
        intent: 'ANALYTICS',
        confidence: 0.95,
        method: 'RULES',
        latencyMs: 10,
      };

      const decision = makeRoutingDecision(intentResult);

      expect(decision.route).toBe('auto_save');
      expect(decision.intent).toBe('ANALYTICS');
    });

    it('should preserve method information in decision', () => {
      const intentResult: IntentResult = {
        intent: 'INVOICE',
        confidence: 0.9,
        method: 'GEMINI',
        latencyMs: 150,
      };

      const decision = makeRoutingDecision(intentResult);

      expect(decision.method).toBe('GEMINI');
    });
  });

  describe('Decision metadata', () => {
    it('should include thresholds used in decision', () => {
      const intentResult: IntentResult = {
        intent: 'INVOICE',
        confidence: 0.75,
        method: 'RULES',
        latencyMs: 10,
      };

      const decision = makeRoutingDecision(intentResult);

      expect(decision.thresholds).toEqual(DEFAULT_ROUTING_THRESHOLDS);
    });

    it('should include custom thresholds in decision', () => {
      const intentResult: IntentResult = {
        intent: 'INVOICE',
        confidence: 0.75,
        method: 'RULES',
        latencyMs: 10,
      };

      const customThresholds: RoutingThresholds = {
        autoSave: 0.9,
        preview: 0.5,
      };

      const decision = makeRoutingDecision(intentResult, customThresholds);

      expect(decision.thresholds).toEqual(customThresholds);
    });
  });
});
