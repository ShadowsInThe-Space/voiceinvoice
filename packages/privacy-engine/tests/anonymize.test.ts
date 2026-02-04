import { describe, it, expect } from 'vitest';
import { anonymize, deanonymize, detectPII, type TokenMap, type PIIPattern } from '../src/index';

// ============================================
// PII Detection Tests (Restored)
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
  // --- Legacy PII Tests ---
  describe('PII Masking Strategy', () => {
    it('should mask email addresses', () => {
      const text = 'Contact: john@example.com';
      const result = anonymize(text, { strategy: 'mask' });

      expect(result.anonymizedText).toMatch(/j\*+@e\*+\.com/);
      expect(result.anonymizedText).not.toContain('john@example.com');
    });

    it('should redact email addresses by default', () => {
      const text = 'Contact: john@example.com';
      const result = anonymize(text); // Default strategy: redact

      expect(result.anonymizedText).toBe('Contact: [EMAIL_REDACTED]');
      expect(result.tokenMap['EMAIL_REDACTED']).toBe('john@example.com');
    });

    it('should redact phone numbers', () => {
      const text = 'Call +49 170 1234567';
      const result = anonymize(text, { strategy: 'redact' });

      expect(result.anonymizedText).toBe('Call [PHONE_REDACTED]');
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

  // --- Entity Matching Tests (New) ---
  describe('Entity Matching', () => {
    it('should mask exact matches of known entities', () => {
      const text = 'Invoice for Acme Corp';
      const result = anonymize(text, ['Acme Corp']);

      expect(result.anonymizedText).toContain('[CUSTOMER_');
      expect(result.entityCount).toBe(1);
      // Check if map contains the value
      const values = Object.values(result.tokenMap);
      expect(values).toContain('Acme Corp');
    });

    it('should mask fuzzy matches of known entities', () => {
      const text = 'Invoice for Acme Copr please'; // Typo: Copr
      const result = anonymize(text, ['Acme Corp']);

      expect(result.anonymizedText).toContain('[CUSTOMER_');
      expect(result.entityCount).toBe(1);
      const values = Object.values(result.tokenMap);
      // We expect the ORIGINAL text to be preserved in the token map for restoration
      expect(values).toContain('Acme Copr');
    });

    it('should prioritize longer matches', () => {
      // "Super Corp International" vs "Super Corp"
      const text = 'Invoice for Super Corp International today';
      const result = anonymize(text, ['Super Corp', 'Super Corp International']);

      expect(result.entityCount).toBe(1); // Should match the longer one
      const values = Object.values(result.tokenMap);
      expect(values).toContain('Super Corp International');
    });
  });

  // --- Combined Tests (Dual Layer) ---
  describe('Dual Layer Anonymization', () => {
    it('should mask both PII and known entities', () => {
      const text = 'Email john@example.com at Acme Corp';
      const result = anonymize(text, ['Acme Corp']);

      expect(result.anonymizedText).toContain('[EMAIL_REDACTED]');
      expect(result.anonymizedText).toContain('[CUSTOMER_');
      expect(result.entityCount).toBe(2); // 1 PII + 1 Entity
    });

    it('should handle PII inside entity names? (Edge Case)', () => {
        // If an entity name looks like PII or contains it.
        // e.g. Customer name "john@example.com Ltd"
        // This is tricky. PII runs first.
        // "Contact john@example.com Ltd" -> "Contact [EMAIL_REDACTED] Ltd"
        // Then ClientLayer runs on "Contact [EMAIL_REDACTED] Ltd".
        // If "john@example.com Ltd" is in knownEntities, it won't match "[EMAIL_REDACTED] Ltd".
        // This is a limitation of sequential layers, but PII protection takes precedence.
        const text = 'Contact john@example.com';
        const result = anonymize(text, ['john@example.com']);

        // PII masking happens first
        expect(result.anonymizedText).toBe('Contact [EMAIL_REDACTED]');
        // Entity count might be 1 (PII)
        expect(result.entityCount).toBe(1);
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

  it('should handle PII tokens', () => {
    const text = 'Email [EMAIL_REDACTED]';
    const tokenMap = { 'EMAIL_REDACTED': 'john@test.com' };
    const result = deanonymize(text, tokenMap);
    expect(result).toBe('Email john@test.com');
  });

  it('should handle mixed tokens', () => {
     const text = 'Email [EMAIL_REDACTED] at [CUSTOMER_1]';
     const tokenMap = {
         'EMAIL_REDACTED': 'john@test.com',
         'CUSTOMER_1': 'Acme Corp'
     };
     const result = deanonymize(text, tokenMap);
     expect(result).toBe('Email john@test.com at Acme Corp');
  });
});
