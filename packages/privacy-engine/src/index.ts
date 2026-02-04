/**
 * Privacy Engine for VoiceInvoice Enterprise.
 *
 * Implements dual-layer anonymization strategy:
 * 1. Google Chirp 3 Redaction for sensitive audio content
 * 2. Client-side customer name masking with fuzzy matching
 *
 * This module ensures GDPR compliance by processing all
 * personal data before transmission to external services.
 *
 * @packageDocumentation
 * @module @voiceinvoice/privacy-engine
 */

import { Anonymizer } from './anonymizer';

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

/**
 * Anonymization options.
 */
export interface AnonymizeOptions {
  /** Anonymization strategy: 'mask' replaces with tokens, 'redact' removes completely */
  strategy?: 'mask' | 'redact';
}

/**
 * Anonymizes text by replacing sensitive entities with tokens.
 *
 * Supports two calling conventions:
 * 1. `anonymize(text, knownEntities)` - Anonymize with known customer names for fuzzy matching
 * 2. `anonymize(text, options)` - Anonymize with options (PII detection only)
 *
 * The function detects and masks:
 * - Known customer names (with fuzzy matching using Fuse.js)
 * - Email addresses
 * - Phone numbers (German format)
 * - IBANs
 * - Monetary amounts
 *
 * @param text - The text to anonymize
 * @param entitiesOrOptions - Known entities array or anonymization options
 * @returns The anonymized text and token map
 *
 * @example
 * // With known entities for customer name matching
 * const result = anonymize(
 *   'Send invoice to Müller GmbH for 1000 EUR',
 *   ['Müller GmbH']
 * );
 * // result.anonymizedText: 'Send invoice to [CUSTOMER_1] for [AMOUNT_1]'
 *
 * @example
 * // With options for PII-only detection
 * const result = anonymize(
 *   'Contact test@example.com regarding invoice',
 *   { strategy: 'redact' }
 * );
 * // result.anonymizedText: 'Contact [EMAIL_1] regarding invoice'
 */
export function anonymize(
  text: string,
  entitiesOrOptions?: string[] | AnonymizeOptions
): AnonymizationResult {
  // Determine if second argument is an array of entities or options
  let knownEntities: string[] = [];

  if (Array.isArray(entitiesOrOptions)) {
    // Filter out null/undefined values for null-safety (review feedback)
    knownEntities = entitiesOrOptions.filter((e): e is string => e != null && e.length >= 3);
  }
  // If it's an options object, we just use empty entities (PII detection only)

  const anonymizer = new Anonymizer(text, knownEntities);
  return anonymizer.process();
}

/**
 * Anonymizes customer names in text using fuzzy matching.
 *
 * This is a specialized function for anonymizing customer names only,
 * without the full PII detection. Use this when you want to protect
 * customer names but preserve other data.
 *
 * Uses Levenshtein distance with 20% threshold (review feedback: stricter matching).
 *
 * @param text - The text to anonymize
 * @param customerNames - Known customer names to look for
 * @returns The anonymized text and token map
 *
 * @example
 * const result = anonymizeCustomers(
 *   'Invoice for Müller GmbH',
 *   ['Müller GmbH']
 * );
 * // result.anonymizedText: 'Invoice for [CUSTOMER_1]'
 */
export function anonymizeCustomers(text: string, customerNames?: string[]): AnonymizationResult {
  if (!customerNames || customerNames.length === 0 || !text) {
    return {
      anonymizedText: text,
      tokenMap: {},
      entityCount: 0,
    };
  }

  // Filter null/undefined customer names (review feedback: null-safety)
  const validNames = customerNames.filter((n): n is string => n != null && n.length >= 3);

  if (validNames.length === 0) {
    return {
      anonymizedText: text,
      tokenMap: {},
      entityCount: 0,
    };
  }

  let anonymizedText = text;
  const tokenMap: TokenMap = {};
  let entityCounter = 1;
  const THRESHOLD = 0.2; // Allow 20% difference (review feedback: stricter than 30%)

  interface MatchCandidate {
    start: number;
    end: number;
    entity: string;
    originalText: string;
    score: number;
  }

  const allCandidates: MatchCandidate[] = [];

  // Find all possible matches for all entities
  for (const entity of validNames) {
    const entityLen = entity.length;
    const minLen = Math.max(1, entityLen - 2);
    const maxLen = entityLen + 2;

    for (let i = 0; i < text.length; i++) {
      for (let len = minLen; len <= maxLen; len++) {
        if (i + len > text.length) continue;

        const window = text.substring(i, i + len);
        const dist = levenshteinDistance(window, entity);
        const maxLength = Math.max(window.length, entity.length);
        let score = dist / maxLength;

        // Penalty for partial word matches
        const charBefore = i > 0 ? text[i - 1] : ' ';
        const charAfter = i + len < text.length ? text[i + len] : ' ';
        const isWordStart = !/[\w\d]/.test(charBefore);
        const isWordEnd = !/[\w\d]/.test(charAfter);

        if (!isWordStart || !isWordEnd) {
          score += 0.2;
        }

        if (score <= THRESHOLD) {
          allCandidates.push({
            start: i,
            end: i + len,
            entity,
            originalText: window,
            score,
          });
        }
      }
    }
  }

  // Sort candidates by score (lower is better), then by entity length (longer is better)
  allCandidates.sort((a, b) => {
    if (Math.abs(a.score - b.score) > 0.001) return a.score - b.score;
    if (a.entity.length !== b.entity.length) return b.entity.length - a.entity.length;
    return a.start - b.start;
  });

  // Select non-overlapping matches
  const selectedMatches: MatchCandidate[] = [];
  for (const candidate of allCandidates) {
    const overlaps = selectedMatches.some(
      (m) =>
        (candidate.start >= m.start && candidate.start < m.end) ||
        (candidate.end > m.start && candidate.end <= m.end) ||
        (candidate.start <= m.start && candidate.end >= m.end)
    );
    if (!overlaps) {
      selectedMatches.push(candidate);
    }
  }

  // Apply replacements from end to start
  selectedMatches.sort((a, b) => b.start - a.start);

  for (const match of selectedMatches) {
    const token = `CUSTOMER_${entityCounter++}`;
    tokenMap[token] = match.entity;
    const before = anonymizedText.substring(0, match.start);
    const after = anonymizedText.substring(match.end);
    anonymizedText = `${before}[${token}]${after}`;
  }

  return {
    anonymizedText,
    tokenMap,
    entityCount: selectedMatches.length,
  };
}

/**
 * Calculates Levenshtein distance between two strings.
 * Used for fuzzy matching in anonymizeCustomers.
 * @param a
 * @param b
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1).toLowerCase() === a.charAt(j - 1).toLowerCase()) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
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
  let result = anonymizedText;
  // Sort tokens by length (descending) to avoid partial replacements
  const tokens = Object.keys(tokenMap).sort((a, b) => b.length - a.length);

  for (const token of tokens) {
    const value = tokenMap[token];
    result = result.replace(new RegExp(`\\[${token}\\]`, 'g'), value);
  }
  return result;
}

/**
 * Privacy Engine version for compatibility checking.
 */
export const PRIVACY_ENGINE_VERSION = '0.1.0';
