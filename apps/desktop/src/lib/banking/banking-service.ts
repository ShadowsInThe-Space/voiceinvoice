/**
 * Banking Service for CSV Import and Invoice Matching
 *
 * Handles importing bank transactions from CSV files (German bank formats)
 * and matching them with existing invoices using fuzzy matching.
 *
 * @module lib/banking/banking-service
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Parsed transaction from CSV file.
 */
export interface ParsedTransaction {
  transactionDate: Date;
  valueDate?: Date | undefined;
  counterparty: string;
  counterpartyIban?: string | undefined;
  amount: number;
  currency: string;
  purpose?: string | undefined;
}

/**
 * Result of CSV import operation.
 */
export interface ImportResult {
  success: boolean;
  imported: number;
  duplicates: number;
  matched: number;
  errors: string[];
}

/**
 * Match result between transaction and invoice.
 */
export interface MatchResult {
  transactionId: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  invoiceAmount: number;
  confidence: number;
  matchReasons: string[];
}

/**
 * Supported CSV formats for German banks.
 */
type CsvFormat = 'sparkasse' | 'deutsche_bank' | 'generic';

/**
 * Detects the CSV format based on header row.
 *
 * @param {string} headerLine - First line of CSV file
 * @returns {CsvFormat} Detected format
 */
function detectCsvFormat(headerLine: string): CsvFormat {
  const lower = headerLine.toLowerCase();

  if (lower.includes('buchungstag') && lower.includes('verwendungszweck')) {
    if (lower.includes('beguenstigter/zahlungspflichtiger')) {
      return 'sparkasse';
    }
    return 'deutsche_bank';
  }

  return 'generic';
}

/**
 * Parses German date format (DD.MM.YYYY) to Date object.
 *
 * @param {string} dateStr - Date string in German format
 * @returns {Date | null} Parsed date or null if invalid
 */
function parseGermanDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!match) return null;

  const [, day, month, year] = match;
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

  return isNaN(date.getTime()) ? null : date;
}

/**
 * Parses German currency format (1.234,56) to number.
 *
 * @param {string} amountStr - Amount string in German format
 * @returns {number} Parsed amount
 */
function parseGermanAmount(amountStr: string): number {
  if (!amountStr) return 0;

  // Remove thousands separator (.) and replace decimal comma with dot
  const normalized = amountStr
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  return parseFloat(normalized) || 0;
}

/**
 * Parses a CSV line handling quoted fields.
 *
 * @param {string} line - CSV line
 * @param {string} delimiter - Field delimiter
 * @returns {string[]} Array of field values
 */
function parseCsvLine(line: string, delimiter: string = ';'): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Parses Sparkasse CSV format.
 *
 * @param {string[]} lines - CSV lines (excluding header)
 * @param {string[]} headers - Header fields
 * @returns {ParsedTransaction[]} Parsed transactions
 */
function parseSparkasseCsv(lines: string[], headers: string[]): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  // Find column indices
  const dateIdx = headers.findIndex((h) => h.toLowerCase().includes('buchungstag'));
  const valueDateIdx = headers.findIndex((h) => h.toLowerCase().includes('valuta'));
  const counterpartyIdx = headers.findIndex(
    (h) =>
      h.toLowerCase().includes('beguenstigter') || h.toLowerCase().includes('zahlungspflichtiger')
  );
  const purposeIdx = headers.findIndex((h) => h.toLowerCase().includes('verwendungszweck'));
  const amountIdx = headers.findIndex((h) => h.toLowerCase().includes('betrag'));
  const currencyIdx = headers.findIndex((h) => h.toLowerCase().includes('waehrung'));

  for (const line of lines) {
    if (!line.trim()) continue;

    const fields = parseCsvLine(line);
    const transactionDate = parseGermanDate(fields[dateIdx]);

    if (!transactionDate) continue;

    transactions.push({
      transactionDate,
      valueDate: parseGermanDate(fields[valueDateIdx]) || undefined,
      counterparty: fields[counterpartyIdx] || 'Unbekannt',
      amount: parseGermanAmount(fields[amountIdx]),
      currency: fields[currencyIdx] || 'EUR',
      purpose: fields[purposeIdx] || undefined,
    });
  }

  return transactions;
}

/**
 * Parses Deutsche Bank CSV format.
 *
 * @param {string[]} lines - CSV lines (excluding header)
 * @param {string[]} headers - Header fields
 * @returns {ParsedTransaction[]} Parsed transactions
 */
function parseDeutscheBankCsv(lines: string[], headers: string[]): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  // Find column indices (Deutsche Bank specific naming)
  const dateIdx = headers.findIndex((h) => h.toLowerCase().includes('buchungsdatum'));
  const counterpartyIdx = headers.findIndex((h) => h.toLowerCase().includes('auftraggeber'));
  const ibanIdx = headers.findIndex((h) => h.toLowerCase().includes('iban'));
  const purposeIdx = headers.findIndex((h) => h.toLowerCase().includes('verwendungszweck'));
  const amountIdx = headers.findIndex((h) => h.toLowerCase().includes('betrag'));

  for (const line of lines) {
    if (!line.trim()) continue;

    const fields = parseCsvLine(line);
    const transactionDate = parseGermanDate(fields[dateIdx]);

    if (!transactionDate) continue;

    transactions.push({
      transactionDate,
      counterparty: fields[counterpartyIdx] || 'Unbekannt',
      counterpartyIban: fields[ibanIdx] || undefined,
      amount: parseGermanAmount(fields[amountIdx]),
      currency: 'EUR',
      purpose: fields[purposeIdx] || undefined,
    });
  }

  return transactions;
}

/**
 * Parses generic CSV format (best effort).
 *
 * @param {string[]} lines - CSV lines (excluding header)
 * @param {string[]} headers - Header fields
 * @returns {ParsedTransaction[]} Parsed transactions
 */
function parseGenericCsv(lines: string[], headers: string[]): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  // Try to find common column names
  const dateIdx = headers.findIndex(
    (h) =>
      h.toLowerCase().includes('datum') ||
      h.toLowerCase().includes('date') ||
      h.toLowerCase().includes('buchung')
  );
  const counterpartyIdx = headers.findIndex(
    (h) =>
      h.toLowerCase().includes('name') ||
      h.toLowerCase().includes('empfaenger') ||
      h.toLowerCase().includes('partner')
  );
  const amountIdx = headers.findIndex(
    (h) => h.toLowerCase().includes('betrag') || h.toLowerCase().includes('amount')
  );
  const purposeIdx = headers.findIndex(
    (h) =>
      h.toLowerCase().includes('zweck') ||
      h.toLowerCase().includes('verwendung') ||
      h.toLowerCase().includes('description')
  );

  if (dateIdx === -1 || amountIdx === -1) {
    return transactions;
  }

  for (const line of lines) {
    if (!line.trim()) continue;

    const fields = parseCsvLine(line);
    const transactionDate = parseGermanDate(fields[dateIdx]);

    if (!transactionDate) continue;

    transactions.push({
      transactionDate,
      counterparty: counterpartyIdx >= 0 ? fields[counterpartyIdx] || 'Unbekannt' : 'Unbekannt',
      amount: parseGermanAmount(fields[amountIdx]),
      currency: 'EUR',
      purpose: purposeIdx >= 0 ? fields[purposeIdx] : undefined,
    });
  }

  return transactions;
}

/**
 * Calculates Levenshtein distance between two strings.
 *
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Edit distance
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
 * Calculates similarity score between two strings (0-1).
 *
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Similarity score (1 = identical)
 */
function calculateSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;

  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();

  if (aLower === bLower) return 1;

  const maxLen = Math.max(aLower.length, bLower.length);
  if (maxLen === 0) return 1;

  const distance = levenshteinDistance(aLower, bLower);
  return 1 - distance / maxLen;
}

/**
 * Banking service for CSV import and invoice matching.
 */
export class BankingService {
  /**
   * Parses a CSV file and returns transactions.
   *
   * @param {string} filePath - Path to CSV file
   * @returns {ParsedTransaction[]} Parsed transactions
   * @throws {Error} If file cannot be read or parsed
   */
  parseCsvFile(filePath: string): ParsedTransaction[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);

    if (lines.length < 2) {
      throw new Error('CSV-Datei ist leer oder hat keine Daten');
    }

    const headerLine = lines[0];
    const format = detectCsvFormat(headerLine);
    const headers = parseCsvLine(headerLine);
    const dataLines = lines.slice(1);

    switch (format) {
      case 'sparkasse':
        return parseSparkasseCsv(dataLines, headers);
      case 'deutsche_bank':
        return parseDeutscheBankCsv(dataLines, headers);
      default:
        return parseGenericCsv(dataLines, headers);
    }
  }

  /**
   * Scans a directory for CSV files.
   *
   * @param {string} dirPath - Directory path
   * @returns {string[]} Array of CSV file paths
   */
  scanDirectory(dirPath: string): string[] {
    try {
      const files = fs.readdirSync(dirPath);
      return files
        .filter((file) => file.toLowerCase().endsWith('.csv'))
        .map((file) => path.join(dirPath, file));
    } catch {
      return [];
    }
  }

  /**
   * Finds potential invoice matches for a transaction.
   *
   * @param {object} transaction - Transaction to match
   * @param {string} transaction.counterparty - Transaction counterparty name
   * @param {number} transaction.amount - Transaction amount
   * @param {string} [transaction.purpose] - Transaction purpose/reference
   * @param {object[]} invoices - Array of invoices to match against
   * @param {string} invoices[].id - Invoice ID
   * @param {string} invoices[].number - Invoice number
   * @param {string} invoices[].customerName - Customer name
   * @param {number} invoices[].total - Invoice total
   * @returns {Array<{invoiceId: string, confidence: number, reasons: string[]}>} Match results
   */
  findMatches(
    transaction: { counterparty: string; amount: number; purpose?: string | undefined },
    invoices: { id: string; number: string; customerName: string; total: number }[]
  ): { invoiceId: string; confidence: number; reasons: string[] }[] {
    const matches: { invoiceId: string; confidence: number; reasons: string[] }[] = [];

    for (const invoice of invoices) {
      let confidence = 0;
      const reasons: string[] = [];

      // Amount match (exact or very close)
      const amountDiff = Math.abs(transaction.amount - invoice.total);
      const amountPercent = amountDiff / Math.max(Math.abs(invoice.total), 1);

      if (amountDiff < 0.01) {
        confidence += 0.4;
        reasons.push('Betrag stimmt exakt überein');
      } else if (amountPercent < 0.01) {
        confidence += 0.35;
        reasons.push('Betrag stimmt fast überein (< 1% Abweichung)');
      } else if (amountPercent < 0.05) {
        confidence += 0.2;
        reasons.push('Betrag ähnlich (< 5% Abweichung)');
      }

      // Customer name match
      const nameSimilarity = calculateSimilarity(transaction.counterparty, invoice.customerName);
      if (nameSimilarity > 0.9) {
        confidence += 0.35;
        reasons.push('Kundenname stimmt überein');
      } else if (nameSimilarity > 0.7) {
        confidence += 0.25;
        reasons.push('Kundenname ähnlich');
      } else if (nameSimilarity > 0.5) {
        confidence += 0.1;
        reasons.push('Kundenname teilweise ähnlich');
      }

      // Invoice number in purpose
      if (transaction.purpose) {
        const purposeLower = transaction.purpose.toLowerCase();
        const invoiceNumLower = invoice.number.toLowerCase();

        if (purposeLower.includes(invoiceNumLower)) {
          confidence += 0.25;
          reasons.push('Rechnungsnummer im Verwendungszweck gefunden');
        } else {
          // Check for partial match (at least 4 chars)
          const numDigits = invoice.number.replace(/\D/g, '');
          if (numDigits.length >= 4 && purposeLower.includes(numDigits)) {
            confidence += 0.15;
            reasons.push('Rechnungsnummer (Ziffern) im Verwendungszweck');
          }
        }
      }

      // Only include if confidence is meaningful
      if (confidence >= 0.3) {
        matches.push({
          invoiceId: invoice.id,
          confidence: Math.min(confidence, 1),
          reasons,
        });
      }
    }

    // Sort by confidence descending
    return matches.sort((a, b) => b.confidence - a.confidence);
  }
}

export default BankingService;
