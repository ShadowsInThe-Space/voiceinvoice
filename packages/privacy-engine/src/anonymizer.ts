import Fuse from 'fuse.js';
import { AnonymizationResult, TokenMap } from './index';

export class Anonymizer {
  private tokenMap: TokenMap = {};
  private counters: Record<string, number> = {};
  private knownEntities: string[];
  private fuse: Fuse<string> | null = null;
  private text: string;

  constructor(text: string, knownEntities: string[] = []) {
    this.text = text;
    this.knownEntities = knownEntities;
    if (this.knownEntities.length > 0) {
      this.fuse = new Fuse(this.knownEntities, {
        includeScore: true,
        threshold: 0.2, // 0.0 is exact match, 1.0 is match anything
        minMatchCharLength: 3,
      });
    }
  }

  public process(): AnonymizationResult {
    // 1. Mask Known Entities (Customer Names)
    this.maskKnownEntities();

    // 2. Mask PII Patterns
    this.maskEmails();
    this.maskIBANs();
    this.maskPhoneNumbers();
    this.maskAmounts();

    return {
      anonymizedText: this.text,
      tokenMap: this.tokenMap,
      entityCount: Object.keys(this.tokenMap).length,
    };
  }

  private maskKnownEntities() {
    if (!this.fuse || this.knownEntities.length === 0) return;

    // We generate n-grams from the text and search them in knownEntities
    // This is computationally expensive but works for identifying entities in text
    // Max entity length assumed to be 5 words
    const maxN = 5;

    // We should iterate and replace. To avoid messing up indices, we can identify ranges to replace first.
    // However, simplest is to iterate through text?
    // Or iterate through known entities and try to find them?
    // Finding fuzzy matches of a string inside a longer string is "fuzzy substring matching".
    // Fuse is "fuzzy string matching" (against a list).

    // Strategy:
    // Generate candidates from text.
    // Check if candidate matches a known entity.
    // If yes, replace.
    // We start with longest n-grams to prioritize specific matches.

    // A map to keep track of matched ranges to avoid overlapping replacements?
    // For simplicity, we will do replacements directly, but restart if we modify text?
    // No, that's infinite loop risk.

    // Better: Collect all matches, sort by length (desc) and position, then apply.

    interface Match {
      start: number;
      end: number;
      text: string;
      entity: string;
    }

    const matches: Match[] = [];

    // Brute force substring generation (window based on words)
    // We need original indices.

    // Helper to find word boundaries
    const wordIndices: {start: number, end: number}[] = [];
    const regex = /\S+/g;
    let match;
    while ((match = regex.exec(this.text)) !== null) {
      wordIndices.push({ start: match.index, end: regex.lastIndex });
    }

    for (let n = maxN; n >= 1; n--) {
      for (let i = 0; i <= wordIndices.length - n; i++) {
        const start = wordIndices[i].start;
        const end = wordIndices[i + n - 1].end;
        const candidate = this.text.substring(start, end);

        // Skip if this range overlaps with already found matches?
        // We filter later.

        const result = this.fuse.search(candidate);
        if (result.length > 0 && result[0].score! < 0.2) {
            // Found a match!
            matches.push({
                start,
                end,
                text: candidate,
                entity: result[0].item
            });
        }
      }
    }

    // Sort matches by length (desc) to prefer longer matches
    matches.sort((a, b) => (b.end - b.start) - (a.end - a.start));

    // Filter overlapping
    const appliedMatches: Match[] = [];
    for (const m of matches) {
      // Check overlap
      const overlap = appliedMatches.some(applied =>
        (m.start >= applied.start && m.start < applied.end) ||
        (m.end > applied.start && m.end <= applied.end) ||
        (m.start <= applied.start && m.end >= applied.end)
      );

      if (!overlap) {
        appliedMatches.push(m);
      }
    }

    // Apply replacements from back to front
    appliedMatches.sort((a, b) => b.start - a.start);

    for (const m of appliedMatches) {
        const token = this.getToken('CUSTOMER', m.entity);
        this.replaceRange(m.start, m.end, `[${token}]`);
    }
  }

  private maskEmails() {
    const regex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    this.replaceRegex(regex, 'EMAIL');
  }

  private maskIBANs() {
    // Basic IBAN regex (Germany starts with DE, 22 chars usually)
    // Covering generic IBAN format
    const regex = /\b[A-Z]{2}\d{2}[ ]?(?:\d{4}[ ]?){3,6}\d{0,2}\b/g;
    this.replaceRegex(regex, 'IBAN');
  }

  private maskPhoneNumbers() {
     // German phone number approximations
     // Examples: +49 123 456789, 0123 456789, 030-123456
     // Must be careful not to match small numbers or dates or prices
     // Min length 7?
     const regex = /(?:\+49|0)(?:\s*\d){6,}\b/g;
     this.replaceRegex(regex, 'PHONE');
  }

  private maskAmounts() {
    // 100 EUR, 100.00 €, $50
    const regex = /(?:\b\d+(?:[.,]\d{1,2})?\s?(?:EUR|€|USD|GBP)\b)|(?:(?:\$|€|£)\s?\d+(?:[.,]\d{1,2})?\b)/gi;
    this.replaceRegex(regex, 'AMOUNT');
  }

  private replaceRegex(regex: RegExp, type: string) {
    this.text = this.text.replace(regex, (match) => {
      const token = this.getToken(type, match);
      return `[${token}]`;
    });
  }

  private replaceRange(start: number, end: number, replacement: string) {
      this.text = this.text.substring(0, start) + replacement + this.text.substring(end);
  }

  private getToken(type: string, value: string): string {
      // Check if value is already mapped
      for (const [t, v] of Object.entries(this.tokenMap)) {
          if (v === value && t.startsWith(type)) {
              return t;
          }
      }

      if (!this.counters[type]) {
          this.counters[type] = 0;
      }
      this.counters[type]++;
      const token = `${type}_${this.counters[type]}`;
      this.tokenMap[token] = value;
      return token;
  }
}
