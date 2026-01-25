import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanTranscript } from '../src/cleaner';

// Create reusable mock functions
const mockGenerateContent = vi.fn();

// Mock the entire Gemini module
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return {
        generateContent: mockGenerateContent,
      };
    }
  },
}));

describe('Transcript Cleaner', () => {
  const originalEnv = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-api-key';
    mockGenerateContent.mockReset();
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalEnv;
  });

  describe('Basic cleaning', () => {
    it('should remove filler words from transcript', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Rechnung für Müller GmbH über 1500 Euro',
        },
      });

      const result = await cleanTranscript({
        rawTranscript: 'Rechnung für, also, Müller GmbH über, also, 1500 Euro',
      });

      expect(result.cleanedTranscript).toBe('Rechnung für Müller GmbH über 1500 Euro');
      // Should detect 'also' which appears twice in original but not in cleaned
      expect(result.removedElements.length).toBeGreaterThan(0);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should preserve numbers and amounts', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Rechnung über 2500 Euro mit 19% MwSt',
        },
      });

      const result = await cleanTranscript({
        rawTranscript: 'Äh, Rechnung über, hmm, 2500 Euro mit 19% MwSt',
      });

      expect(result.cleanedTranscript).toContain('2500 Euro');
      expect(result.cleanedTranscript).toContain('19%');
    });

    it('should preserve customer names and dates', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Rechnung für Acme GmbH vom 15. März',
        },
      });

      const result = await cleanTranscript({
        rawTranscript: 'Also, Rechnung für, ähm, Acme GmbH vom, quasi, 15. März',
      });

      expect(result.cleanedTranscript).toContain('Acme GmbH');
      expect(result.cleanedTranscript).toContain('15. März');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty transcript', async () => {
      const result = await cleanTranscript({
        rawTranscript: '',
      });

      expect(result.cleanedTranscript).toBe('');
      expect(result.removedElements).toEqual([]);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle very short transcript without API call', async () => {
      const result = await cleanTranscript({
        rawTranscript: 'Test',
      });

      expect(result.cleanedTranscript).toBe('Test');
      expect(result.removedElements).toEqual([]);
      expect(result.latencyMs).toBeLessThan(50); // Should be very fast (no API call)

      // Verify no API call was made
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('should handle transcript with no filler words', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Rechnung für Müller GmbH über 1000 Euro',
        },
      });

      const result = await cleanTranscript({
        rawTranscript: 'Rechnung für Müller GmbH über 1000 Euro',
      });

      expect(result.cleanedTranscript).toBe('Rechnung für Müller GmbH über 1000 Euro');
      expect(result.removedElements).toEqual([]);
    });
  });

  describe('Multiple filler words', () => {
    it('should count multiple occurrences correctly', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Rechnung für Müller GmbH über 1500 Euro',
        },
      });

      const result = await cleanTranscript({
        rawTranscript: 'Rechnung für, also, also, Müller GmbH über, quasi, quasi, quasi, 1500 Euro',
      });

      expect(result.removedElements).toContain('also (2x)');
      expect(result.removedElements).toContain('quasi (3x)');
      expect(result.removedElements.length).toBe(2);
    });
  });

  describe('Latency tracking', () => {
    it('should track latency in milliseconds', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Clean text',
        },
      });

      const result = await cleanTranscript({
        rawTranscript: 'Äh, äh, äh, some text here',
      });

      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.latencyMs).toBe('number');
    });
  });

  describe('Error handling', () => {
    it('should throw error when GEMINI_API_KEY is not set', async () => {
      delete process.env.GEMINI_API_KEY;

      await expect(
        cleanTranscript({
          rawTranscript: 'This is a longer transcript that will trigger API call',
        })
      ).rejects.toThrow('GEMINI_API_KEY environment variable not set');
    });

    it('should propagate API errors', async () => {
      mockGenerateContent.mockRejectedValue(new Error('API rate limit exceeded'));

      await expect(
        cleanTranscript({
          rawTranscript: 'Äh, this is a test transcript',
        })
      ).rejects.toThrow('Transcript cleaning failed: API rate limit exceeded');
    });
  });

  describe('Real-world scenarios', () => {
    it('should clean German invoice dictation with typical speech patterns', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            'Rechnung für Müller GmbH über 2500 Euro plus 19% Mehrwertsteuer fällig zum 31. Dezember',
        },
      });

      const result = await cleanTranscript({
        rawTranscript:
          'Äh, also, ich möchte eine Rechnung, ähm, für Müller GmbH, quasi über, hmm, 2500 Euro, also plus 19% Mehrwertsteuer, äh, fällig zum, also, 31. Dezember',
      });

      expect(result.cleanedTranscript).toContain('Müller GmbH');
      expect(result.cleanedTranscript).toContain('2500 Euro');
      expect(result.cleanedTranscript).toContain('19%');
      expect(result.cleanedTranscript).toContain('31. Dezember');
      expect(result.removedElements.length).toBeGreaterThan(0);
    });

    it('should handle repetitions and corrections', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Rechnung für Schneider AG über 3000 Euro',
        },
      });

      const result = await cleanTranscript({
        rawTranscript:
          'Rechnung für, äh nein, warte, also Rechnung für Schneider, äh, Schneider AG über, hmm, 3000, nein 3000 Euro',
      });

      expect(result.cleanedTranscript).toBe('Rechnung für Schneider AG über 3000 Euro');
    });

    it('should preserve time specifications', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Rechnung für 10 Stunden Beratung zu 150 Euro pro Stunde',
        },
      });

      const result = await cleanTranscript({
        rawTranscript:
          'Äh, Rechnung für, also, 10 Stunden Beratung, quasi zu, ähm, 150 Euro pro Stunde',
      });

      expect(result.cleanedTranscript).toContain('10 Stunden');
      expect(result.cleanedTranscript).toContain('150 Euro pro Stunde');
    });
  });
});
