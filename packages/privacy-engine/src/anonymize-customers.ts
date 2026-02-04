/**
 * Customer Name Anonymization using Fuzzy Matching.
 *
 * @module @voiceinvoice/privacy-engine/anonymize-customers
 */

import { ClientPrivacyLayer } from './dual-layer-privacy';
import type { AnonymizationResult, TokenMap } from './index';

/**
 * Anonymizes text by replacing known customer entities with tokens.
 *
 * Uses fuzzy matching (Levenshtein distance with 20% threshold) to identify
 * known entities (customers) in the text and replaces them with reversible tokens.
 * This is useful for GDPR compliance when sending transcriptions to
 * external AI services.
 *
 * NOTE: This function is separate from the PII-based `anonymize()` function
 * which handles emails, phones, IBANs, etc. Use `anonymizeCustomers()` when
 * you have a list of known customer names to mask.
 *
 * @param text - The text to anonymize
 * @param knownEntities - Known customer names to look for (null-safe)
 * @returns The anonymized text and token map for de-anonymization
 *
 * @example
 * const result = anonymizeCustomers('Invoice for Acme Corp', ['Acme Corp']);
 * // result.anonymizedText: 'Invoice for [CUSTOMER_xyz123]'
 * // result.tokenMap: { 'CUSTOMER_xyz123': 'Acme Corp' }
 *
 * @example
 * // Fuzzy matching handles typos
 * const result = anonymizeCustomers('Invoice for Acme Copr', ['Acme Corp']);
 * // result.anonymizedText: 'Invoice for [CUSTOMER_xyz123]'
 *
 * @example
 * // Null-safe - handles null, undefined, or empty arrays
 * const result = anonymizeCustomers('Invoice text', null);
 * // result.anonymizedText: 'Invoice text'
 * // result.entityCount: 0
 */
export function anonymizeCustomers(
  text: string,
  knownEntities?: string[] | null
): AnonymizationResult {
  // Null-safety: Handle null, undefined, or empty arrays
  if (!knownEntities || !Array.isArray(knownEntities) || knownEntities.length === 0 || !text) {
    return {
      anonymizedText: text || '',
      tokenMap: {},
      entityCount: 0,
    };
  }

  // Filter out null/undefined/empty entities (minimum 3 chars for meaningful matching)
  const validEntities = knownEntities.filter(
    (e): e is string => typeof e === 'string' && e.length >= 3
  );

  if (validEntities.length === 0) {
    return {
      anonymizedText: text,
      tokenMap: {},
      entityCount: 0,
    };
  }

  // Use ClientPrivacyLayer for fuzzy matching with 20% threshold (0.8 similarity)
  const clientLayer = new ClientPrivacyLayer({
    fuzzyThreshold: 0.8, // 80% similarity = 20% difference threshold
    usePhoneticMatching: true, // Also enable phonetic matching for German names
  });

  clientLayer.addCustomerNames(validEntities);
  const result = clientLayer.maskCustomerNames(text);

  // Convert ClientPrivacyLayer result to AnonymizationResult format
  const tokenMap: TokenMap = {};
  for (const match of result.matches) {
    // Extract token key from placeholder: "[CUSTOMER_xyz]" -> "CUSTOMER_xyz"
    const tokenKey = match.placeholder.replace(/^\[|\]$/g, '');
    tokenMap[tokenKey] = match.original;
  }

  return {
    anonymizedText: result.maskedText,
    tokenMap,
    entityCount: result.matches.length,
  };
}
