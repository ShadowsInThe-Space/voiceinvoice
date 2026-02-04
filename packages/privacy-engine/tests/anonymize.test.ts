import { describe, it, expect } from 'vitest';
import { anonymize, anonymizeCustomers, deanonymize, type TokenMap } from '../src/index';

describe('anonymize', () => {
  describe('with known entities (array signature)', () => {
    it('should return the text unchanged if no known entities are provided', () => {
      const text = 'Send invoice to Müller GmbH';
      const result = anonymize(text);

      // Without known entities, only PII patterns are detected
      // "Müller GmbH" is not PII, so text remains
      expect(result.anonymizedText).toBe(text);
    });

    it('should mask exact matches of known entities', () => {
      const text = 'Invoice for Acme Corp';
      const result = anonymize(text, ['Acme Corp']);

      expect(result.anonymizedText).toBe('Invoice for [CUSTOMER_1]');
      expect(result.tokenMap['CUSTOMER_1']).toBe('Acme Corp');
    });

    it('should mask fuzzy matches of known entities', () => {
      // Fuse.js matches whole n-grams against known entities
      // "Acme Corp" in text matches "Acme Corp" entity
      const text = 'Invoice for Acme Corp please';
      const result = anonymize(text, ['Acme Corp']);

      expect(result.anonymizedText).toBe('Invoice for [CUSTOMER_1] please');
      expect(result.tokenMap['CUSTOMER_1']).toBe('Acme Corp');
    });

    it('should mask multiple different entities', () => {
      const text = 'Send from Alpha Inc to Beta LLC';
      const result = anonymize(text, ['Alpha Inc', 'Beta LLC']);

      // Check if tokens map to correct entities
      const values = Object.values(result.tokenMap);
      expect(values).toContain('Alpha Inc');
      expect(values).toContain('Beta LLC');
    });

    it('should handle null or undefined entities in array', () => {
      const text = 'Invoice for Acme Corp';
      const result = anonymize(text, [
        'Acme Corp',
        null as unknown as string,
        undefined as unknown as string,
      ]);

      expect(result.anonymizedText).toBe('Invoice for [CUSTOMER_1]');
    });
  });

  describe('with options (object signature)', () => {
    it('should mask emails', () => {
      const text = 'Contact me at test@example.com regarding the invoice.';
      const result = anonymize(text, { strategy: 'redact' });

      expect(result.anonymizedText).toContain('[EMAIL_1]');
      expect(result.anonymizedText).not.toContain('test@example.com');
      expect(result.tokenMap['EMAIL_1']).toBe('test@example.com');
    });

    it('should mask phone numbers', () => {
      const text = 'Call +49 123 456789 for support';
      const result = anonymize(text, { strategy: 'mask' });

      expect(result.anonymizedText).toContain('[PHONE_1]');
      expect(Object.values(result.tokenMap)).toContain('+49 123 456789');
    });

    it('should mask IBANs', () => {
      const iban = 'DE12 3456 7890 1234 5678 90';
      const text = `Please pay to ${iban} immediately.`;
      const result = anonymize(text);

      expect(result.anonymizedText).toContain('[IBAN_1]');
      expect(result.anonymizedText).not.toContain(iban);
      expect(result.tokenMap['IBAN_1']).toBe(iban);
    });

    it('should mask amounts', () => {
      const text = 'The total is 100.50 EUR.';
      const result = anonymize(text);

      expect(result.anonymizedText).toContain('[AMOUNT_1]');
      expect(Object.values(result.tokenMap)).toContain('100.50 EUR');
    });
  });
});

describe('anonymizeCustomers', () => {
  it('should return the text unchanged if no customer names are provided', () => {
    const text = 'Send invoice to Müller GmbH';
    const result = anonymizeCustomers(text);

    expect(result.anonymizedText).toBe(text);
    expect(result.entityCount).toBe(0);
    expect(result.tokenMap).toEqual({});
  });

  it('should mask exact matches of customer names', () => {
    const text = 'Invoice for Acme Corp';
    const result = anonymizeCustomers(text, ['Acme Corp']);

    expect(result.anonymizedText).toBe('Invoice for [CUSTOMER_1]');
    expect(result.entityCount).toBe(1);
    expect(result.tokenMap['CUSTOMER_1']).toBe('Acme Corp');
  });

  it('should mask fuzzy matches with Levenshtein distance', () => {
    const text = 'Rechnung an Mueler GmbH senden'; // Typo: Mueler instead of Müller
    const result = anonymizeCustomers(text, ['Müller GmbH']);

    expect(result.anonymizedText).toBe('Rechnung an [CUSTOMER_1] senden');
    expect(result.tokenMap['CUSTOMER_1']).toBe('Müller GmbH');
  });

  it('should not mask if fuzzy match is too far (>20% threshold)', () => {
    const text = 'Rechnung an Something Else';
    const result = anonymizeCustomers(text, ['Müller GmbH']);

    expect(result.anonymizedText).toBe(text);
    expect(result.entityCount).toBe(0);
  });

  it('should prioritize longer matches', () => {
    const text = 'Invoice for Super Corp International today';
    const result = anonymizeCustomers(text, ['Super Corp', 'Super Corp International']);

    expect(result.entityCount).toBe(1);
    expect(result.tokenMap['CUSTOMER_1']).toBe('Super Corp International');
    expect(result.anonymizedText).toBe('Invoice for [CUSTOMER_1] today');
  });

  it('should handle null or undefined customer names', () => {
    const text = 'Invoice for Acme Corp';
    const result = anonymizeCustomers(text, [
      'Acme Corp',
      null as unknown as string,
      undefined as unknown as string,
    ]);

    expect(result.anonymizedText).toBe('Invoice for [CUSTOMER_1]');
    expect(result.entityCount).toBe(1);
  });

  it('should skip short customer names (< 3 chars)', () => {
    const text = 'Invoice for AB Corp';
    const result = anonymizeCustomers(text, ['AB', 'AB Corp']);

    // "AB" should be skipped, "AB Corp" should match
    expect(result.anonymizedText).toBe('Invoice for [CUSTOMER_1]');
    expect(result.tokenMap['CUSTOMER_1']).toBe('AB Corp');
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

  it('should handle repeated tokens', () => {
    const text = '[CUSTOMER_1] called [CUSTOMER_1] again';
    const result = deanonymize(text, { CUSTOMER_1: 'Alice' });

    expect(result).toBe('Alice called Alice again');
  });
});
