/**
 * Dual-Layer Privacy Integration for VoiceInvoice Enterprise.
 *
 * Implements a two-layer privacy protection system:
 * - Layer 1 (Server): Chirp 3 API automatic PII redaction during transcription
 * - Layer 2 (Client): Fuzzy and phonetic customer name matching
 *
 * This dual approach ensures comprehensive privacy protection while
 * maintaining data usability for invoice processing.
 *
 * @module @voiceinvoice/privacy-engine/dual-layer
 */

// ============================================
// Types and Interfaces
// ============================================

/**
 * Chirp 3 API redaction configuration.
 *
 * Controls which types of PII are automatically redacted
 * during audio transcription.
 */
export interface ChirpRedactionConfig {
  /** Redact person names from transcription */
  redactNames?: boolean;
  /** Redact street addresses from transcription */
  redactAddresses?: boolean;
  /** Redact phone numbers from transcription */
  redactPhoneNumbers?: boolean;
  /** Redact email addresses from transcription */
  redactEmails?: boolean;
}

/**
 * Fuzzy matching configuration for customer names.
 *
 * Controls the sensitivity of customer name detection
 * in the client privacy layer.
 */
export interface FuzzyMatchConfig {
  /** Minimum similarity score (0-1) for fuzzy matching */
  fuzzyThreshold: number;
  /** Enable phonetic matching (Soundex/Cologne phonetics) */
  usePhoneticMatching: boolean;
}

/**
 * Represents a privacy token for reversible anonymization.
 *
 * Tokens allow sensitive data to be replaced with placeholders
 * that can later be restored to original values.
 */
export interface PrivacyToken {
  /** Unique token identifier */
  id: string;
  /** Token type (e.g., 'CUSTOMER', 'PERSON_NAME') */
  type: string;
  /** Placeholder text used in anonymized output */
  placeholder: string;
}

/**
 * Internal token data with original value.
 */
interface TokenData extends PrivacyToken {
  /** Original value before anonymization */
  original: string;
}

/**
 * Redaction information from Chirp API.
 */
export interface ChirpRedaction {
  /** Type of redacted content */
  type: string;
  /** Original text that was redacted */
  original: string;
  /** Start position in text */
  start: number;
  /** End position in text */
  end: number;
}

/**
 * Result from Chirp API transcription.
 */
export interface ChirpTranscriptionResult {
  /** Transcribed text with redactions applied */
  text: string;
  /** List of redactions performed */
  redactions: ChirpRedaction[];
}

/**
 * Chirp client interface for dependency injection.
 */
export interface ChirpClient {
  /**
   * Transcribes audio with automatic PII redaction.
   *
   * @param audio - Audio buffer to transcribe
   * @param languageCode - Language code (e.g., 'de-DE')
   * @param config - Redaction configuration
   * @returns Transcription result with redactions
   */
  transcribeWithRedaction(
    audio: Buffer,
    languageCode: string,
    config: ChirpRedactionConfig
  ): Promise<ChirpTranscriptionResult>;
}

/**
 * Server privacy layer configuration.
 */
export interface ServerPrivacyLayerConfig {
  /** Chirp API client for transcription */
  chirpClient?: ChirpClient;
  /** Use mock mode for testing */
  useMock?: boolean;
  /** Redaction configuration */
  redactionConfig: ChirpRedactionConfig;
}

/**
 * Client privacy layer configuration.
 */
export interface ClientPrivacyLayerConfig {
  /** Minimum similarity threshold for fuzzy matching */
  fuzzyThreshold: number;
  /** Enable phonetic matching */
  usePhoneticMatching: boolean;
}

/**
 * Result from server privacy layer processing.
 */
export interface ServerPrivacyResult {
  /** Anonymized transcription text */
  anonymizedText: string;
  /** List of redactions performed */
  redactions: ChirpRedaction[];
}

/**
 * Customer name match result.
 */
export interface CustomerMatch {
  /** Original customer name found */
  original: string;
  /** Token placeholder used */
  placeholder: string;
  /** Similarity score (0-1) */
  similarity: number;
  /** Type of match: 'exact', 'fuzzy', or 'phonetic' */
  matchType: 'exact' | 'fuzzy' | 'phonetic';
  /** Start position in text */
  start: number;
  /** End position in text */
  end: number;
}

/**
 * Result from client privacy layer processing.
 */
export interface ClientPrivacyResult {
  /** Text with customer names masked */
  maskedText: string;
  /** List of customer matches found */
  matches: CustomerMatch[];
}

/**
 * Combined result from dual layer processing.
 */
export interface DualLayerResult {
  /** Result from server layer */
  serverResult: ServerPrivacyResult;
  /** Result from client layer */
  clientResult: ClientPrivacyResult;
  /** Final processed text */
  finalText: string;
  /** Order of processing */
  processingOrder: ('server' | 'client')[];
  /** Token manager for de-anonymization */
  tokenManager: PrivacyTokenManager;
}

/**
 * Text processing result.
 */
export interface TextProcessingResult {
  /** Masked text output */
  maskedText: string;
  /** Token manager for de-anonymization */
  tokenManager: PrivacyTokenManager;
  /** Customer matches found */
  matches: CustomerMatch[];
}

/**
 * Dual layer privacy configuration.
 */
export interface DualLayerConfig {
  /** Server layer configuration */
  serverConfig: ServerPrivacyLayerConfig;
  /** Client layer configuration */
  clientConfig: ClientPrivacyLayerConfig;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Generates a unique token ID.
 *
 * @returns A unique identifier string
 */
function generateTokenId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = 'tok_';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/**
 * Calculates Levenshtein distance between two strings.
 *
 * @param a - First string
 * @param b - Second string
 * @returns Edit distance between strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
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
 * Calculates similarity score between two strings.
 *
 * @param a - First string
 * @param b - Second string
 * @returns Similarity score between 0 and 1
 */
function calculateSimilarity(a: string, b: string): number {
  const normalizedA = a.toLowerCase().trim();
  const normalizedB = b.toLowerCase().trim();

  if (normalizedA === normalizedB) return 1;

  const distance = levenshteinDistance(normalizedA, normalizedB);
  const maxLength = Math.max(normalizedA.length, normalizedB.length);

  return 1 - distance / maxLength;
}

/**
 * Converts a string to Cologne phonetic code.
 *
 * The Cologne phonetic algorithm is optimized for German names.
 *
 * @param input - String to convert
 * @returns Phonetic code
 */
function colognePhonetic(input: string): string {
  const str = input.toLowerCase().replace(/[^a-zaeiouu]/g, '');

  const charMap: Record<string, string> = {
    a: '0',
    e: '0',
    i: '0',
    o: '0',
    u: '0',
    h: '',
    b: '1',
    p: '1',
    d: '2',
    t: '2',
    f: '3',
    v: '3',
    w: '3',
    g: '4',
    k: '4',
    q: '4',
    l: '5',
    m: '6',
    n: '6',
    r: '7',
    s: '8',
    z: '8',
    c: '4',
    x: '48',
    j: '0',
    y: '0',
  };

  let result = '';
  for (const char of str) {
    const code = charMap[char] || '';
    if (code && code !== result[result.length - 1]) {
      result += code;
    }
  }

  // Remove leading zeros except if result is only zeros
  result = result.replace(/^0+/, '') || '0';

  return result;
}

/**
 * Checks if two strings match phonetically.
 *
 * @param a - First string
 * @param b - Second string
 * @returns True if phonetically similar
 */
function phoneticMatch(a: string, b: string): boolean {
  const codeA = colognePhonetic(a);
  const codeB = colognePhonetic(b);

  // Exact phonetic match or one is prefix of other
  return codeA === codeB || codeA.startsWith(codeB) || codeB.startsWith(codeA);
}

// ============================================
// Privacy Token Manager
// ============================================

/**
 * Manages privacy tokens for reversible anonymization.
 *
 * Tokens allow sensitive data to be replaced with placeholders
 * during processing and restored later for authorized users.
 *
 * @example
 * ```typescript
 * const manager = new PrivacyTokenManager();
 * const token = manager.createToken('CUSTOMER', 'Acme Corp');
 *
 * const anonymized = `Invoice for ${token.placeholder}`;
 * // "Invoice for [CUSTOMER_abc123]"
 *
 * const restored = manager.deanonymize(anonymized);
 * // "Invoice for Acme Corp"
 * ```
 */
export class PrivacyTokenManager {
  private tokens: Map<string, TokenData> = new Map();
  private counter: number = 0;

  /**
   * Creates a new privacy token.
   *
   * @param type - Token type (e.g., 'CUSTOMER', 'PERSON_NAME')
   * @param original - Original value to anonymize
   * @returns Created token with placeholder
   *
   * @example
   * ```typescript
   * const token = manager.createToken('CUSTOMER', 'Acme Corp');
   * console.log(token.placeholder); // "[CUSTOMER_abc123]"
   * ```
   */
  createToken(type: string, original: string): PrivacyToken {
    this.counter++;
    const id = generateTokenId();
    const placeholder = `[${type}_${id.slice(4)}]`;

    const tokenData: TokenData = {
      id,
      type,
      placeholder,
      original,
    };

    this.tokens.set(id, tokenData);

    return {
      id,
      type,
      placeholder,
    };
  }

  /**
   * Retrieves the original value for a token.
   *
   * @param tokenId - Token identifier
   * @returns Original value or undefined if not found
   */
  getOriginalValue(tokenId: string): string | undefined {
    return this.tokens.get(tokenId)?.original;
  }

  /**
   * Restores original values in anonymized text.
   *
   * @param anonymizedText - Text containing token placeholders
   * @returns Text with original values restored
   *
   * @example
   * ```typescript
   * const restored = manager.deanonymize("Invoice for [CUSTOMER_abc123]");
   * // "Invoice for Acme Corp"
   * ```
   */
  deanonymize(anonymizedText: string): string {
    let result = anonymizedText;

    for (const [, tokenData] of this.tokens) {
      result = result.replace(
        new RegExp(escapeRegex(tokenData.placeholder), 'g'),
        tokenData.original
      );
    }

    return result;
  }

  /**
   * Exports the token map for storage.
   *
   * @returns Record mapping token IDs to token data
   */
  exportTokenMap(): Record<string, { type: string; original: string; placeholder: string }> {
    const exported: Record<string, { type: string; original: string; placeholder: string }> = {};

    for (const [id, tokenData] of this.tokens) {
      exported[id] = {
        type: tokenData.type,
        original: tokenData.original,
        placeholder: tokenData.placeholder,
      };
    }

    return exported;
  }

  /**
   * Imports a token map.
   *
   * @param tokenMap - Token map to import
   */
  importTokenMap(
    tokenMap: Record<string, { type: string; original: string; placeholder: string }>
  ): void {
    for (const [id, data] of Object.entries(tokenMap)) {
      this.tokens.set(id, {
        id,
        type: data.type,
        original: data.original,
        placeholder: data.placeholder,
      });
    }
  }

  /**
   * Clears all stored tokens.
   */
  clear(): void {
    this.tokens.clear();
    this.counter = 0;
  }
}

/**
 * Escapes special regex characters in a string.
 *
 * @param str - String to escape
 * @returns Escaped string safe for regex
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================
// Server Privacy Layer
// ============================================

/**
 * Server-side privacy layer using Chirp 3 API.
 *
 * Processes audio transcriptions with automatic PII redaction
 * before any text leaves the server.
 *
 * @example
 * ```typescript
 * const serverLayer = new ServerPrivacyLayer({
 *   chirpClient: myChirpClient,
 *   redactionConfig: { redactNames: true, redactAddresses: true },
 * });
 *
 * const result = await serverLayer.processAudioTranscription(audioBuffer, 'de-DE');
 * console.log(result.anonymizedText); // "[REDACTED_NAME] sent invoice..."
 * ```
 */
export class ServerPrivacyLayer {
  private chirpClient: ChirpClient | undefined;
  private useMock: boolean;
  private redactionConfig: ChirpRedactionConfig;

  /**
   * Creates a new server privacy layer.
   *
   * @param config - Layer configuration
   */
  constructor(config: ServerPrivacyLayerConfig) {
    this.chirpClient = config.chirpClient;
    this.useMock = config.useMock ?? false;
    this.redactionConfig = { ...config.redactionConfig };
  }

  /**
   * Processes audio transcription with PII redaction.
   *
   * @param audioBuffer - Audio data to transcribe
   * @param languageCode - Language code (e.g., 'de-DE')
   * @returns Anonymized transcription result
   * @throws Error if transcription fails
   */
  async processAudioTranscription(
    audioBuffer: Buffer,
    languageCode: string
  ): Promise<ServerPrivacyResult> {
    try {
      if (this.useMock) {
        return this.mockTranscription();
      }

      if (!this.chirpClient) {
        throw new Error('Chirp client not configured');
      }

      const result = await this.chirpClient.transcribeWithRedaction(
        audioBuffer,
        languageCode,
        this.redactionConfig
      );

      return {
        anonymizedText: result.text,
        redactions: result.redactions,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Server privacy layer failed: ${message}`);
    }
  }

  /**
   * Gets the current redaction configuration.
   *
   * @returns Current redaction config
   */
  getRedactionConfig(): ChirpRedactionConfig {
    return { ...this.redactionConfig };
  }

  /**
   * Updates the redaction configuration.
   *
   * @param updates - Configuration updates to apply
   */
  updateRedactionConfig(updates: Partial<ChirpRedactionConfig>): void {
    this.redactionConfig = { ...this.redactionConfig, ...updates };
  }

  /**
   * Provides mock transcription for testing.
   *
   * @returns Mock transcription result
   */
  private mockTranscription(): ServerPrivacyResult {
    return {
      anonymizedText: 'Mock transcription with [REDACTED_NAME] for testing',
      redactions: [
        {
          type: 'PERSON_NAME',
          original: 'Test Person',
          start: 22,
          end: 37,
        },
      ],
    };
  }
}

// ============================================
// Client Privacy Layer
// ============================================

/**
 * Client-side privacy layer for customer name matching.
 *
 * Uses fuzzy and phonetic matching to detect and mask
 * customer names in text, even with typos or variations.
 *
 * @example
 * ```typescript
 * const clientLayer = new ClientPrivacyLayer({
 *   fuzzyThreshold: 0.8,
 *   usePhoneticMatching: true,
 * });
 *
 * clientLayer.addCustomerNames(['Muller GmbH', 'Schmidt AG']);
 *
 * const result = clientLayer.maskCustomerNames('Rechnung fuer Mueller GmbH');
 * console.log(result.maskedText); // "Rechnung fuer [CUSTOMER_1]"
 * ```
 */
export class ClientPrivacyLayer {
  private fuzzyThreshold: number;
  private usePhoneticMatching: boolean;
  private customerNames: string[] = [];
  private tokenManager: PrivacyTokenManager;

  /**
   * Creates a new client privacy layer.
   *
   * @param config - Layer configuration
   */
  constructor(config: ClientPrivacyLayerConfig) {
    this.fuzzyThreshold = config.fuzzyThreshold;
    this.usePhoneticMatching = config.usePhoneticMatching;
    this.tokenManager = new PrivacyTokenManager();
  }

  /**
   * Adds customer names to the matching database.
   *
   * @param names - Customer names to add
   */
  addCustomerNames(names: string[]): void {
    this.customerNames.push(...names);
  }

  /**
   * Clears all customer names.
   */
  clearCustomerNames(): void {
    this.customerNames = [];
  }

  /**
   * Masks customer names in text.
   *
   * Scans text for customer names using exact, fuzzy, and phonetic
   * matching and replaces them with tokens.
   *
   * @param text - Text to process
   * @returns Result with masked text and match information
   */
  maskCustomerNames(text: string): ClientPrivacyResult {
    const allMatches: CustomerMatch[] = [];

    // Sort customer names by length (longest first) to avoid partial matches
    const sortedNames = [...this.customerNames].sort((a, b) => b.length - a.length);

    // First, collect all matches on the original text
    for (const customerName of sortedNames) {
      const foundMatches = this.findMatches(text, customerName);

      for (const match of foundMatches) {
        // Skip if this position is already matched by a previous (longer) customer name
        const overlaps = allMatches.some(
          (existing) =>
            (match.start >= existing.start && match.start < existing.end) ||
            (match.end > existing.start && match.end <= existing.end) ||
            (match.start <= existing.start && match.end >= existing.end)
        );

        if (!overlaps) {
          allMatches.push(match);
        }
      }
    }

    // Sort matches by position (end position, descending) to replace from back to front
    allMatches.sort((a, b) => b.start - a.start);

    // Now replace all matches from back to front so positions stay valid
    let maskedText = text;
    for (const match of allMatches) {
      const token = this.tokenManager.createToken('CUSTOMER', match.original);
      match.placeholder = token.placeholder;

      const before = maskedText.slice(0, match.start);
      const after = maskedText.slice(match.end);
      maskedText = before + token.placeholder + after;
    }

    // Re-sort by position (ascending) for the return value
    allMatches.sort((a, b) => a.start - b.start);

    return {
      maskedText,
      matches: allMatches,
    };
  }

  /**
   * Finds matches for a customer name in text.
   *
   * @param text - Text to search
   * @param customerName - Customer name to find
   * @returns Array of matches found
   */
  private findMatches(text: string, customerName: string): CustomerMatch[] {
    const matches: CustomerMatch[] = [];
    const words = this.extractPotentialNames(text);

    for (const word of words) {
      // Skip if already a token
      if (word.text.startsWith('[') && word.text.endsWith(']')) {
        continue;
      }

      // Check exact match
      if (word.text.toLowerCase() === customerName.toLowerCase()) {
        matches.push({
          original: word.text,
          placeholder: '',
          similarity: 1,
          matchType: 'exact',
          start: word.start,
          end: word.end,
        });
        continue;
      }

      // Check fuzzy match
      const similarity = calculateSimilarity(word.text, customerName);
      if (similarity >= this.fuzzyThreshold) {
        matches.push({
          original: word.text,
          placeholder: '',
          similarity,
          matchType: 'fuzzy',
          start: word.start,
          end: word.end,
        });
        continue;
      }

      // Check phonetic match
      if (this.usePhoneticMatching && phoneticMatch(word.text, customerName)) {
        matches.push({
          original: word.text,
          placeholder: '',
          similarity: 0.85, // Phonetic matches get a fixed similarity
          matchType: 'phonetic',
          start: word.start,
          end: word.end,
        });
      }
    }

    return matches;
  }

  /**
   * Extracts potential name phrases from text.
   *
   * @param text - Text to extract from
   * @returns Array of potential names with positions
   */
  private extractPotentialNames(text: string): { text: string; start: number; end: number }[] {
    const results: { text: string; start: number; end: number }[] = [];

    // Company suffixes as a group
    const companySuffixes = '(?:GmbH|AG|KG|OHG|e\\.V\\.|mbH|UG)';
    // Character class for German letters
    const upperLetter = '[A-Z\u00C4\u00D6\u00DC]';
    const lowerLetter = '[a-z\u00E4\u00F6\u00FC\u00DF]';

    // Match company names with suffix - just one or two words before the suffix
    // This avoids matching common words like "Von", "An", "Der" etc.
    const companyPattern = new RegExp(
      `\\b(${upperLetter}${lowerLetter}+)\\s+${companySuffixes}\\b`,
      'g'
    );
    let match: RegExpExecArray | null;

    while ((match = companyPattern.exec(text)) !== null) {
      results.push({
        text: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    // Also match two-word company names like "Max Mustermann GmbH"
    const twoWordCompanyPattern = new RegExp(
      `\\b(${upperLetter}${lowerLetter}+\\s+${upperLetter}${lowerLetter}+)\\s+${companySuffixes}\\b`,
      'g'
    );
    while ((match = twoWordCompanyPattern.exec(text)) !== null) {
      // Skip if already covered
      const alreadyCovered = results.some(
        (r) => match!.index >= r.start && match!.index + match![0].length <= r.end
      );
      if (!alreadyCovered) {
        results.push({
          text: match[0],
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }

    // Match capitalized names (e.g., "Max Mustermann")
    const namePattern = new RegExp(
      `\\b${upperLetter}${lowerLetter}+(?:\\s+${upperLetter}${lowerLetter}+)+\\b`,
      'g'
    );
    while ((match = namePattern.exec(text)) !== null) {
      // Skip if already covered by company match
      const alreadyCovered = results.some(
        (r) => match!.index >= r.start && match!.index + match![0].length <= r.end
      );
      if (!alreadyCovered) {
        results.push({
          text: match[0],
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }

    // Finally, match single capitalized words (for single-word names like "Meier")
    const singleWordPattern = new RegExp(`\\b${upperLetter}${lowerLetter}{2,}\\b`, 'g');
    while ((match = singleWordPattern.exec(text)) !== null) {
      // Skip if already covered
      const alreadyCovered = results.some((r) => match!.index >= r.start && match!.index < r.end);
      if (!alreadyCovered) {
        results.push({
          text: match[0],
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }

    // Sort by position and return longest matches first for overlapping cases
    return results.sort((a, b) => a.start - b.start);
  }

  /**
   * Gets the current fuzzy match configuration.
   *
   * @returns Current configuration
   */
  getFuzzyConfig(): FuzzyMatchConfig {
    return {
      fuzzyThreshold: this.fuzzyThreshold,
      usePhoneticMatching: this.usePhoneticMatching,
    };
  }

  /**
   * Sets the fuzzy matching threshold.
   *
   * @param threshold - New threshold (0-1)
   */
  setFuzzyThreshold(threshold: number): void {
    this.fuzzyThreshold = threshold;
  }

  /**
   * Sets whether phonetic matching is enabled.
   *
   * @param enabled - Whether to enable phonetic matching
   */
  setPhoneticMatching(enabled: boolean): void {
    this.usePhoneticMatching = enabled;
  }

  /**
   * Gets the token manager for de-anonymization.
   *
   * @returns Token manager instance
   */
  getTokenManager(): PrivacyTokenManager {
    return this.tokenManager;
  }

  /**
   * Resets the token manager.
   */
  resetTokenManager(): void {
    this.tokenManager = new PrivacyTokenManager();
  }
}

// ============================================
// Dual Layer Privacy Orchestrator
// ============================================

/**
 * Orchestrates dual-layer privacy processing.
 *
 * Coordinates server-side Chirp 3 redaction with client-side
 * customer name masking for comprehensive privacy protection.
 *
 * @example
 * ```typescript
 * const dualLayer = new DualLayerPrivacy({
 *   serverConfig: {
 *     useMock: true,
 *     redactionConfig: { redactNames: true },
 *   },
 *   clientConfig: {
 *     fuzzyThreshold: 0.8,
 *     usePhoneticMatching: true,
 *   },
 * });
 *
 * dualLayer.addCustomerNames(['Muller GmbH']);
 *
 * const result = await dualLayer.processAudio(audioBuffer, 'de-DE');
 * console.log(result.finalText);
 * ```
 */
export class DualLayerPrivacy {
  private serverLayer: ServerPrivacyLayer;
  private clientLayer: ClientPrivacyLayer;

  /**
   * Creates a new dual layer privacy orchestrator.
   *
   * @param config - Orchestrator configuration
   */
  constructor(config: DualLayerConfig) {
    this.serverLayer = new ServerPrivacyLayer(config.serverConfig);
    this.clientLayer = new ClientPrivacyLayer(config.clientConfig);
  }

  /**
   * Processes audio through both privacy layers.
   *
   * First applies server-side Chirp 3 redaction, then
   * applies client-side customer name masking.
   *
   * @param audioBuffer - Audio data to process
   * @param languageCode - Language code (e.g., 'de-DE')
   * @returns Combined result from both layers
   */
  async processAudio(audioBuffer: Buffer, languageCode: string): Promise<DualLayerResult> {
    // Step 1: Server layer - Chirp 3 redaction
    const serverResult = await this.serverLayer.processAudioTranscription(
      audioBuffer,
      languageCode
    );

    // Step 2: Client layer - Customer name masking on server output
    this.clientLayer.resetTokenManager();
    const clientResult = this.clientLayer.maskCustomerNames(serverResult.anonymizedText);

    return {
      serverResult,
      clientResult,
      finalText: clientResult.maskedText,
      processingOrder: ['server', 'client'],
      tokenManager: this.clientLayer.getTokenManager(),
    };
  }

  /**
   * Processes text through client layer only.
   *
   * Use this for already-transcribed text that doesn't need
   * server-side processing.
   *
   * @param text - Text to process
   * @returns Processing result with token manager
   */
  processText(text: string): TextProcessingResult {
    this.clientLayer.resetTokenManager();
    const result = this.clientLayer.maskCustomerNames(text);

    return {
      maskedText: result.maskedText,
      tokenManager: this.clientLayer.getTokenManager(),
      matches: result.matches,
    };
  }

  /**
   * Adds customer names to the client layer.
   *
   * @param names - Customer names to add
   */
  addCustomerNames(names: string[]): void {
    this.clientLayer.addCustomerNames(names);
  }

  /**
   * Clears all customer names.
   */
  clearCustomerNames(): void {
    this.clientLayer.clearCustomerNames();
  }

  /**
   * Updates server layer configuration.
   *
   * @param updates - Configuration updates
   */
  updateServerConfig(updates: Partial<ChirpRedactionConfig>): void {
    this.serverLayer.updateRedactionConfig(updates);
  }

  /**
   * Updates client layer configuration.
   *
   * @param updates - Configuration updates
   */
  updateClientConfig(updates: Partial<FuzzyMatchConfig>): void {
    if (updates.fuzzyThreshold !== undefined) {
      this.clientLayer.setFuzzyThreshold(updates.fuzzyThreshold);
    }
    if (updates.usePhoneticMatching !== undefined) {
      this.clientLayer.setPhoneticMatching(updates.usePhoneticMatching);
    }
  }

  /**
   * Gets current server configuration.
   *
   * @returns Server redaction config
   */
  getServerConfig(): ChirpRedactionConfig {
    return this.serverLayer.getRedactionConfig();
  }

  /**
   * Gets current client configuration.
   *
   * @returns Client fuzzy match config
   */
  getClientConfig(): FuzzyMatchConfig {
    return this.clientLayer.getFuzzyConfig();
  }
}
