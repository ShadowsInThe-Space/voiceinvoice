import { Invoice, BankTransaction, Customer } from '@prisma/client';
import levenshtein from 'fast-levenshtein';

export interface MatchResult {
  transactionId: string;
  invoiceId: string;
  confidence: number;
  reasons: string[];
}

export type InvoiceWithCustomer = Invoice & { customer: Customer };

export class TransactionMatcher {
  private static AMOUNT_TOLERANCE = 0.05;
  private static NAME_SIMILARITY_THRESHOLD = 0.6;

  match(transaction: BankTransaction, invoices: InvoiceWithCustomer[]): MatchResult | null {
    let bestMatch: MatchResult | null = null;

    for (const invoice of invoices) {
      // Skip invoices that are already paid or cancelled, UNLESS we are specifically looking for duplicates?
      // Usually we match against OPEN invoices (SENT, OVERDUE, DRAFT?).
      // Let's assume the filtering happens before calling this, or we check here.
      // But typically, we might want to match against a PAID invoice if it was manually marked paid but not linked.
      // For now, I'll calculate score regardless of status, but the caller should filter.

      const match = this.calculateMatch(transaction, invoice);
      if (match) {
        if (!bestMatch || match.confidence > bestMatch.confidence) {
          bestMatch = match;
        }
      }
    }

    return bestMatch;
  }

  private calculateMatch(transaction: BankTransaction, invoice: InvoiceWithCustomer): MatchResult | null {
    const reasons: string[] = [];
    let confidence = 0.0;

    // Normalize strings
    const purpose = (transaction.purpose || '').toLowerCase();
    const invNumber = invoice.number.toLowerCase();
    const counterparty = (transaction.counterparty || '').toLowerCase();
    const customerName = invoice.customer.name.toLowerCase();

    // 1. Invoice Number Match (Strongest Signal)
    // Check for word boundary or distinct match to avoid "INV-1" matching "INV-10"
    // Simple substring is risky.
    // Let's assume invoice numbers are distinct enough or we check for boundaries.
    // A simple regex `\b${invNumber}\b` might work if separators are standard.
    if (invNumber && purpose.includes(invNumber)) {
      confidence += 0.9;
      reasons.push(`Invoice number ${invoice.number} found in purpose`);
    }

    // 2. Amount Match
    const amountDiff = Math.abs(transaction.amount - invoice.total);
    const isAmountMatch = amountDiff <= TransactionMatcher.AMOUNT_TOLERANCE;

    if (isAmountMatch) {
      confidence += 0.4;
      reasons.push('Exact amount match');
    }

    // 3. Customer Name Fuzzy Match
    let nameMatchScore = 0;
    const distance = levenshtein.get(counterparty, customerName);
    const maxLength = Math.max(counterparty.length, customerName.length);
    const similarity = maxLength > 0 ? 1 - (distance / maxLength) : 0;

    if (similarity > TransactionMatcher.NAME_SIMILARITY_THRESHOLD) {
      nameMatchScore = 0.3;
      reasons.push(`Customer name similarity: ${(similarity * 100).toFixed(0)}%`);
    } else if (counterparty.includes(customerName) || customerName.includes(counterparty)) {
      // Substring fallback
      nameMatchScore = 0.2;
      reasons.push('Name substring match');
    }
    confidence += nameMatchScore;

    // 4. Sanity check / Date Check?
    // If transaction is BEFORE invoice issue date? Possible (prepayment).
    // If transaction is way after? Possible.

    if (confidence > 0.0) {
      return {
        transactionId: transaction.id,
        invoiceId: invoice.id,
        confidence: Math.min(confidence, 1.0),
        reasons
      };
    }

    return null;
  }
}
