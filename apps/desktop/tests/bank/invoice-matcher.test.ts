/**
 * Tests for Invoice Matching Algorithm.
 *
 * Tests matching bank transactions with open invoices based on:
 * 1. Invoice number in reference (highest confidence)
 * 2. Exact amount + similar customer name
 * 3. Exact amount alone (lower confidence)
 *
 * @module tests/bank/invoice-matcher
 */

import { describe, it, expect } from 'vitest';
import {
  matchTransactions,
  calculateStringSimilarity,
  extractInvoiceNumbers,
} from '../../src/lib/bank/invoice-matcher';
import { BankTransaction } from '../../src/lib/bank/csv-parser';

// Mock invoice type for testing
interface MockInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  grossAmount: number;
  status: string;
  customer?: {
    companyName: string;
  };
}

describe('Invoice Matcher', () => {
  describe('calculateStringSimilarity', () => {
    it('should return 1 for identical strings', () => {
      expect(calculateStringSimilarity('test', 'test')).toBe(1);
    });

    it('should return 1 for identical strings ignoring case', () => {
      expect(calculateStringSimilarity('Test', 'test')).toBe(1);
    });

    it('should return 0 for completely different strings', () => {
      expect(calculateStringSimilarity('abc', 'xyz')).toBe(0);
    });

    it('should return partial match for similar strings', () => {
      const similarity = calculateStringSimilarity('Mueller GmbH', 'Mueller');
      expect(similarity).toBeGreaterThan(0.5);
      expect(similarity).toBeLessThan(1);
    });

    it('should handle empty strings', () => {
      expect(calculateStringSimilarity('', '')).toBe(1);
      expect(calculateStringSimilarity('test', '')).toBe(0);
      expect(calculateStringSimilarity('', 'test')).toBe(0);
    });

    it('should normalize umlauts for comparison', () => {
      const similarity = calculateStringSimilarity('Mueller', 'Müller');
      expect(similarity).toBeGreaterThan(0.8);
    });
  });

  describe('extractInvoiceNumbers', () => {
    it('should extract invoice number with RE- prefix', () => {
      const result = extractInvoiceNumbers('Zahlung RE-2024-001 fuer Beratung');
      expect(result).toContain('RE-2024-001');
    });

    it('should extract invoice number with INV- prefix', () => {
      const result = extractInvoiceNumbers('Payment for INV-2024-0042');
      expect(result).toContain('INV-2024-0042');
    });

    it('should extract invoice number with RG prefix', () => {
      const result = extractInvoiceNumbers('RG2024001 bezahlt');
      expect(result).toContain('RG2024001');
    });

    it('should extract multiple invoice numbers', () => {
      const result = extractInvoiceNumbers('RE-2024-001 und RE-2024-002');
      expect(result).toContain('RE-2024-001');
      expect(result).toContain('RE-2024-002');
    });

    it('should extract invoice number with Rechnung prefix', () => {
      const result = extractInvoiceNumbers('Rechnung 2024/0042 bezahlt');
      expect(result).toContain('2024/0042');
    });

    it('should return empty array for no matches', () => {
      const result = extractInvoiceNumbers('Miete Maerz');
      expect(result).toHaveLength(0);
    });
  });

  describe('matchTransactions', () => {
    const mockInvoices: MockInvoice[] = [
      {
        id: 'inv-1',
        invoiceNumber: 'RE-2024-001',
        customerId: 'cust-1',
        grossAmount: 1234.56,
        status: 'PENDING',
        customer: { companyName: 'Max Mustermann GmbH' },
      },
      {
        id: 'inv-2',
        invoiceNumber: 'INV-2024-0042',
        customerId: 'cust-2',
        grossAmount: 2500.0,
        status: 'PENDING',
        customer: { companyName: 'Kunde ABC' },
      },
      {
        id: 'inv-3',
        invoiceNumber: 'RE-2024-003',
        customerId: 'cust-3',
        grossAmount: 500.0,
        status: 'PENDING',
        customer: { companyName: 'Schmidt und Partner' },
      },
      {
        id: 'inv-4',
        invoiceNumber: 'RE-2024-004',
        customerId: 'cust-4',
        grossAmount: 500.0,
        status: 'PAID', // Already paid
        customer: { companyName: 'Bereits Bezahlt GmbH' },
      },
    ];

    const mockTransactions: BankTransaction[] = [
      {
        date: new Date('2024-03-15'),
        description: 'GUTSCHR',
        reference: 'RE-2024-001 Zahlung fuer Beratung',
        amount: 1234.56,
        counterparty: 'Max Mustermann GmbH',
      },
      {
        date: new Date('2024-03-16'),
        description: 'GUTSCHR',
        reference: 'INV-2024-0042 Projektarbeit',
        amount: 2500.0,
        counterparty: 'Kunde ABC',
        iban: 'DE98765432109876543210',
      },
      {
        date: new Date('2024-03-17'),
        description: 'GUTSCHR',
        reference: 'Zahlung ohne Referenz',
        amount: 500.0,
        counterparty: 'Schmidt Partner', // Slightly different name
      },
      {
        date: new Date('2024-03-18'),
        description: 'LASTSCHRIFT',
        reference: 'Miete Maerz',
        amount: -800.0,
        counterparty: 'Vermieter AG',
      },
    ];

    it('should match transaction by invoice number in reference (highest confidence)', () => {
      const results = matchTransactions(mockTransactions, mockInvoices as any);

      const match1 = results.find((r) => r.transaction.reference.includes('RE-2024-001'));
      expect(match1).toBeDefined();
      expect(match1!.invoice).toBeDefined();
      expect(match1!.invoice!.invoiceNumber).toBe('RE-2024-001');
      expect(match1!.confidence).toBeGreaterThanOrEqual(0.9);
      expect(match1!.matchReason).toContain('Rechnungsnummer');
    });

    it('should match transaction by amount + similar customer name', () => {
      const results = matchTransactions(mockTransactions, mockInvoices as any);

      const match3 = results.find((r) => r.transaction.counterparty === 'Schmidt Partner');
      expect(match3).toBeDefined();
      expect(match3!.invoice).toBeDefined();
      expect(match3!.invoice!.invoiceNumber).toBe('RE-2024-003');
      expect(match3!.confidence).toBeGreaterThan(0.5);
      expect(match3!.confidence).toBeLessThan(0.9);
    });

    it('should not match expense transactions (negative amounts)', () => {
      const results = matchTransactions(mockTransactions, mockInvoices as any);

      const expenseMatch = results.find((r) => r.transaction.amount < 0);
      expect(expenseMatch).toBeDefined();
      expect(expenseMatch!.invoice).toBeNull();
    });

    it('should not match already paid invoices', () => {
      const transactionsWithPaid: BankTransaction[] = [
        {
          date: new Date('2024-03-19'),
          description: 'GUTSCHR',
          reference: 'RE-2024-004 Zahlung',
          amount: 500.0,
          counterparty: 'Bereits Bezahlt GmbH',
        },
      ];

      const results = matchTransactions(transactionsWithPaid, mockInvoices as any);
      expect(results[0].invoice).toBeNull();
    });

    it('should handle empty transactions array', () => {
      const results = matchTransactions([], mockInvoices as any);
      expect(results).toHaveLength(0);
    });

    it('should handle empty invoices array', () => {
      const results = matchTransactions(mockTransactions, []);
      expect(results).toHaveLength(mockTransactions.length);
      results.forEach((r) => expect(r.invoice).toBeNull());
    });

    it('should return all transactions with their match status', () => {
      const results = matchTransactions(mockTransactions, mockInvoices as any);
      expect(results).toHaveLength(mockTransactions.length);
    });

    it('should prefer invoice number match over amount+name match', () => {
      const invoicesWithSameAmount: MockInvoice[] = [
        {
          id: 'inv-a',
          invoiceNumber: 'RE-2024-099',
          customerId: 'cust-a',
          grossAmount: 1000.0,
          status: 'PENDING',
          customer: { companyName: 'Test Firma' },
        },
        {
          id: 'inv-b',
          invoiceNumber: 'RE-2024-100',
          customerId: 'cust-b',
          grossAmount: 1000.0,
          status: 'PENDING',
          customer: { companyName: 'Andere Firma' },
        },
      ];

      const transactionsWithRef: BankTransaction[] = [
        {
          date: new Date('2024-03-20'),
          description: 'GUTSCHR',
          reference: 'RE-2024-100 bezahlt',
          amount: 1000.0,
          counterparty: 'Test Firma', // Name matches inv-a but reference matches inv-b
        },
      ];

      const results = matchTransactions(transactionsWithRef, invoicesWithSameAmount as any);
      expect(results[0].invoice!.invoiceNumber).toBe('RE-2024-100');
    });

    it('should match with exact amount only if no better match (lowest confidence)', () => {
      const invoicesForAmountMatch: MockInvoice[] = [
        {
          id: 'inv-x',
          invoiceNumber: 'RE-2024-200',
          customerId: 'cust-x',
          grossAmount: 777.77,
          status: 'PENDING',
          customer: { companyName: 'Komplett Andere Firma XYZ' },
        },
      ];

      const transactionsForAmountMatch: BankTransaction[] = [
        {
          date: new Date('2024-03-21'),
          description: 'GUTSCHR',
          reference: 'Keine relevante Info',
          amount: 777.77,
          counterparty: 'Unbekannter Absender',
        },
      ];

      const results = matchTransactions(transactionsForAmountMatch, invoicesForAmountMatch as any);
      expect(results[0].invoice).toBeDefined();
      expect(results[0].confidence).toBeLessThanOrEqual(0.5);
      expect(results[0].matchReason).toContain('Betrag');
    });
  });

  describe('Match confidence levels', () => {
    it('should give confidence >= 0.9 for invoice number match', () => {
      const invoices: MockInvoice[] = [
        {
          id: 'inv-1',
          invoiceNumber: 'RE-2024-001',
          customerId: 'cust-1',
          grossAmount: 100.0,
          status: 'PENDING',
          customer: { companyName: 'Test' },
        },
      ];

      const transactions: BankTransaction[] = [
        {
          date: new Date(),
          description: 'GUTSCHR',
          reference: 'RE-2024-001',
          amount: 100.0,
          counterparty: 'Jemand',
        },
      ];

      const results = matchTransactions(transactions, invoices as any);
      expect(results[0].confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should give confidence 0.6-0.89 for amount + name match', () => {
      const invoices: MockInvoice[] = [
        {
          id: 'inv-1',
          invoiceNumber: 'RE-2024-001',
          customerId: 'cust-1',
          grossAmount: 100.0,
          status: 'PENDING',
          customer: { companyName: 'Mueller GmbH' },
        },
      ];

      const transactions: BankTransaction[] = [
        {
          date: new Date(),
          description: 'GUTSCHR',
          reference: 'Zahlung',
          amount: 100.0,
          counterparty: 'Mueller GmbH',
        },
      ];

      const results = matchTransactions(transactions, invoices as any);
      expect(results[0].confidence).toBeGreaterThanOrEqual(0.6);
      expect(results[0].confidence).toBeLessThan(0.9);
    });

    it('should give confidence 0.3-0.5 for amount only match', () => {
      const invoices: MockInvoice[] = [
        {
          id: 'inv-1',
          invoiceNumber: 'RE-2024-001',
          customerId: 'cust-1',
          grossAmount: 123.45,
          status: 'PENDING',
          customer: { companyName: 'Firma A' },
        },
      ];

      const transactions: BankTransaction[] = [
        {
          date: new Date(),
          description: 'GUTSCHR',
          reference: 'Ueberweisung',
          amount: 123.45,
          counterparty: 'Firma B', // Different name
        },
      ];

      const results = matchTransactions(transactions, invoices as any);
      expect(results[0].confidence).toBeGreaterThanOrEqual(0.3);
      expect(results[0].confidence).toBeLessThanOrEqual(0.5);
    });
  });
});
