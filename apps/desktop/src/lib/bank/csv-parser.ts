/**
 * Bank CSV Parser for German Bank Formats.
 *
 * Parses CSV exports from common German banks:
 * - Sparkasse
 * - Deutsche Bank
 * - Volksbank
 *
 * @module lib/bank/csv-parser
 */

/**
 * Supported bank formats.
 */
export type BankFormat = 'sparkasse' | 'deutschebank' | 'volksbank';

/**
 * Represents a parsed bank transaction.
 */
export interface BankTransaction {
  /** Transaction booking date */
  date: Date;

  /** Transaction description/type (e.g., GUTSCHR, LASTSCHRIFT) */
  description: string;

  /** Payment reference/purpose text */
  reference: string;

  /** Transaction amount (positive = income, negative = expense) */
  amount: number;

  /** Counterparty name */
  counterparty: string;

  /** Counterparty IBAN (if available) */
  iban?: string;
}

/**
 * Header signatures for automatic format detection.
 * Order matters - more specific formats should be checked first.
 */
const FORMAT_SIGNATURES: Record<BankFormat, string[]> = {
  // Volksbank has very specific headers - check first
  volksbank: ['Bezeichnung Auftragskonto', 'IBAN Auftragskonto', 'Name Zahlungsbeteiligter'],
  // Deutsche Bank has unique headers (support both ue and uumlaut)
  deutschebank: ['Umsatzart', 'stigt'], // matches "Begünstigter" or "Beguenstigter"
  // Sparkasse is the fallback
  sparkasse: ['Beguenstigter/Zahlungspflichtiger', 'Buchungstext'],
};

/**
 * Parses a German date string in DD.MM.YYYY or DD.MM.YY format.
 *
 * @param dateStr - The date string to parse
 * @returns Parsed Date object
 * @throws Error if date format is invalid
 */
export function parseGermanDate(dateStr: string): Date {
  const trimmed = dateStr.trim();

  // Match DD.MM.YYYY or DD.MM.YY
  const match = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);

  if (!match) {
    throw new Error(`Invalid German date format: ${dateStr}`);
  }

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1; // 0-indexed
  let year = parseInt(match[3], 10);

  // Handle 2-digit years
  if (year < 100) {
    year += year < 50 ? 2000 : 1900;
  }

  const date = new Date(year, month, day);

  // Validate the date is real
  if (date.getDate() !== day || date.getMonth() !== month || date.getFullYear() !== year) {
    throw new Error(`Invalid date: ${dateStr}`);
  }

  return date;
}

/**
 * Parses a German amount string (1.234,56 or -1.234,56).
 *
 * Also handles:
 * - S suffix (Soll/debit = negative)
 * - H suffix (Haben/credit = positive)
 *
 * @param amountStr - The amount string to parse
 * @returns Parsed amount as number
 */
export function parseGermanAmount(amountStr: string): number {
  let trimmed = amountStr.trim();
  let sign = 1;

  // Check for S (Soll/debit) suffix - means negative
  if (trimmed.endsWith(' S') || trimmed.endsWith('S')) {
    sign = -1;
    trimmed = trimmed.replace(/\s*S$/, '');
  }

  // Check for H (Haben/credit) suffix - means positive
  if (trimmed.endsWith(' H') || trimmed.endsWith('H')) {
    sign = 1;
    trimmed = trimmed.replace(/\s*H$/, '');
  }

  // Check for leading minus sign
  if (trimmed.startsWith('-')) {
    sign = -1;
    trimmed = trimmed.substring(1);
  }

  // Remove thousand separators (dots) and replace decimal comma with dot
  const normalized = trimmed.replace(/\./g, '').replace(',', '.');

  const amount = parseFloat(normalized);

  if (isNaN(amount)) {
    throw new Error(`Invalid German amount format: ${amountStr}`);
  }

  return amount * sign;
}

/**
 * Detects the bank format from CSV content based on header row.
 * Checks in order: Volksbank, Deutsche Bank, Sparkasse.
 *
 * @param content - CSV file content
 * @returns Detected bank format or null if unknown
 */
export function detectBankFormat(content: string): BankFormat | null {
  const firstLine = content.split(/\r?\n/)[0].toLowerCase();

  // Check formats in specific order (most specific first)
  const formatOrder: BankFormat[] = ['volksbank', 'deutschebank', 'sparkasse'];

  for (const format of formatOrder) {
    const signatures = FORMAT_SIGNATURES[format];
    const matchCount = signatures.filter((sig) => firstLine.includes(sig.toLowerCase())).length;

    // Require at least 2 signature matches for confidence
    if (matchCount >= 2) {
      return format;
    }
  }

  return null;
}

/**
 * Parses a CSV line handling quoted fields with delimiters.
 *
 * @param line - CSV line to parse
 * @param delimiter - Field delimiter (default: ;)
 * @returns Array of field values
 */
function parseCSVLine(line: string, delimiter: string = ';'): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add the last field
  fields.push(current.trim());

  return fields;
}

/**
 * Parses Sparkasse CSV format.
 *
 * Format: Auftragskonto;Buchungstag;Valutadatum;Buchungstext;Verwendungszweck;
 *         Beguenstigter/Zahlungspflichtiger;Kontonummer;BLZ;Betrag;Waehrung;Info
 * @param lines
 */
function parseSparkasse(lines: string[]): BankTransaction[] {
  const transactions: BankTransaction[] = [];

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const fields = parseCSVLine(line);

      if (fields.length < 9) continue;

      const transaction: BankTransaction = {
        date: parseGermanDate(fields[1]), // Buchungstag
        description: fields[3], // Buchungstext
        reference: fields[4], // Verwendungszweck
        counterparty: fields[5], // Beguenstigter/Zahlungspflichtiger
        amount: parseGermanAmount(fields[8]), // Betrag
      };

      transactions.push(transaction);
    } catch {
      // Skip invalid rows
      continue;
    }
  }

  return transactions;
}

/**
 * Parses Deutsche Bank CSV format.
 *
 * Format: Buchungstag;Wert;Umsatzart;Beguenstigter / Auftraggeber;Verwendungszweck;
 *         IBAN;BIC;Kundenreferenz;Mandatsreferenz;Glaeubigerkennung;Fremde Gebuehren;
 *         Betrag;Abweichender Empfaenger;Anzahl der Auftraege;Anzahl der Schecks
 * @param lines
 */
function parseDeutscheBank(lines: string[]): BankTransaction[] {
  const transactions: BankTransaction[] = [];

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const fields = parseCSVLine(line);

      if (fields.length < 6) continue;

      // Find amount field - it's the first non-empty field that looks like a German amount
      // starting from index 10 (after the fixed fields)
      let amountStr = '';
      for (let j = 10; j < fields.length; j++) {
        const field = fields[j].trim();
        if (field && /^-?[\d.,]+$/.test(field.replace(/\s*[SH]$/, ''))) {
          amountStr = field;
          break;
        }
      }

      if (!amountStr) continue;

      const transaction: BankTransaction = {
        date: parseGermanDate(fields[0]), // Buchungstag
        description: fields[2], // Umsatzart
        counterparty: fields[3], // Beguenstigter / Auftraggeber
        reference: fields[4], // Verwendungszweck
        amount: parseGermanAmount(amountStr), // Betrag
        ...(fields[5] && { iban: fields[5] }), // IBAN (if present)
      };

      transactions.push(transaction);
    } catch {
      // Skip invalid rows
      continue;
    }
  }

  return transactions;
}

/**
 * Parses Volksbank CSV format.
 *
 * Format: Bezeichnung Auftragskonto;IBAN Auftragskonto;BIC Auftragskonto;
 *         Bankname Auftragskonto;Buchungstag;Valutadatum;Name Zahlungsbeteiligter;
 *         IBAN Zahlungsbeteiligter;BIC (SWIFT-Code) Zahlungsbeteiligter;Buchungstext;
 *         Verwendungszweck;Betrag;Waehrung;Saldo nach Buchung;Bemerkung;Kategorie;
 *         Steuerrelevant;Glaeubiger ID;Mandatsreferenz
 * @param lines
 */
function parseVolksbank(lines: string[]): BankTransaction[] {
  const transactions: BankTransaction[] = [];

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const fields = parseCSVLine(line);

      if (fields.length < 12) continue;

      const transaction: BankTransaction = {
        date: parseGermanDate(fields[4]), // Buchungstag
        counterparty: fields[6], // Name Zahlungsbeteiligter
        description: fields[9], // Buchungstext
        reference: fields[10], // Verwendungszweck
        amount: parseGermanAmount(fields[11]), // Betrag
        ...(fields[7] && { iban: fields[7] }), // IBAN Zahlungsbeteiligter (if present)
      };

      transactions.push(transaction);
    } catch {
      // Skip invalid rows
      continue;
    }
  }

  return transactions;
}

/**
 * Parses bank CSV content into transactions.
 *
 * @param content - CSV file content
 * @param format - Bank format to use for parsing
 * @returns Array of parsed transactions
 * @throws Error if format is not supported
 */
export function parseCSV(content: string, format: BankFormat): BankTransaction[] {
  // Normalize line endings
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedContent.split('\n').filter((line) => line.trim());

  switch (format) {
    case 'sparkasse':
      return parseSparkasse(lines);
    case 'deutschebank':
      return parseDeutscheBank(lines);
    case 'volksbank':
      return parseVolksbank(lines);
    default:
      throw new Error(`Unsupported bank format: ${format}`);
  }
}
