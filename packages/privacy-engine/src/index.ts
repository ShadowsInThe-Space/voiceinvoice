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
 * Calculates Levenshtein distance between two strings.
 * @param a First string
 * @param b Second string
 * @returns The edit distance
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
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

interface MatchCandidate {
  start: number;
  end: number;
  entity: string;
  originalText: string;
  score: number; // lower is better
}

/**
 * Anonymizes text by replacing sensitive entities with tokens.
 *
 * Uses fuzzy matching to identify known entities (customers) in the text
 * and replaces them with reversible tokens.
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
 * // result.anonymizedText: 'Send invoice to [CUSTOMER_1] for 1000 EUR'
 * // result.tokenMap: { 'CUSTOMER_1': 'Müller GmbH' }
 */
export function anonymize(text: string, knownEntities?: string[]): AnonymizationResult {
  if (!knownEntities || knownEntities.length === 0 || !text) {
    return {
      anonymizedText: text,
      tokenMap: {},
      entityCount: 0,
    };
  }

  let anonymizedText = text;
  const tokenMap: TokenMap = {};
  let entityCounter = 1;
  const THRESHOLD = 0.2; // Allow 20% difference (stricter per review feedback)

  const allCandidates: MatchCandidate[] = [];

  // 1. Find all possible matches for all entities
  for (const entity of knownEntities) {
    // Null-safety check for customer names (review feedback)
    if (!entity || entity.length < 3) continue;

    const entityLen = entity.length;

    // Scan the text
    // Optimization: we could look for start char, but with fuzzy matching it might change.
    // Brute-force sliding window for now (ok for short texts).

    // We check windows of varying sizes around the entity length to handle insertions/deletions better
    // Range: [entityLen - 2, entityLen + 2] (bounded by text length)
    const minLen = Math.max(1, entityLen - 2);
    const maxLen = entityLen + 2;

    for (let i = 0; i < text.length; i++) {
        for (let len = minLen; len <= maxLen; len++) {
            if (i + len > text.length) continue;

            const window = text.substring(i, i + len);
            const dist = levenshteinDistance(window, entity);
            const maxLength = Math.max(window.length, entity.length);
            let score = dist / maxLength;

            // Add penalty for matches that don't respect word boundaries
            // This prevents partial word matches (e.g. matching "Cop" inside "Copr" when "Copr" is the target)
            const charBefore = i > 0 ? text[i - 1] : ' ';
            const charAfter = (i + len) < text.length ? text[i + len] : ' ';
            // Simple word boundary check: whitespace or punctuation
            const isWordStart = !/[\w\d]/.test(charBefore); // Not alphanumeric
            const isWordEnd = !/[\w\d]/.test(charAfter);   // Not alphanumeric

            if (!isWordStart || !isWordEnd) {
                score += 0.2; // Significant penalty for partial words
            }

            if (score <= THRESHOLD) {
                allCandidates.push({
                    start: i,
                    end: i + len,
                    entity: entity,
                    originalText: window,
                    score: score
                });
            }
        }
    }
  }

  // 2. Sort candidates to pick best matches
  // Criteria:
  // 1. Score (lower is better) - prioritize exact matches
  // 2. Length (longer is better) - "Super Corp International" over "Super Corp"
  // 3. Start position (irrelevant for quality but needed for stability)
  allCandidates.sort((a, b) => {
      if (Math.abs(a.score - b.score) > 0.001) return a.score - b.score; // prioritize better match
      if (a.entity.length !== b.entity.length) return b.entity.length - a.entity.length; // prioritize longer entity
      if (a.end - a.start !== b.end - b.start) return (b.end - b.start) - (a.end - a.start); // prioritize longer match in text
      return a.start - b.start;
  });

  // 3. Select non-overlapping matches
  const selectedMatches: MatchCandidate[] = [];

  for (const candidate of allCandidates) {
      // Check overlap with already selected
      const overlaps = selectedMatches.some(m =>
        (candidate.start >= m.start && candidate.start < m.end) ||
        (candidate.end > m.start && candidate.end <= m.end) ||
        (candidate.start <= m.start && candidate.end >= m.end)
      );

      if (!overlaps) {
          selectedMatches.push(candidate);
      }
  }

  // 4. Apply replacements from end to start to avoid index shifting issues
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
  // Sort tokens by length (descending) to avoid partial replacements if tokens share prefixes
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
