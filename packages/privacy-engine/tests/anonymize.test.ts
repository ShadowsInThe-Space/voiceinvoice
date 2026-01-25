import { describe, it, expect } from 'vitest';
import { anonymize, deanonymize, type TokenMap } from '../src/index';

describe('anonymize', () => {
  it('should return the text unchanged if no known entities are provided', () => {
    const text = 'Send invoice to Müller GmbH';
    const result = anonymize(text);

    expect(result.anonymizedText).toBe(text);
    expect(result.entityCount).toBe(0);
    expect(result.tokenMap).toEqual({});
  });

  it('should mask exact matches of known entities', () => {
    const text = 'Invoice for Acme Corp';
    const result = anonymize(text, ['Acme Corp']);

    expect(result.anonymizedText).toBe('Invoice for [CUSTOMER_1]');
    expect(result.entityCount).toBe(1);
    expect(result.tokenMap['CUSTOMER_1']).toBe('Acme Corp');
  });

  it('should mask fuzzy matches of known entities', () => {
    const text = 'Invoice for Acme Copr please'; // Typo: Copr
    const result = anonymize(text, ['Acme Corp']);

    expect(result.anonymizedText).toBe('Invoice for [CUSTOMER_1] please');
    expect(result.entityCount).toBe(1);
    expect(result.tokenMap['CUSTOMER_1']).toBe('Acme Corp');
  });

  it('should mask multiple different entities', () => {
    const text = 'Send from Alpha Inc to Beta LLC';
    const result = anonymize(text, ['Alpha Inc', 'Beta LLC']);

    expect(result.entityCount).toBe(2);
    // Since order depends on implementation (sorted by length, then found order), we check contents
    expect(result.anonymizedText).toMatch(/Send from \[CUSTOMER_\d\] to \[CUSTOMER_\d\]/);

    // Check if tokens map to correct entities
    const tokens = Object.keys(result.tokenMap);
    expect(tokens.length).toBe(2);
    const values = Object.values(result.tokenMap);
    expect(values).toContain('Alpha Inc');
    expect(values).toContain('Beta LLC');
  });

  it('should prioritize longer matches', () => {
    // "Super Corp International" vs "Super Corp"
    // Ideally it should match "Super Corp International"
    const text = 'Invoice for Super Corp International today';
    const result = anonymize(text, ['Super Corp', 'Super Corp International']);

    expect(result.entityCount).toBe(1); // Should match the longer one and consume the text
    expect(result.tokenMap['CUSTOMER_1']).toBe('Super Corp International');
    expect(result.anonymizedText).toBe('Invoice for [CUSTOMER_1] today');
  });

  it('should handle fuzzy matching with Levenshtein distance', () => {
    // "Müller GmbH" vs "Mueler GmbH"
    const text = 'Rechnung an Mueler GmbH senden';
    const result = anonymize(text, ['Müller GmbH']);

    expect(result.anonymizedText).toBe('Rechnung an [CUSTOMER_1] senden');
    expect(result.tokenMap['CUSTOMER_1']).toBe('Müller GmbH');
  });

  it('should not mask if fuzzy match is too far', () => {
      const text = 'Rechnung an Something Else';
      const result = anonymize(text, ['Müller GmbH']);

      expect(result.anonymizedText).toBe(text);
      expect(result.entityCount).toBe(0);
  });

  it('should handle null or undefined entities in array', () => {
    const text = 'Invoice for Acme Corp';
    // Test null-safety: null entries should be skipped
    const result = anonymize(text, ['Acme Corp', null as unknown as string, undefined as unknown as string]);

    expect(result.anonymizedText).toBe('Invoice for [CUSTOMER_1]');
    expect(result.entityCount).toBe(1);
  });
});

describe('deanonymize', () => {
  it('should replace tokens with original values', () => {
    const anonymizedText = 'Invoice for [CUSTOMER_1]';
    const tokenMap: TokenMap = { CUSTOMER_1: 'Acme Corp' };

    const result = deanonymize(anonymizedText, tokenMap);

    expect(result).toBe('Invoice for Acme Corp');
  });

  it('should handle multiple tokens', () => {
    const anonymizedText = '[CUSTOMER_1] owes [AMOUNT_1] to [CUSTOMER_2]';
    const tokenMap: TokenMap = {
      CUSTOMER_1: 'Buyer Inc',
      AMOUNT_1: '1000 EUR',
      CUSTOMER_2: 'Seller GmbH',
    };

    const result = deanonymize(anonymizedText, tokenMap);

    expect(result).toBe('Buyer Inc owes 1000 EUR to Seller GmbH');
  });

  it('should handle empty token map', () => {
    const text = 'Plain text without tokens';
    const result = deanonymize(text, {});

    expect(result).toBe(text);
  });

  it('should handle tokens not present in map gracefully', () => {
     const text = 'Hello [CUSTOMER_999]';
     const result = deanonymize(text, { CUSTOMER_1: 'Foo' });
     // Should remain unchanged if not in map
     expect(result).toBe('Hello [CUSTOMER_999]');
  });
});
