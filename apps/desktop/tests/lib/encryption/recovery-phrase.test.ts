/**
 * Recovery Phrase Tests
 *
 * Tests for BIP39-style recovery phrase generation and validation.
 *
 * @module tests/lib/encryption/recovery-phrase
 */

import { describe, it, expect } from 'vitest';
import {
  generateRecoveryPhrase,
  validateRecoveryPhrase,
  formatRecoveryPhrase,
  parseRecoveryPhrase,
  isValidWord,
  getWordList,
} from '../../../src/lib/encryption/recovery-phrase';

describe('Recovery Phrase', () => {
  const validKey = new Uint8Array(32).fill(1); // Valid 32-byte key
  const differentKey = new Uint8Array(32).fill(2); // Different key

  describe('generateRecoveryPhrase', () => {
    it('should generate 12 words from a valid key', () => {
      const phrase = generateRecoveryPhrase(validKey);

      expect(phrase).toHaveLength(12);
      expect(phrase.every((word) => typeof word === 'string')).toBe(true);
      expect(phrase.every((word) => word.length > 0)).toBe(true);
    });

    it('should generate deterministic phrases (same key = same phrase)', () => {
      const phrase1 = generateRecoveryPhrase(validKey);
      const phrase2 = generateRecoveryPhrase(validKey);

      expect(phrase1).toEqual(phrase2);
    });

    it('should generate different phrases for different keys', () => {
      const phrase1 = generateRecoveryPhrase(validKey);
      const phrase2 = generateRecoveryPhrase(differentKey);

      expect(phrase1).not.toEqual(phrase2);
    });

    it('should throw for invalid key length', () => {
      const shortKey = new Uint8Array(16);

      expect(() => generateRecoveryPhrase(shortKey)).toThrow('Invalid key');
    });

    it('should throw for null key', () => {
      expect(() => generateRecoveryPhrase(null as unknown as Uint8Array)).toThrow('Invalid key');
    });

    it('should generate words from the word list', () => {
      const phrase = generateRecoveryPhrase(validKey);
      const wordList = getWordList();

      expect(phrase.every((word) => wordList.includes(word))).toBe(true);
    });
  });

  describe('validateRecoveryPhrase', () => {
    it('should validate a correct phrase array', () => {
      const phrase = generateRecoveryPhrase(validKey);

      expect(validateRecoveryPhrase(phrase)).toBe(true);
    });

    it('should validate a correct phrase string', () => {
      const phrase = generateRecoveryPhrase(validKey);
      const phraseString = phrase.join(' ');

      expect(validateRecoveryPhrase(phraseString)).toBe(true);
    });

    it('should reject phrase with wrong word count', () => {
      expect(validateRecoveryPhrase(['apfel', 'berg'])).toBe(false);
      expect(validateRecoveryPhrase('apfel berg')).toBe(false);
    });

    it('should reject phrase with invalid words', () => {
      const invalidPhrase = [
        'apfel',
        'berg',
        'invalid',
        'dame',
        'echo',
        'fahrt',
        'gabel',
        'haus',
        'igel',
        'jacke',
        'kabel',
        'lachen',
      ];

      expect(validateRecoveryPhrase(invalidPhrase)).toBe(false);
    });

    it('should be case-insensitive', () => {
      const phrase = generateRecoveryPhrase(validKey);
      const upperPhrase = phrase.map((w) => w.toUpperCase());

      expect(validateRecoveryPhrase(upperPhrase)).toBe(true);
    });
  });

  describe('formatRecoveryPhrase', () => {
    it('should format phrase with numbered lines', () => {
      const phrase = [
        'apfel',
        'berg',
        'chaos',
        'dame',
        'echo',
        'fahrt',
        'gabel',
        'haus',
        'igel',
        'jacke',
        'kabel',
        'lachen',
      ];
      const formatted = formatRecoveryPhrase(phrase);

      expect(formatted).toContain(' 1. apfel');
      expect(formatted).toContain('12. lachen');
      expect(formatted.split('\n')).toHaveLength(12);
    });
  });

  describe('parseRecoveryPhrase', () => {
    it('should parse space-separated words', () => {
      const input = 'apfel berg chaos dame echo fahrt gabel haus igel jacke kabel lachen';
      const parsed = parseRecoveryPhrase(input);

      expect(parsed).toHaveLength(12);
      expect(parsed[0]).toBe('apfel');
      expect(parsed[11]).toBe('lachen');
    });

    it('should parse numbered list', () => {
      const input =
        '1. apfel 2. berg 3. chaos 4. dame 5. echo 6. fahrt 7. gabel 8. haus 9. igel 10. jacke 11. kabel 12. lachen';
      const parsed = parseRecoveryPhrase(input);

      expect(parsed).toHaveLength(12);
      expect(parsed[0]).toBe('apfel');
    });

    it('should handle extra whitespace', () => {
      const input = '  apfel   berg  chaos  ';
      const parsed = parseRecoveryPhrase(input);

      expect(parsed).toHaveLength(3);
      expect(parsed[0]).toBe('apfel');
    });

    it('should convert to lowercase', () => {
      const input = 'APFEL Berg CHAOS';
      const parsed = parseRecoveryPhrase(input);

      expect(parsed).toEqual(['apfel', 'berg', 'chaos']);
    });

    it('should handle comma-separated input', () => {
      const input = 'apfel, berg, chaos';
      const parsed = parseRecoveryPhrase(input);

      expect(parsed).toEqual(['apfel', 'berg', 'chaos']);
    });
  });

  describe('isValidWord', () => {
    it('should return true for valid words', () => {
      expect(isValidWord('apfel')).toBe(true);
      expect(isValidWord('berg')).toBe(true);
      expect(isValidWord('haus')).toBe(true);
    });

    it('should return false for invalid words', () => {
      expect(isValidWord('invalid')).toBe(false);
      expect(isValidWord('xyz123')).toBe(false);
      expect(isValidWord('')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isValidWord('APFEL')).toBe(true);
      expect(isValidWord('Berg')).toBe(true);
    });
  });

  describe('getWordList', () => {
    it('should return a frozen array', () => {
      const wordList = getWordList();

      expect(Array.isArray(wordList)).toBe(true);
      expect(Object.isFrozen(wordList)).toBe(true);
    });

    it('should contain expected words', () => {
      const wordList = getWordList();

      expect(wordList).toContain('apfel');
      expect(wordList).toContain('berg');
      expect(wordList).toContain('haus');
    });

    it('should not be modifiable', () => {
      const wordList = getWordList();

      expect(() => {
        (wordList as string[]).push('test');
      }).toThrow();
    });
  });
});
