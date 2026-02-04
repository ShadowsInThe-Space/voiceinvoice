import { describe, it, expect } from 'vitest';
import { anonymize, deanonymize, type TokenMap } from '../src/index';

describe('anonymize', () => {
  it('should mask emails', () => {
    const text = 'Contact me at test@example.com regarding the invoice.';
    const result = anonymize(text);

    expect(result.anonymizedText).toContain('[EMAIL_1]');
    expect(result.anonymizedText).not.toContain('test@example.com');
    expect(result.tokenMap['EMAIL_1']).toBe('test@example.com');
  });

  it('should mask phone numbers', () => {
    const text = 'Call +49 123 456789 or 030 1234567';
    const result = anonymize(text);

    expect(result.anonymizedText).toMatch(/Call \[PHONE_\d\] or \[PHONE_\d\]/);
    expect(Object.values(result.tokenMap)).toContain('+49 123 456789');
    expect(Object.values(result.tokenMap)).toContain('030 1234567');
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
    const text = 'The total is 100.50 EUR or $50.';
    const result = anonymize(text);

    expect(result.anonymizedText).toContain('[AMOUNT_1]');
    expect(result.anonymizedText).toContain('[AMOUNT_2]');
    expect(Object.values(result.tokenMap)).toContain('100.50 EUR');
    expect(Object.values(result.tokenMap)).toContain('$50');
  });

  it('should mask known entities (exact match)', () => {
    const text = 'Invoice for Acme Corp.';
    const result = anonymize(text, ['Acme Corp']);

    expect(result.anonymizedText).toContain('[CUSTOMER_1]');
    expect(result.anonymizedText).not.toContain('Acme Corp');
    expect(result.tokenMap['CUSTOMER_1']).toBe('Acme Corp');
  });

  it('should mask known entities (fuzzy match)', () => {
    // "Muller GmbH" vs "Müller GmbH"
    const text = 'Send to Muller GmbH please.';
    const result = anonymize(text, ['Müller GmbH']);

    expect(result.anonymizedText).toContain('[CUSTOMER_1]');
    expect(result.anonymizedText).not.toContain('Muller GmbH');
    // Note: The token value maps to the *found* text ("Muller GmbH") or the *known* entity?
    // My implementation replaces the range with token, and maps token -> found text in original string.
    // In `Anonymizer.ts`: `this.tokenMap[token] = value` where value is `match.entity` (from Fuse) or the text found?
    // Let's check `Anonymizer.ts`.
    // In `maskKnownEntities`: `matches.push({..., entity: result[0].item})`.
    // Then `this.getToken('CUSTOMER', m.entity)`.
    // So the token maps to the *Canonical Entity Name* ("Müller GmbH").
    // Wait, if I use `getToken`, and pass `m.entity` (Müller GmbH), then `tokenMap['CUSTOMER_1']` will be `Müller GmbH`.
    // And when I deanonymize, `[CUSTOMER_1]` becomes `Müller GmbH`.
    // So "Muller GmbH" becomes "Müller GmbH". This is actually a feature (correction).

    expect(result.tokenMap['CUSTOMER_1']).toBe('Müller GmbH');
  });

  it('should handle multiple known entities', () => {
    const text = 'Acme Corp and Beta Ltd are partners.';
    const result = anonymize(text, ['Acme Corp', 'Beta Ltd']);

    expect(result.anonymizedText).toContain('[CUSTOMER_1]');
    expect(result.anonymizedText).toContain('[CUSTOMER_2]');
  });

  it('should reuse tokens for same values', () => {
      const text = 'Email bob@example.com or bob@example.com';
      const result = anonymize(text);

      expect(result.anonymizedText).toBe('Email [EMAIL_1] or [EMAIL_1]');
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
});
