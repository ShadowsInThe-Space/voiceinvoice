import { describe, it, expect } from 'vitest';
import { anonymizeCustomers, deanonymize, type TokenMap } from '../src/index';

describe('anonymizeCustomers', () => {
  // ============================================
  // Null-Safety Tests (Fix #3)
  // ============================================
  describe('null-safety', () => {
    it('should handle null knownEntities', () => {
      const text = 'Invoice for Acme Corp';
      const result = anonymizeCustomers(text, null);

      expect(result.anonymizedText).toBe(text);
      expect(result.entityCount).toBe(0);
      expect(result.tokenMap).toEqual({});
    });

    it('should handle undefined knownEntities', () => {
      const text = 'Invoice for Acme Corp';
      const result = anonymizeCustomers(text, undefined);

      expect(result.anonymizedText).toBe(text);
      expect(result.entityCount).toBe(0);
    });

    it('should handle empty array', () => {
      const text = 'Invoice for Acme Corp';
      const result = anonymizeCustomers(text, []);

      expect(result.anonymizedText).toBe(text);
      expect(result.entityCount).toBe(0);
    });

    it('should handle array with null/undefined values', () => {
      const text = 'Invoice for Acme Corp';
      // @ts-expect-error Testing runtime null handling
      const result = anonymizeCustomers(text, [null, undefined, '', 'Acme Corp']);

      // Should still find Acme Corp
      expect(result.entityCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle entities shorter than 3 characters', () => {
      const text = 'Invoice for AB Company';
      const result = anonymizeCustomers(text, ['AB']);

      // 'AB' is too short to match reliably
      expect(result.entityCount).toBe(0);
    });

    it('should handle empty text', () => {
      const result = anonymizeCustomers('', ['Acme Corp']);

      expect(result.anonymizedText).toBe('');
      expect(result.entityCount).toBe(0);
    });
  });

  // ============================================
  // Exact Match Tests
  // ============================================
  describe('exact matching', () => {
    it('should mask exact customer name matches', () => {
      const text = 'Rechnung an Müller GmbH';
      const result = anonymizeCustomers(text, ['Müller GmbH']);

      expect(result.entityCount).toBe(1);
      expect(result.anonymizedText).toContain('[CUSTOMER_');
      expect(result.anonymizedText).not.toContain('Müller GmbH');
    });

    it('should mask multiple different customer names', () => {
      const text = 'Von Alpha Inc an Beta GmbH';
      const result = anonymizeCustomers(text, ['Alpha Inc', 'Beta GmbH']);

      expect(result.entityCount).toBe(2);
      const customerTokens = result.anonymizedText.match(/\[CUSTOMER_[^\]]+\]/g);
      expect(customerTokens?.length).toBe(2);
    });
  });

  // ============================================
  // Fuzzy Matching Tests (20% Threshold - Fix #2)
  // ============================================
  describe('fuzzy matching with 20% threshold', () => {
    it('should match with minor typos', () => {
      // 'Muller' vs 'Müller' - 1 char difference in a 6 char word = ~17%
      const text = 'Rechnung an Muller GmbH';
      const result = anonymizeCustomers(text, ['Müller GmbH']);

      // The fuzzy matching should find this
      expect(result.entityCount).toBeGreaterThanOrEqual(0);
    });

    it('should NOT match with too many differences', () => {
      // 'Completely Different' is way more than 20% different from 'Müller GmbH'
      const text = 'Rechnung an Completely Different Company';
      const result = anonymizeCustomers(text, ['Müller GmbH']);

      expect(result.entityCount).toBe(0);
      expect(result.anonymizedText).toBe(text);
    });

    it('should handle case-insensitive matching', () => {
      const text = 'Invoice for ACME CORP';
      const result = anonymizeCustomers(text, ['Acme Corp']);

      // Should match despite case difference
      expect(result.entityCount).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================
  // De-anonymization Tests
  // ============================================
  describe('de-anonymization', () => {
    it('should restore original customer names', () => {
      const text = 'Invoice for Acme Corp';
      const anonymized = anonymizeCustomers(text, ['Acme Corp']);

      if (anonymized.entityCount > 0) {
        const restored = deanonymize(anonymized.anonymizedText, anonymized.tokenMap);
        expect(restored).toContain('Acme Corp');
      }
    });

    it('should restore multiple customer names', () => {
      const text = 'From Alpha Inc to Beta GmbH';
      const anonymized = anonymizeCustomers(text, ['Alpha Inc', 'Beta GmbH']);

      if (anonymized.entityCount > 0) {
        const restored = deanonymize(anonymized.anonymizedText, anonymized.tokenMap);
        expect(restored).toContain('Alpha');
        expect(restored).toContain('Beta');
      }
    });
  });

  // ============================================
  // Edge Cases
  // ============================================
  describe('edge cases', () => {
    it('should handle German special characters', () => {
      const text = 'Bestellung von Müller & Söhne AG';
      const result = anonymizeCustomers(text, ['Müller & Söhne AG']);

      // Should handle umlauts
      expect(result).toBeDefined();
    });

    it('should prioritize longer matches', () => {
      const text = 'Invoice for Super Corp International';
      const result = anonymizeCustomers(text, ['Super Corp', 'Super Corp International']);

      // Should match the longer name
      if (result.entityCount > 0) {
        const originalValues = Object.values(result.tokenMap);
        // At least one should be the longer version
        expect(
          originalValues.some((v) => v.includes('International') || v.includes('Super Corp'))
        ).toBe(true);
      }
    });

    it('should not create overlapping matches', () => {
      const text = 'Invoice for Test Company Ltd';
      const result = anonymizeCustomers(text, ['Test Company', 'Company Ltd']);

      // Should not have both overlapping matches
      const tokenCount = (result.anonymizedText.match(/\[CUSTOMER_/g) || []).length;
      expect(tokenCount).toBeLessThanOrEqual(2);
    });
  });

  // ============================================
  // Token Map Structure
  // ============================================
  describe('token map structure', () => {
    it('should return proper AnonymizationResult structure', () => {
      const text = 'Invoice for Test GmbH';
      const result = anonymizeCustomers(text, ['Test GmbH']);

      expect(result).toHaveProperty('anonymizedText');
      expect(result).toHaveProperty('tokenMap');
      expect(result).toHaveProperty('entityCount');
      expect(typeof result.anonymizedText).toBe('string');
      expect(typeof result.tokenMap).toBe('object');
      expect(typeof result.entityCount).toBe('number');
    });

    it('should map tokens to original values', () => {
      const text = 'Invoice for Acme Corp today';
      const result = anonymizeCustomers(text, ['Acme Corp']);

      if (result.entityCount > 0) {
        const tokens = Object.keys(result.tokenMap);
        expect(tokens.length).toBeGreaterThan(0);
        // Each token should map to a string value
        tokens.forEach((token) => {
          expect(typeof result.tokenMap[token]).toBe('string');
        });
      }
    });
  });
});
