/**
 * Invoice Matching Algorithm for Bank Synchronization.
 *
 * Matches bank transactions with open invoices based on:
 * 1. Invoice number in reference (highest confidence)
 * 2. Exact amount + similar customer name
 * 3. Exact amount alone (lower confidence)
 *
 * @module lib/bank/invoice-matcher
 */

import type { BankTransaction } from './csv-parser';

/**
 * Simplified invoice interface for matching.
 * Can accept any object with these required fields.
 */
export interface MatchableInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  grossAmount: number;
  status: string;
  customer?: {
    companyName: string;
  };
}

/**
 * Result of matching a transaction with invoices.
 */
export interface MatchResult {
  /** The bank transaction */
  transaction: BankTransaction;

  /** Matched invoice (null if no match) */
  invoice: MatchableInvoice | null;

  /** Match confidence (0-1) */
  confidence: number;

  /** Human-readable reason for the match */
  matchReason: string;
}

/**
 * Normalizes a string for comparison (lowercase, normalize umlauts).
 * @param str
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Calculates similarity between two strings using Jaccard similarity
 * on character n-grams.
 *
 * @param a - First string
 * @param b - Second string
 * @returns Similarity score between 0 and 1
 */
export function calculateStringSimilarity(a: string, b: string): number {
  const normA = normalizeString(a);
  const normB = normalizeString(b);

  // Handle empty strings
  if (normA.length === 0 && normB.length === 0) return 1;
  if (normA.length === 0 || normB.length === 0) return 0;

  // Create n-grams (bigrams)
  const ngramSize = 2;
  const getNgrams = (str: string): Set<string> => {
    const ngrams = new Set<string>();
    if (str.length < ngramSize) {
      ngrams.add(str);
      return ngrams;
    }
    for (let i = 0; i <= str.length - ngramSize; i++) {
      ngrams.add(str.substring(i, i + ngramSize));
    }
    return ngrams;
  };

  const ngramsA = getNgrams(normA);
  const ngramsB = getNgrams(normB);

  // Calculate Jaccard similarity
  let intersection = 0;
  for (const ngram of ngramsA) {
    if (ngramsB.has(ngram)) {
      intersection++;
    }
  }

  const union = ngramsA.size + ngramsB.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

/**
 * Extracts potential invoice numbers from a text string.
 *
 * Supports formats:
 * - RE-2024-001
 * - INV-2024-0042
 * - RG2024001
 * - Rechnung 2024/0042
 *
 * @param text - Text to search for invoice numbers
 * @returns Array of found invoice numbers
 */
export function extractInvoiceNumbers(text: string): string[] {
  const patterns = [
    // RE-2024-001, INV-2024-0042 patterns
    /\b(RE-\d{4}-\d+)\b/gi,
    /\b(INV-\d{4}-\d+)\b/gi,
    // RG2024001 pattern
    /\b(RG\d{4,})\b/gi,
    // "Rechnung 2024/0042" pattern
    /Rechnung\s+(\d{4}\/\d+)/gi,
    // "Rechnung Nr. 123" pattern
    /Rechnung\s+(?:Nr\.?\s+)?(\d+)/gi,
  ];

  const results: string[] = [];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const invoiceNumber = match[1];
      if (!results.includes(invoiceNumber)) {
        results.push(invoiceNumber);
      }
    }
  }

  return results;
}

/**
 * Matches bank transactions with open invoices.
 *
 * Match priority:
 * 1. Invoice number in reference (confidence >= 0.9)
 * 2. Exact amount + similar customer name (confidence 0.6-0.89)
 * 3. Exact amount alone (confidence 0.3-0.5)
 *
 * @param transactions - Bank transactions to match
 * @param invoices - Open invoices to match against
 * @returns Match results for all transactions
 */
export function matchTransactions(
  transactions: BankTransaction[],
  invoices: MatchableInvoice[]
): MatchResult[] {
  const results: MatchResult[] = [];

  // Filter to only PENDING invoices
  const openInvoices = invoices.filter(
    (inv) => inv.status === 'PENDING' || inv.status === 'SENT' || inv.status === 'OVERDUE'
  );

  for (const transaction of transactions) {
    // Skip expense transactions (negative amounts)
    if (transaction.amount < 0) {
      results.push({
        transaction,
        invoice: null,
        confidence: 0,
        matchReason: 'Ausgabe-Transaktion (keine Zuordnung)',
      });
      continue;
    }

    let bestMatch: MatchableInvoice | null = null;
    let bestConfidence = 0;
    let bestReason = 'Keine passende Rechnung gefunden';

    // Extract invoice numbers from reference
    const invoiceNumbers = extractInvoiceNumbers(transaction.reference);

    // If reference contains invoice numbers, check ALL invoices (including paid)
    // to see if there's a specific reference match that we should honor
    let hasExplicitReference = false;
    if (invoiceNumbers.length > 0) {
      // Check if any invoice number in reference matches ANY invoice (including paid)
      for (const inv of invoices) {
        if (invoiceNumbers.some((num) => num.toUpperCase() === inv.invoiceNumber.toUpperCase())) {
          hasExplicitReference = true;
          // Only match if it's an open invoice
          if (openInvoices.includes(inv)) {
            bestMatch = inv;
            bestConfidence = 0.95;
            bestReason = `Rechnungsnummer ${inv.invoiceNumber} im Verwendungszweck gefunden`;
          }
          break;
        }
      }
    }

    // Only do amount-based matching if there was no explicit invoice reference
    if (!hasExplicitReference) {
      for (const invoice of openInvoices) {
        // Check: Exact amount match
        const amountMatches = Math.abs(transaction.amount - invoice.grossAmount) < 0.01;

        if (amountMatches) {
          // Check customer name similarity
          const customerName = invoice.customer?.companyName || '';
          const nameSimilarity = calculateStringSimilarity(transaction.counterparty, customerName);

          // Require higher similarity (0.7) for amount+name match
          if (nameSimilarity >= 0.7) {
            // Amount + name match (medium confidence)
            const confidence = 0.6 + nameSimilarity * 0.28; // 0.6 - 0.88
            if (confidence > bestConfidence) {
              bestMatch = invoice;
              bestConfidence = confidence;
              bestReason = `Betrag stimmt ueberein (${invoice.grossAmount}) und Kundenname aehnlich`;
            }
          } else {
            // Amount only match (lower confidence)
            const confidence = 0.3 + nameSimilarity * 0.2; // 0.3 - 0.5
            if (confidence > bestConfidence) {
              bestMatch = invoice;
              bestConfidence = confidence;
              bestReason = `Betrag stimmt ueberein (${invoice.grossAmount})`;
            }
          }
        }
      }
    }

    results.push({
      transaction,
      invoice: bestMatch,
      confidence: bestConfidence,
      matchReason: bestReason,
    });
  }

  return results;
}
