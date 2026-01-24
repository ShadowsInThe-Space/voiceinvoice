import { describe, it, expect } from 'vitest';
import { AgentOrchestrator } from '../src/index';

describe('Intent Classification', () => {
  const orchestrator = new AgentOrchestrator();

  describe('INVOICE intent detection', () => {
    describe('German invoice keywords', () => {
      it('should detect "Rechnung für..." as INVOICE', async () => {
        const result = await orchestrator.classifyIntent('Rechnung für Müller GmbH');

        expect(result.intent).toBe('INVOICE');
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
        expect(result.method).toBe('RULES');
      });

      it('should detect "Erstelle Rechnung..." as INVOICE', async () => {
        const result = await orchestrator.classifyIntent('Erstelle Rechnung für Acme Corp');

        expect(result.intent).toBe('INVOICE');
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      });

      it('should detect "Neue Rechnung..." as INVOICE', async () => {
        const result = await orchestrator.classifyIntent('Neue Rechnung an Schmidt AG');

        expect(result.intent).toBe('INVOICE');
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      });

      it('should detect "Rechnung erstellen" as INVOICE', async () => {
        const result = await orchestrator.classifyIntent('Rechnung erstellen für Kunde');

        expect(result.intent).toBe('INVOICE');
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      });
    });

    describe('Customer mentions', () => {
      it('should detect customer mentions with "an" as INVOICE', async () => {
        const result = await orchestrator.classifyIntent('Rechnung an Müller GmbH über 500 Euro');

        expect(result.intent).toBe('INVOICE');
        expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      });

      it('should detect customer mentions with "für" as INVOICE', async () => {
        const result = await orchestrator.classifyIntent('Rechnung für Schmidt AG');

        expect(result.intent).toBe('INVOICE');
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      });
    });

    describe('Amount mentions', () => {
      it('should detect Euro amounts as INVOICE', async () => {
        const result = await orchestrator.classifyIntent('Rechnung über 1500 Euro');

        expect(result.intent).toBe('INVOICE');
        expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      });

      it('should detect EUR amounts as INVOICE', async () => {
        const result = await orchestrator.classifyIntent('Rechnung über 1500 EUR');

        expect(result.intent).toBe('INVOICE');
        expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      });

      it('should detect € symbol as INVOICE', async () => {
        const result = await orchestrator.classifyIntent('Rechnung über 1500€');

        expect(result.intent).toBe('INVOICE');
        expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      });

      it('should detect written amounts like "tausend Euro" as INVOICE', async () => {
        const result = await orchestrator.classifyIntent(
          'Rechnung an Müller GmbH über tausend Euro'
        );

        expect(result.intent).toBe('INVOICE');
        expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      });
    });

    describe('Tax mentions', () => {
      it('should boost confidence when MwSt is mentioned', async () => {
        const result = await orchestrator.classifyIntent('Rechnung über 1000 Euro plus MwSt');

        expect(result.intent).toBe('INVOICE');
        expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      });

      it('should boost confidence when Mehrwertsteuer is mentioned', async () => {
        const result = await orchestrator.classifyIntent('Rechnung mit Mehrwertsteuer');

        expect(result.intent).toBe('INVOICE');
        expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      });
    });

    describe('Complex invoice requests', () => {
      it('should handle full invoice request with all components', async () => {
        const result = await orchestrator.classifyIntent(
          'Erstelle Rechnung an Müller GmbH über 1500 Euro plus MwSt für Beratungsleistung'
        );

        expect(result.intent).toBe('INVOICE');
        expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      });
    });
  });

  describe('ANALYTICS intent detection', () => {
    describe('Question patterns', () => {
      it('should detect "Wie viele..." as ANALYTICS', async () => {
        const result = await orchestrator.classifyIntent(
          'Wie viele Rechnungen habe ich diesen Monat erstellt?'
        );

        expect(result.intent).toBe('ANALYTICS');
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      });

      it('should detect "Wie viel..." as ANALYTICS', async () => {
        const result = await orchestrator.classifyIntent('Wie viel Umsatz habe ich gemacht?');

        expect(result.intent).toBe('ANALYTICS');
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      });

      it('should detect "Was ist..." analytics queries', async () => {
        const result = await orchestrator.classifyIntent(
          'Was ist mein durchschnittlicher Rechnungsbetrag?'
        );

        expect(result.intent).toBe('ANALYTICS');
        expect(result.confidence).toBeGreaterThanOrEqual(0.75);
      });
    });

    describe('Display commands', () => {
      it('should detect "Zeige mir..." as ANALYTICS', async () => {
        const result = await orchestrator.classifyIntent('Zeige mir die Umsätze vom letzten Monat');

        expect(result.intent).toBe('ANALYTICS');
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      });

      it('should detect "Zeig mir..." as ANALYTICS', async () => {
        const result = await orchestrator.classifyIntent('Zeig mir alle offenen Rechnungen');

        expect(result.intent).toBe('ANALYTICS');
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      });
    });

    describe('Analytics keywords', () => {
      it('should detect "Umsatz" queries as ANALYTICS', async () => {
        const result = await orchestrator.classifyIntent('Umsatz diesen Monat');

        expect(result.intent).toBe('ANALYTICS');
        expect(result.confidence).toBeGreaterThanOrEqual(0.75);
      });

      it('should detect "Statistik" as ANALYTICS', async () => {
        const result = await orchestrator.classifyIntent('Zeige Statistik');

        expect(result.intent).toBe('ANALYTICS');
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      });

      it('should detect "Übersicht" as ANALYTICS', async () => {
        const result = await orchestrator.classifyIntent('Gib mir eine Übersicht');

        expect(result.intent).toBe('ANALYTICS');
        expect(result.confidence).toBeGreaterThanOrEqual(0.75);
      });

      it('should detect "Bericht" as ANALYTICS', async () => {
        const result = await orchestrator.classifyIntent('Erstelle Bericht für Januar');

        expect(result.intent).toBe('ANALYTICS');
        expect(result.confidence).toBeGreaterThanOrEqual(0.75);
      });

      it('should detect "Report" as ANALYTICS', async () => {
        const result = await orchestrator.classifyIntent('Monatlicher Report');

        expect(result.intent).toBe('ANALYTICS');
        expect(result.confidence).toBeGreaterThanOrEqual(0.75);
      });
    });

    describe('Time-based queries', () => {
      it('should detect queries about monthly data as ANALYTICS', async () => {
        const result = await orchestrator.classifyIntent('Wie waren die Umsätze im letzten Monat?');

        expect(result.intent).toBe('ANALYTICS');
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      });

      it('should detect queries about yearly data as ANALYTICS', async () => {
        const result = await orchestrator.classifyIntent('Umsatz im Jahr 2024');

        expect(result.intent).toBe('ANALYTICS');
        expect(result.confidence).toBeGreaterThanOrEqual(0.75);
      });
    });

    describe('Aggregation keywords', () => {
      it('should detect "durchschnitt" as ANALYTICS', async () => {
        const result = await orchestrator.classifyIntent('Durchschnittlicher Rechnungsbetrag');

        expect(result.intent).toBe('ANALYTICS');
        expect(result.confidence).toBeGreaterThanOrEqual(0.75);
      });

      it('should detect "gesamt" as ANALYTICS', async () => {
        const result = await orchestrator.classifyIntent('Gesamtumsatz dieses Quartal');

        expect(result.intent).toBe('ANALYTICS');
        expect(result.confidence).toBeGreaterThanOrEqual(0.75);
      });

      it('should detect "summe" as ANALYTICS', async () => {
        const result = await orchestrator.classifyIntent('Summe aller Rechnungen');

        expect(result.intent).toBe('ANALYTICS');
        expect(result.confidence).toBeGreaterThanOrEqual(0.75);
      });
    });
  });

  describe('UNKNOWN intent', () => {
    it('should return UNKNOWN for empty input', async () => {
      const result = await orchestrator.classifyIntent('');

      expect(result.intent).toBe('UNKNOWN');
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should return UNKNOWN for gibberish', async () => {
      const result = await orchestrator.classifyIntent('asdf jkl xyz');

      expect(result.intent).toBe('UNKNOWN');
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should return UNKNOWN for ambiguous input', async () => {
      const result = await orchestrator.classifyIntent('Hallo');

      expect(result.intent).toBe('UNKNOWN');
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should return UNKNOWN for unrelated business queries', async () => {
      const result = await orchestrator.classifyIntent('Wie ist das Wetter heute?');

      expect(result.intent).toBe('UNKNOWN');
      expect(result.confidence).toBeLessThan(0.5);
    });
  });

  describe('Edge cases', () => {
    it('should handle case-insensitive matching', async () => {
      const result = await orchestrator.classifyIntent('RECHNUNG FÜR MÜLLER GMBH');

      expect(result.intent).toBe('INVOICE');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should handle mixed case', async () => {
      const result = await orchestrator.classifyIntent('ReChNuNg für Kunde');

      expect(result.intent).toBe('INVOICE');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should handle extra whitespace', async () => {
      const result = await orchestrator.classifyIntent('  Rechnung   für   Müller  ');

      expect(result.intent).toBe('INVOICE');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should prefer INVOICE when both signals present but invoice is stronger', async () => {
      // "Rechnung" is a strong invoice keyword, "Statistik" alone is analytics
      // but "Rechnung für X über Y Euro" should win
      const result = await orchestrator.classifyIntent(
        'Rechnung für Müller GmbH über 500 Euro Statistik-Beratung'
      );

      expect(result.intent).toBe('INVOICE');
    });
  });

  describe('Confidence scores', () => {
    it('should return confidence between 0 and 1', async () => {
      const result = await orchestrator.classifyIntent('Rechnung für Kunde');

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should have higher confidence for more specific requests', async () => {
      const simpleResult = await orchestrator.classifyIntent('Rechnung');
      const detailedResult = await orchestrator.classifyIntent(
        'Erstelle Rechnung an Müller GmbH über 1500 Euro plus MwSt'
      );

      expect(detailedResult.confidence).toBeGreaterThan(simpleResult.confidence);
    });
  });

  describe('Latency tracking', () => {
    it('should track latency in milliseconds', async () => {
      const result = await orchestrator.classifyIntent('Rechnung für Kunde');

      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.latencyMs).toBeLessThan(100); // Rule-based should be fast
    });

    it('should use RULES method for keyword matching', async () => {
      const result = await orchestrator.classifyIntent('Rechnung für Kunde');

      expect(result.method).toBe('RULES');
    });
  });
});
