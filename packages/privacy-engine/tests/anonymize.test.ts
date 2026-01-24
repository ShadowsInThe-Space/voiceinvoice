import { describe, it, expect } from 'vitest';
import { anonymize, deanonymize, type TokenMap } from '../src/index';

describe('anonymize', () => {
  it('should return the text unchanged for placeholder implementation', () => {
    const text = 'Send invoice to Müller GmbH';
    const result = anonymize(text);

    expect(result.anonymizedText).toBe(text);
    expect(result.entityCount).toBe(0);
    expect(result.tokenMap).toEqual({});
  });

  it('should accept known entities parameter', () => {
    const text = 'Invoice for Acme Corp';
    const result = anonymize(text, ['Acme Corp']);

    // Placeholder returns unchanged, but accepts the parameter
    expect(result.anonymizedText).toBeDefined();
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
});
