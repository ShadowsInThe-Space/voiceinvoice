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
 * Anonymizes text by replacing sensitive entities with tokens.
 *
 * This is a placeholder implementation that will be fully
 * developed in Subagent #5 with:
 * - Fuzzy customer name matching
 * - Phonetic matching for voice recognition errors
 * - Configurable entity types (names, amounts, dates)
 * - Token generation and management
 *
 * @param text - The text to anonymize
 * @param knownEntities - Known entities to look for
 * @returns The anonymized text and token map
 *
 * @example
 * const result = anonymize(
 *   'Send invoice to Müller GmbH for 1000 EUR',
 *   ['Müller GmbH']
 * );
 * // result.anonymizedText: 'Send invoice to [CUSTOMER_1] for [AMOUNT_1]'
 * // result.tokenMap: { 'CUSTOMER_1': 'Müller GmbH', 'AMOUNT_1': '1000 EUR' }
 */
export function anonymize(text: string, knownEntities?: string[]): AnonymizationResult {
  const anonymizer = new Anonymizer(text, knownEntities);
  return anonymizer.process();
}

/**
 * Restores original values from anonymized text.
 *
 * Uses the token map from a previous anonymization to
 * replace tokens with their original values.
 *
 * @param {string} anonymizedText - Text containing tokens
 * @param {TokenMap} tokenMap - Mapping of tokens to original values
 * @returns {string} Text with original values restored
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
  // Sort tokens by length (descending) to avoid partial replacements if tokens share prefixes (unlikely with our scheme)
  const tokens = Object.keys(tokenMap).sort((a, b) => b.length - a.length);

  for (const token of tokens) {
    const value = tokenMap[token];
    // Global replacement of the token
    result = result.replace(new RegExp(`\\[${token}\\]`, 'g'), value);
  }
  return result;
}

/**
 * Privacy Engine version for compatibility checking.
 */
export const PRIVACY_ENGINE_VERSION = '0.1.0';
