import { describe, it, expect } from 'vitest';
import { CsvParser, detectFormat } from '../src/lib/bank/parser';
import { TransactionMatcher, InvoiceWithCustomer } from '../src/lib/bank/matcher';
import { BankTransaction, Invoice, Customer } from '@prisma/client';

describe('Bank Import - Parser', () => {
  it('should detect CSV format', () => {
    const csv = 'Date,Amount,Currency\n2023-01-01,100,EUR';
    expect(detectFormat(csv)).toBe('CSV');
  });

  it('should parse CSV correctly', async () => {
    const csv = `Date,Amount,Payee,Description
2023-01-01,100.00,Test Customer,Invoice INV-001 Payment`;

    const parser = new CsvParser();
    const result = await parser.parse(csv);

    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(100);
    expect(result[0].counterparty).toBe('Test Customer');
    expect(result[0].purpose).toBe('Invoice INV-001 Payment');
  });

  it('should handle German decimal comma', async () => {
      const csv = `Date,Amount,Payee
2023-01-01,"100,50",Test`;
      const parser = new CsvParser();
      const result = await parser.parse(csv);
      expect(result[0].amount).toBe(100.50);
  });

  it('should handle German thousands separator', async () => {
      const csv = `Date,Amount,Payee
2023-01-01,"1.000,50",Test`;
      const parser = new CsvParser();
      const result = await parser.parse(csv);
      expect(result[0].amount).toBe(1000.50);
  });
});

describe('Bank Import - Matcher', () => {
  const matcher = new TransactionMatcher();

  const customer: Customer = {
    id: 'cust1', name: 'Acme Corp', email: null, phone: null, address: null,
    city: null, zipCode: null, country: 'DE', taxId: null, notes: null,
    createdAt: new Date(), updatedAt: new Date(), syncVersion: 0, deletedAt: null
  };

  const invoice: InvoiceWithCustomer = {
    id: 'inv1', number: 'INV-001', customerId: 'cust1', subtotal: 100, taxRate: 19,
    taxAmount: 19, total: 119, currency: 'EUR', status: 'SENT',
    issuedAt: new Date(), dueAt: new Date(), paidAt: null,
    voiceRecordingId: null, transcription: null, notes: null, paymentTerms: null,
    createdAt: new Date(), updatedAt: new Date(), syncVersion: 0, deletedAt: null,
    customer: customer
  };

  it('should match exactly by amount and approximate name', () => {
    const txn = {
      id: 'tx1', importDate: new Date(), sourceFile: null, transactionDate: new Date(), valueDate: new Date(),
      counterparty: 'Acme Corp', counterpartyIban: null, amount: 119, currency: 'EUR', purpose: 'Payment',
      matchedInvoiceId: null, matchConfidence: null, reconciled: false,
      createdAt: new Date(), updatedAt: new Date(), syncVersion: 0
    } as BankTransaction;

    const match = matcher.match(txn, [invoice]);
    expect(match).not.toBeNull();
    expect(match?.invoiceId).toBe(invoice.id);
    expect(match?.confidence).toBeGreaterThan(0.6); // Amount (0.4) + Name (0.3) = 0.7
  });

  it('should match by invoice number in purpose', () => {
    const txn = {
      id: 'tx2', importDate: new Date(), sourceFile: null, transactionDate: new Date(), valueDate: new Date(),
      counterparty: 'Unknown', counterpartyIban: null, amount: 119, currency: 'EUR', purpose: 'Ref: INV-001',
      matchedInvoiceId: null, matchConfidence: null, reconciled: false,
      createdAt: new Date(), updatedAt: new Date(), syncVersion: 0
    } as BankTransaction;

    const match = matcher.match(txn, [invoice]);
    expect(match).not.toBeNull();
    // reasons is array of string
    expect(JSON.stringify(match?.reasons)).toContain('Invoice number INV-001');
    expect(match?.confidence).toBeGreaterThan(0.8);
  });

  it('should return low confidence if amount mismatch significantly', () => {
      const txn = {
      id: 'tx3', importDate: new Date(), sourceFile: null, transactionDate: new Date(), valueDate: new Date(),
      counterparty: 'Acme Corp', counterpartyIban: null, amount: 50, currency: 'EUR', purpose: 'Payment',
      matchedInvoiceId: null, matchConfidence: null, reconciled: false,
      createdAt: new Date(), updatedAt: new Date(), syncVersion: 0
    } as BankTransaction;

    const match = matcher.match(txn, [invoice]);
    // Name match gives 0.3, but amount mismatch prevents higher score
    expect(match).not.toBeNull();
    expect(match?.confidence).toBeLessThan(0.4);
  });
});
