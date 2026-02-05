import Fuse from 'fuse.js';
import { AnonymizationResult, TokenMap } from './index';

const ANONYMIZER_TOKEN_TYPES = ['CUSTOMER', 'EMAIL', 'IBAN', 'PHONE', 'AMOUNT'] as const;
type AnonymizerTokenType = (typeof ANONYMIZER_TOKEN_TYPES)[number];

/**
 * Anonymizer fuer Freitext, der personenbezogene Daten (PII) und bekannte Entitaeten maskiert.
 *
 * @description
 * Diese Klasse arbeitet rein lokal: Sie ersetzt erkannte Inhalte (z.B. E-Mail, IBAN, Telefonnummern,
 * Betraege sowie bekannte Kunden-/Entitaetsnamen) durch Tokens wie `EMAIL_1` und liefert zusaetzlich
 * eine Token-zu-Original Mapping-Tabelle zur spaeteren Re-Identifikation.
 */
export class Anonymizer {
  private tokenMap: TokenMap = {};
  private counters: Partial<Record<AnonymizerTokenType, number>> = {};
  private knownEntities: string[];
  private fuse: Fuse<string> | null = null;
  private text: string;

  /**
   * Erstellt eine neue Anonymizer-Instanz.
   *
   * @description
   * Optional kann eine Liste bekannter Entitaeten (z.B. Kundennamen) uebergeben werden. Wenn vorhanden,
   * wird intern eine Fuse.js Instanz aufgebaut, um Fuzzy-Matches im Text zu finden.
   *
   * @param text - Der zu anonymisierende Text.
   * @param knownEntities - Bekannte Entitaeten (z.B. Kundennamen), die im Text maskiert werden sollen.
   */
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

  /**
   * Fuehrt die komplette Anonymisierung des Textes aus.
   *
   * @description
   * Die Verarbeitung erfolgt in einer festen Reihenfolge:
   * 1) bekannte Entitaeten (z.B. Kundennamen), 2) PII-Patterns (E-Mail, IBAN, Telefon, Betraege).
   *
   * @returns Das Ergebnis inkl. anonymisiertem Text, Token-Mapping und Anzahl der ersetzten Entitaeten.
   */
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

  private maskKnownEntities(): void {
    if (!this.fuse || this.knownEntities.length === 0) return;

    // We generate n-grams from the text and search them in knownEntities
    // Max entity length assumed to be 5 words
    const maxN = 5;

    interface Match {
      start: number;
      end: number;
      text: string;
      entity: string;
    }

    const matches: Match[] = [];

    // Helper to find word boundaries.
    const wordIndices: Array<{ start: number; end: number }> = [];
    const wordRegex = /\\S+/g;
    let wordMatch: RegExpExecArray | null;
    while ((wordMatch = wordRegex.exec(this.text)) !== null) {
      wordIndices.push({ start: wordMatch.index, end: wordRegex.lastIndex });
    }

    for (let n = maxN; n >= 1; n--) {
      for (let i = 0; i <= wordIndices.length - n; i++) {
        const start = wordIndices[i].start;
        const end = wordIndices[i + n - 1].end;
        const candidate = this.text.substring(start, end);

        const results = this.fuse.search(candidate);
        if (results.length === 0) continue;

        const score = results[0].score;
        if (typeof score !== 'number' || score >= 0.2) continue;

        matches.push({
          start,
          end,
          text: candidate,
          entity: results[0].item,
        });
      }
    }

    // Sort matches by length (desc) to prefer longer matches
    matches.sort((a, b) => b.end - b.start - (a.end - a.start));

    // Filter overlapping matches (keep longest non-overlapping spans).
    const appliedMatches: Match[] = [];
    for (const m of matches) {
      const overlap = appliedMatches.some((applied) => {
        return (
          (m.start >= applied.start && m.start < applied.end) ||
          (m.end > applied.start && m.end <= applied.end) ||
          (m.start <= applied.start && m.end >= applied.end)
        );
      });

      if (!overlap) appliedMatches.push(m);
    }

    // Apply replacements from back to front to keep indices stable.
    appliedMatches.sort((a, b) => b.start - a.start);
    for (const m of appliedMatches) {
      const token = this.getToken('CUSTOMER', m.entity);
      this.replaceRange(m.start, m.end, `[${token}]`);
    }
  }

  private maskEmails(): void {
    const regex = /\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b/g;
    this.replaceRegex(regex, 'EMAIL');
  }

  private maskIBANs(): void {
    // Basic IBAN regex (Germany starts with DE, 22 chars usually)
    // Covering generic IBAN format
    const regex = /\\b[A-Z]{2}\\d{2}[ ]?(?:\\d{4}[ ]?){3,6}\\d{0,2}\\b/g;
    this.replaceRegex(regex, 'IBAN');
  }

  private maskPhoneNumbers(): void {
    // German phone number approximations
    // Examples: +49 123 456789, 0123 456789, 030-123456
    // Min length 7?
    const regex = /(?:\\+49|0)(?:\\s*\\d){6,}\\b/g;
    this.replaceRegex(regex, 'PHONE');
  }

  private maskAmounts(): void {
    // 100 EUR, 100.00 €, $50
    const regex =
      /(?:\\b\\d+(?:[.,]\\d{1,2})?\\s?(?:EUR|€|USD|GBP)\\b)|(?:(?:\\$|€|£)\\s?\\d+(?:[.,]\\d{1,2})?\\b)/gi;
    this.replaceRegex(regex, 'AMOUNT');
  }

  private replaceRegex(regex: RegExp, type: AnonymizerTokenType): void {
    this.text = this.text.replace(regex, (match) => {
      const token = this.getToken(type, match);
      return `[${token}]`;
    });
  }

  private replaceRange(start: number, end: number, replacement: string): void {
    this.text = this.text.substring(0, start) + replacement + this.text.substring(end);
  }

  private getToken(type: AnonymizerTokenType, value: string): string {
    // Check if value is already mapped
    for (const [t, v] of Object.entries(this.tokenMap)) {
      if (v === value && t.startsWith(type)) return t;
    }

    const next = (this.counters[type] ?? 0) + 1;
    this.counters[type] = next;

    const token = `${type}_${next}`;
    this.tokenMap[token] = value;
    return token;
  }
}
