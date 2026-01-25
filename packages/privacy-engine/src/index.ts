/**
 * Privacy Engine for VoiceInvoice Enterprise.
 *
 * Implements PII detection and anonymization strategies:
 * - Email addresses
 * - Phone numbers (German format: +49, 0xxx)
 * - IBAN numbers
 * - Tax IDs (Steuernummer, USt-IdNr)
 *
 * This module ensures GDPR compliance by processing all
 * personal data before transmission to external services.
 *
 * @module @voiceinvoice/privacy-engine
 */

// ============================================
// Types and Interfaces
// ============================================

/**
 * Supported PII pattern types for detection.
 */
export type PIIPattern = 'EMAIL' | 'PHONE' | 'IBAN' | 'TAX_ID' | 'VAT_ID';

/**
 * Anonymization strategy options.
 */
export type AnonymizeStrategy = 'mask' | 'redact' | 'hash';

/**
 * Token mapping for reversible anonymization.
 *
 * Maps anonymized tokens back to original values for
 * authorized de-anonymization.
 */
export interface TokenMap {
  /** Mapping of token to original value */
  [token: string]: string;
}

/**
 * Options for the anonymize function.
 */
export interface AnonymizeOptions {
  /** Strategy for anonymization: mask, redact, or hash */
  strategy?: AnonymizeStrategy;
  /** Specific PII patterns to detect (default: all) */
  patterns?: PIIPattern[];
}

/**
 * Result of PII detection.
 */
export interface PIIMatch {
  /** Type of PII detected */
  type: PIIPattern;
  /** The matched value */
  value: string;
  /** Start position in the text */
  start: number;
  /** End position in the text */
  end: number;
}

/**
 * Result of an anonymization operation.
 *
 * Contains the anonymized text and the token mapping
 * needed for later de-anonymization.
 */
export interface AnonymizationResult {
  /** Text with sensitive data replaced by tokens */
  anonymizedText: string;

  /** Mapping to restore original values */
  tokenMap: TokenMap;

  /** Number of entities anonymized */
  entityCount: number;
}

// Legacy alias for backward compatibility
export type AnonymizeResult = AnonymizationResult;

// ============================================
// PII Detection Patterns
// ============================================

/**
 * Priority order for pattern matching.
 * Higher priority patterns are matched first and prevent overlapping matches.
 */
const PATTERN_PRIORITY: PIIPattern[] = ['IBAN', 'EMAIL', 'PHONE', 'TAX_ID', 'VAT_ID'];

/**
 * Regular expression patterns for PII detection.
 */
const PII_PATTERNS: Record<PIIPattern, RegExp> = {
  // Email pattern - handles common formats including plus addressing
  EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

  // German phone patterns: +49 xxx xxxxxxx, 0xxx xxxxxxx, with various separators
  PHONE: /(?:\+49[\s./-]?\d{2,4}[\s./-]?\d{6,8}|0\d{2,4}[\s./-]?\d{6,8})/g,

  // IBAN pattern - European format (2 letters + 2 digits + 12-30 alphanumeric)
  // German IBANs are exactly 22 characters: DE + 2 check digits + 18 digits
  IBAN: /[A-Z]{2}\d{2}[\s]?(?:[A-Z0-9][\s]?){12,30}/g,

  // German Steuernummer format: xxx/xxx/xxxxx
  TAX_ID: /\d{2,3}\/\d{3}\/\d{4,5}/g,

  // EU VAT ID - starts with country code followed by exactly 9 digits (with optional spaces)
  // Must be followed by word boundary or end of string to avoid matching partial IBANs
  VAT_ID: /[A-Z]{2}[\s]?\d{3}[\s]?\d{3}[\s]?\d{3}(?=\s|$|[^0-9A-Z])/g,
};

// ============================================
// PII Detection
// ============================================

/**
 * Detects PII in the given text.
 *
 * Scans text for common PII patterns including emails,
 * phone numbers, IBANs, and tax IDs.
 *
 * @param text - The text to scan for PII
 * @param patterns - Optional list of patterns to detect (default: all)
 * @returns Array of detected PII matches with positions
 *
 * @example
 * const matches = detectPII('Contact: john@example.com');
 * // [{ type: 'EMAIL', value: 'john@example.com', start: 9, end: 25 }]
 */
export function detectPII(text: string, patterns?: PIIPattern[]): PIIMatch[] {
  if (!text) {
    return [];
  }

  // Use priority order and filter by requested patterns
  const patternsToUse = patterns
    ? PATTERN_PRIORITY.filter((p) => patterns.includes(p))
    : PATTERN_PRIORITY;

  const matches: PIIMatch[] = [];
  const coveredRanges: Array<{ start: number; end: number }> = [];

  for (const patternType of patternsToUse) {
    const regex = PII_PATTERNS[patternType];
    if (!regex) continue;

    // Create a new regex instance to avoid issues with lastIndex
    const pattern = new RegExp(regex.source, regex.flags);
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      // Clean up the matched value (remove trailing/leading spaces)
      const value = match[0].trim();
      const start = match.index + (match[0].length - match[0].trimStart().length);
      const end = start + value.length;

      // Check if this range overlaps with an already matched range
      const overlaps = coveredRanges.some((range) => start < range.end && end > range.start);

      // Validate the match based on type and check for overlaps
      if (!overlaps && isValidMatch(patternType, value)) {
        matches.push({
          type: patternType,
          value,
          start,
          end,
        });
        coveredRanges.push({ start, end });
      }
    }
  }

  // Sort matches by position
  return matches.sort((a, b) => a.start - b.start);
}

/**
 * Validates a PII match based on its type.
 * @param type - The type of PII pattern
 * @param value - The matched value to validate
 * @returns True if the match is valid for the given type
 */
function isValidMatch(type: PIIPattern, value: string): boolean {
  switch (type) {
    case 'EMAIL':
      // Basic email validation
      return /^[^@]+@[^@]+\.[^@]+$/.test(value) && !value.startsWith('@') && !value.endsWith('@');

    case 'IBAN': {
      // IBAN must be at least 15 characters (without spaces)
      const cleanIban = value.replace(/\s/g, '');
      return cleanIban.length >= 15 && /^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(cleanIban);
    }

    case 'PHONE': {
      // Phone must have at least 10 digits
      const digits = value.replace(/\D/g, '');
      return digits.length >= 10;
    }

    case 'TAX_ID':
    case 'VAT_ID':
      return true;

    default:
      return true;
  }
}

// ============================================
// Anonymization
// ============================================

/**
 * Generates a simple hash for a value.
 * Uses a basic hash function for demonstration purposes.
 * @param value - The string value to hash
 * @returns An 8-character uppercase alphanumeric hash
 */
function generateHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  // Convert to base36 and take first 8 characters
  const hashStr = Math.abs(hash).toString(36).toUpperCase();
  return hashStr.padStart(8, '0').slice(0, 8);
}

/**
 * Masks a value according to its PII type.
 * @param type - The type of PII being masked
 * @param value - The value to mask
 * @returns The masked value with sensitive parts replaced by asterisks
 */
function maskValue(type: PIIPattern, value: string): string {
  switch (type) {
    case 'EMAIL': {
      const [local, domain] = value.split('@');
      const domainParts = domain.split('.');
      const tld = domainParts.pop() || '';
      const maskedLocal = local[0] + '***';
      const maskedDomain = domainParts[0]?.[0] + '***';
      return `${maskedLocal}@${maskedDomain}.${tld}`;
    }

    case 'PHONE': {
      // Keep country code/prefix, mask the rest
      const prefix = value.match(/^(\+49|0\d{2,4})/)?.[0] || '';
      const rest = value.slice(prefix.length);
      return prefix + rest.replace(/\d/g, '*').slice(0, -3) + '***';
    }

    case 'IBAN': {
      // Keep first 4 characters (country code + check digits), mask the rest
      const clean = value.replace(/\s/g, '');
      return clean.slice(0, 4) + '***' + clean.slice(-4);
    }

    case 'VAT_ID':
    case 'TAX_ID': {
      // Keep country code/prefix, mask the rest
      const countryCode = value.match(/^[A-Z]{2}/)?.[0] || value.slice(0, 3);
      return countryCode + '***' + value.slice(-3);
    }

    default:
      return '***';
  }
}

/**
 * Anonymizes text by replacing sensitive entities with tokens.
 *
 * Supports three strategies:
 * - mask: Replace with asterisks while keeping some identifying parts
 * - redact: Replace entirely with type labels
 * - hash: Replace with one-way hash tokens for reversible anonymization
 *
 * @param text - The text to anonymize
 * @param options - Anonymization options
 * @returns The anonymized text, token map, and entity count
 *
 * @example
 * const result = anonymize('Email: john@example.com', { strategy: 'redact' });
 * // result.anonymizedText: 'Email: [EMAIL_REDACTED]'
 *
 * @example
 * const result = anonymize('Email: john@example.com', { strategy: 'mask' });
 * // result.anonymizedText: 'Email: j***@e***.com'
 *
 * @example
 * const result = anonymize('Email: john@example.com', { strategy: 'hash' });
 * // result.anonymizedText: 'Email: [A1B2C3D4]'
 * // result.tokenMap: { 'A1B2C3D4': 'john@example.com' }
 */
export function anonymize(text: string, options?: AnonymizeOptions): AnonymizationResult {
  if (!text) {
    return {
      anonymizedText: '',
      tokenMap: {},
      entityCount: 0,
    };
  }

  const strategy = options?.strategy ?? 'redact';
  const patterns = options?.patterns;

  // Detect all PII in the text
  const matches = detectPII(text, patterns);

  if (matches.length === 0) {
    return {
      anonymizedText: text,
      tokenMap: {},
      entityCount: 0,
    };
  }

  const tokenMap: TokenMap = {};
  const typeCounters: Record<string, number> = {};
  const hashCache: Record<string, string> = {};

  // Track replacements to avoid position shifts affecting later replacements
  let result = text;
  let offset = 0;

  for (const match of matches) {
    const adjustedStart = match.start - offset;
    const adjustedEnd = match.end - offset;

    let replacement: string;

    switch (strategy) {
      case 'mask':
        replacement = maskValue(match.type, match.value);
        break;

      case 'redact': {
        // Track count per type for unique tokens
        typeCounters[match.type] = (typeCounters[match.type] || 0) + 1;
        const count = typeCounters[match.type];
        // Use _1, _2 etc only when there are multiple of same type
        const suffix = matches.filter((m) => m.type === match.type).length > 1 ? `_${count}` : '';
        replacement = `[${match.type}_REDACTED${suffix}]`;
        break;
      }

      case 'hash': {
        // Generate consistent hash for same values
        if (!hashCache[match.value]) {
          hashCache[match.value] = generateHash(match.value);
        }
        const hash = hashCache[match.value];
        replacement = `[${hash}]`;
        tokenMap[hash] = match.value;
        break;
      }
    }

    // Perform the replacement
    result = result.slice(0, adjustedStart) + replacement + result.slice(adjustedEnd);

    // Update offset for position shifts
    offset += match.value.length - replacement.length;
  }

  return {
    anonymizedText: result,
    tokenMap,
    entityCount: matches.length,
  };
}

/**
 * Restores original values from anonymized text.
 *
 * Uses the token map from a previous anonymization to
 * replace tokens with their original values.
 *
 * @param anonymizedText - Text containing tokens
 * @param tokenMap - Mapping of tokens to original values
 * @returns Text with original values restored
 *
 * @example
 * const original = deanonymize(
 *   'Invoice for [CUSTOMER_1]',
 *   { 'CUSTOMER_1': 'Acme Corp' }
 * );
 * // Returns: 'Invoice for Acme Corp'
 */
export function deanonymize(anonymizedText: string, tokenMap: TokenMap): string {
  if (!anonymizedText || Object.keys(tokenMap).length === 0) {
    return anonymizedText;
  }

  let result = anonymizedText;
  for (const [token, value] of Object.entries(tokenMap)) {
    // Handle both [TOKEN] and TOKEN formats
    result = result.replace(new RegExp(`\\[${token}\\]`, 'g'), value);
  }
  return result;
}

/**
 * Privacy Engine version for compatibility checking.
 */
export const PRIVACY_ENGINE_VERSION = '0.1.0';

// ============================================
// Dual-Layer Privacy Exports
// ============================================

export {
  // Classes
  ServerPrivacyLayer,
  ClientPrivacyLayer,
  DualLayerPrivacy,
  PrivacyTokenManager,
  // Types
  type ChirpRedactionConfig,
  type FuzzyMatchConfig,
  type PrivacyToken,
  type ChirpRedaction,
  type ChirpTranscriptionResult,
  type ChirpClient,
  type ServerPrivacyLayerConfig,
  type ClientPrivacyLayerConfig,
  type ServerPrivacyResult,
  type CustomerMatch,
  type ClientPrivacyResult,
  type DualLayerResult,
  type TextProcessingResult,
  type DualLayerConfig,
} from './dual-layer-privacy';

// ============================================
// Chirp Client Exports
// ============================================

export { GoogleChirpClient, INVOICE_PHRASE_HINTS } from './chirp-client';
