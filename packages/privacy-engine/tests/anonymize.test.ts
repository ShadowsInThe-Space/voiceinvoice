import { describe, it, expect } from 'vitest';
import { anonymize, deanonymize, detectPII, type TokenMap, type PIIPattern } from '../src/index';

// ============================================
// PII Detection Tests
// ============================================

describe('detectPII', () => {
  describe('email detection', () => {
    it('should detect simple email addresses', () => {
      const text = 'Contact me at john@example.com for details.';
      const matches = detectPII(text);

      expect(matches).toContainEqual(
        expect.objectContaining({
          type: 'EMAIL',
          value: 'john@example.com',
        })
      );
    });

    it('should detect multiple email addresses', () => {
      const text = 'Send to alice@company.de and bob@firm.com';
      const matches = detectPII(text);

      const emails = matches.filter((m) => m.type === 'EMAIL');
      expect(emails).toHaveLength(2);
      expect(emails.map((e) => e.value)).toEqual(['alice@company.de', 'bob@firm.com']);
    });

    it('should detect emails with subdomains', () => {
      const text = 'Email: support@mail.company.co.uk';
      const matches = detectPII(text);

      expect(matches).toContainEqual(
        expect.objectContaining({
          type: 'EMAIL',
          value: 'support@mail.company.co.uk',
        })
      );
    });

    it('should detect emails with plus addressing', () => {
      const text = 'Use user+invoices@gmail.com for invoices';
      const matches = detectPII(text);

      expect(matches).toContainEqual(
        expect.objectContaining({
          type: 'EMAIL',
          value: 'user+invoices@gmail.com',
        })
      );
    });
  });

  describe('phone number detection (German format)', () => {
    it('should detect German mobile numbers with +49', () => {
      const text = 'Call me at +49 170 1234567';
      const matches = detectPII(text);

      expect(matches).toContainEqual(
        expect.objectContaining({
          type: 'PHONE',
          value: '+49 170 1234567',
        })
      );
    });

    it('should detect German landline numbers with +49', () => {
      const text = 'Office: +49 30 12345678';
      const matches = detectPII(text);

      expect(matches).toContainEqual(
        expect.objectContaining({
          type: 'PHONE',
        })
      );
    });

    it('should detect German numbers with 0 prefix', () => {
      const text = 'Fax: 030 12345678';
      const matches = detectPII(text);

      expect(matches).toContainEqual(
        expect.objectContaining({
          type: 'PHONE',
        })
      );
    });

    it('should detect mobile numbers with 0 prefix', () => {
      const text = 'Mobile: 0170 1234567';
      const matches = detectPII(text);

      expect(matches).toContainEqual(
        expect.objectContaining({
          type: 'PHONE',
        })
      );
    });

    it('should detect numbers with various separators', () => {
      const text = 'Phone: +49-170-1234567 or 0170/1234567';
      const matches = detectPII(text);

      const phones = matches.filter((m) => m.type === 'PHONE');
      expect(phones.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('IBAN detection', () => {
    it('should detect German IBAN', () => {
      const text = 'Pay to IBAN: DE89370400440532013000';
      const matches = detectPII(text);

      expect(matches).toContainEqual(
        expect.objectContaining({
          type: 'IBAN',
          value: 'DE89370400440532013000',
        })
      );
    });

    it('should detect IBAN with spaces', () => {
      const text = 'IBAN: DE89 3704 0044 0532 0130 00';
      const matches = detectPII(text);

      expect(matches).toContainEqual(
        expect.objectContaining({
          type: 'IBAN',
        })
      );
    });

    it('should detect other European IBANs', () => {
      const text = 'Austrian: AT611904300234573201 French: FR7630006000011234567890189';
      const matches = detectPII(text);

      const ibans = matches.filter((m) => m.type === 'IBAN');
      expect(ibans.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Tax ID detection', () => {
    it('should detect German Steuernummer', () => {
      const text = 'Steuernummer: 123/456/78901';
      const matches = detectPII(text);

      expect(matches).toContainEqual(
        expect.objectContaining({
          type: 'TAX_ID',
        })
      );
    });

    it('should detect USt-IdNr (VAT ID)', () => {
      const text = 'USt-IdNr: DE123456789';
      const matches = detectPII(text);

      expect(matches).toContainEqual(
        expect.objectContaining({
          type: 'VAT_ID',
          value: 'DE123456789',
        })
      );
    });

    it('should detect VAT ID in various formats', () => {
      const text = 'VAT: DE 123 456 789';
      const matches = detectPII(text);

      expect(matches).toContainEqual(
        expect.objectContaining({
          type: 'VAT_ID',
        })
      );
    });
  });

  describe('combined detection', () => {
    it('should detect multiple PII types in one text', () => {
      const text = `
        Contact: john.doe@company.de
        Phone: +49 170 1234567
        IBAN: DE89370400440532013000
        VAT: DE123456789
      `;
      const matches = detectPII(text);

      expect(matches.filter((m) => m.type === 'EMAIL')).toHaveLength(1);
      expect(matches.filter((m) => m.type === 'PHONE')).toHaveLength(1);
      expect(matches.filter((m) => m.type === 'IBAN')).toHaveLength(1);
      expect(matches.filter((m) => m.type === 'VAT_ID')).toHaveLength(1);
    });

    it('should return empty array for text without PII', () => {
      const text = 'This is a simple invoice for services rendered.';
      const matches = detectPII(text);

      expect(matches).toHaveLength(0);
    });

    it('should include position information', () => {
      const text = 'Email: test@example.com';
      const matches = detectPII(text);

      expect(matches[0]).toHaveProperty('start');
      expect(matches[0]).toHaveProperty('end');
      expect(matches[0].start).toBe(7);
      expect(matches[0].end).toBe(23);
    });
  });
});

// ============================================
// Anonymization Tests
// ============================================

describe('anonymize', () => {
  describe('mask strategy', () => {
    it('should mask email addresses', () => {
      const text = 'Contact: john@example.com';
      const result = anonymize(text, { strategy: 'mask' });

      expect(result.anonymizedText).toMatch(/j\*+@e\*+\.com/);
      expect(result.anonymizedText).not.toContain('john@example.com');
    });

    it('should mask phone numbers', () => {
      const text = 'Call +49 170 1234567';
      const result = anonymize(text, { strategy: 'mask' });

      expect(result.anonymizedText).toContain('+49');
      expect(result.anonymizedText).toContain('***');
    });

    it('should mask IBAN numbers', () => {
      const text = 'Pay to DE89370400440532013000';
      const result = anonymize(text, { strategy: 'mask' });

      expect(result.anonymizedText).toContain('DE89');
      expect(result.anonymizedText).toContain('***');
    });

    it('should mask VAT IDs', () => {
      const text = 'VAT: DE123456789';
      const result = anonymize(text, { strategy: 'mask' });

      expect(result.anonymizedText).toContain('DE');
      expect(result.anonymizedText).toContain('***');
    });
  });

  describe('redact strategy', () => {
    it('should redact email addresses', () => {
      const text = 'Contact: john@example.com';
      const result = anonymize(text, { strategy: 'redact' });

      expect(result.anonymizedText).toBe('Contact: [EMAIL_REDACTED]');
    });

    it('should redact phone numbers', () => {
      const text = 'Call +49 170 1234567';
      const result = anonymize(text, { strategy: 'redact' });

      expect(result.anonymizedText).toBe('Call [PHONE_REDACTED]');
    });

    it('should redact IBAN numbers', () => {
      const text = 'Pay to DE89370400440532013000';
      const result = anonymize(text, { strategy: 'redact' });

      expect(result.anonymizedText).toBe('Pay to [IBAN_REDACTED]');
    });

    it('should redact multiple PII types', () => {
      const text = 'Email john@test.com or call +49 170 1234567';
      const result = anonymize(text, { strategy: 'redact' });

      expect(result.anonymizedText).toBe('Email [EMAIL_REDACTED] or call [PHONE_REDACTED]');
    });

    it('should use unique redaction tokens', () => {
      const text = 'Email alice@test.com and bob@test.com';
      const result = anonymize(text, { strategy: 'redact' });

      expect(result.anonymizedText).toContain('[EMAIL_REDACTED_1]');
      expect(result.anonymizedText).toContain('[EMAIL_REDACTED_2]');
    });
  });

  describe('hash strategy', () => {
    it('should hash email addresses', () => {
      const text = 'Contact: john@example.com';
      const result = anonymize(text, { strategy: 'hash' });

      expect(result.anonymizedText).not.toContain('john@example.com');
      expect(result.anonymizedText).toMatch(/Contact: \[[A-Za-z0-9]{8}\]/);
    });

    it('should provide reversible token mapping', () => {
      const text = 'Contact: john@example.com';
      const result = anonymize(text, { strategy: 'hash' });

      expect(Object.values(result.tokenMap)).toContain('john@example.com');
    });

    it('should generate consistent hashes for same input', () => {
      const text = 'Email: test@test.com and test@test.com';
      const result = anonymize(text, { strategy: 'hash' });

      // Same email should get same hash
      const hashPattern = /\[([A-Za-z0-9]{8})\]/g;
      const hashes = [...result.anonymizedText.matchAll(hashPattern)].map((m) => m[1]);
      expect(hashes[0]).toBe(hashes[1]);
    });
  });

  describe('custom patterns', () => {
    it('should only detect specified patterns', () => {
      const text = 'Email: john@test.com Phone: +49 170 1234567';
      const result = anonymize(text, {
        strategy: 'redact',
        patterns: ['EMAIL' as PIIPattern],
      });

      expect(result.anonymizedText).toContain('[EMAIL_REDACTED]');
      expect(result.anonymizedText).toContain('+49 170 1234567');
    });

    it('should handle empty patterns array', () => {
      const text = 'Email: john@test.com';
      const result = anonymize(text, {
        strategy: 'redact',
        patterns: [],
      });

      expect(result.anonymizedText).toBe(text);
      expect(result.entityCount).toBe(0);
    });
  });

  describe('default behavior', () => {
    it('should use redact as default strategy', () => {
      const text = 'Email: john@test.com';
      const result = anonymize(text);

      expect(result.anonymizedText).toContain('[EMAIL_REDACTED]');
    });

    it('should detect all PII types by default', () => {
      const text = 'Email: a@b.com Phone: +49 170 1234567 IBAN: DE89370400440532013000';
      const result = anonymize(text);

      expect(result.entityCount).toBe(3);
    });
  });

  describe('result structure', () => {
    it('should return correct entity count', () => {
      const text = 'Emails: a@b.com, c@d.com, e@f.com';
      const result = anonymize(text, { strategy: 'redact' });

      expect(result.entityCount).toBe(3);
    });

    it('should include token map with original values', () => {
      const text = 'Email: test@example.com';
      const result = anonymize(text, { strategy: 'hash' });

      const tokens = Object.keys(result.tokenMap);
      expect(tokens.length).toBe(1);
      expect(result.tokenMap[tokens[0]]).toBe('test@example.com');
    });
  });
});

// ============================================
// Deanonymization Tests
// ============================================

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

  it('should handle hash tokens from anonymize', () => {
    const text = 'Contact: john@example.com';
    const anonymized = anonymize(text, { strategy: 'hash' });
    const restored = deanonymize(anonymized.anonymizedText, anonymized.tokenMap);

    expect(restored).toBe(text);
  });

  it('should handle repeated tokens', () => {
    const anonymizedText = '[TOKEN] and [TOKEN] again';
    const tokenMap: TokenMap = { TOKEN: 'value' };

    const result = deanonymize(anonymizedText, tokenMap);

    expect(result).toBe('value and value again');
  });
});

// ============================================
// Edge Cases and Error Handling
// ============================================

describe('edge cases', () => {
  it('should handle empty string', () => {
    expect(detectPII('')).toEqual([]);
    expect(anonymize('').anonymizedText).toBe('');
    expect(deanonymize('', {})).toBe('');
  });

  it('should handle very long text', () => {
    const email = 'test@example.com';
    const text = 'prefix '.repeat(1000) + email + ' suffix'.repeat(1000);

    const matches = detectPII(text);
    expect(matches).toContainEqual(expect.objectContaining({ type: 'EMAIL' }));
  });

  it('should handle special characters in surrounding text', () => {
    const text = '(email: john@test.com) [phone: +49 170 1234567]';
    const matches = detectPII(text);

    expect(matches.filter((m) => m.type === 'EMAIL')).toHaveLength(1);
    expect(matches.filter((m) => m.type === 'PHONE')).toHaveLength(1);
  });

  it('should handle unicode characters', () => {
    const text = 'Müller: müller@firma.de Telefon: +49 170 1234567';
    const matches = detectPII(text);

    expect(matches.filter((m) => m.type === 'EMAIL')).toHaveLength(1);
  });

  it('should not detect invalid emails', () => {
    const text = 'Not an email: @test.com or test@ or test@.com';
    const matches = detectPII(text);

    expect(matches.filter((m) => m.type === 'EMAIL')).toHaveLength(0);
  });

  it('should not detect invalid IBANs', () => {
    const text = 'Not IBAN: DE12 or DEAABBCCDD';
    const matches = detectPII(text);

    expect(matches.filter((m) => m.type === 'IBAN')).toHaveLength(0);
  });

  it('should preserve text structure when anonymizing', () => {
    const text = 'Line 1: john@test.com\nLine 2: +49 170 1234567';
    const result = anonymize(text, { strategy: 'redact' });

    expect(result.anonymizedText).toContain('\n');
    expect(result.anonymizedText.split('\n')).toHaveLength(2);
  });
});
