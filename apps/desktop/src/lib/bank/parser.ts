import { parse } from 'csv-parse/sync';
// @ts-ignore
import mt940js from 'mt940js';
import { BankTransactionDataInput } from '@voiceinvoice/shared-types';

export interface BankStatementParser {
  parse(content: string): Promise<BankTransactionDataInput[]>;
}

export class CsvParser implements BankStatementParser {
  async parse(content: string): Promise<BankTransactionDataInput[]> {
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
    });

    return records.map((record: any) => {
      // Heuristic mapping for common CSV headers (English and German)
      const amountStr = record.Amount || record.amount || record.Betrag || record['Amount (EUR)'] || '0';
      const amount = this.parseAmount(amountStr);

      const dateStr = record.Date || record.date || record.Datum || record.Buchungstag;
      const date = dateStr ? new Date(dateStr) : new Date();

      const counterparty =
        record.Payee ||
        record.payee ||
        record.Empfaenger ||
        record.Beguenstigter ||
        record['Name/Bezeichnung'] ||
        'Unknown';

      const iban = record.IBAN || record.iban || record.Iban || record['IBAN/Account'];

      const currency =
        record.Currency ||
        record.currency ||
        record.Waehrung ||
        'EUR';

      const purpose =
        record.Description ||
        record.description ||
        record.Verwendungszweck ||
        record.Buchungstext;

      if (isNaN(amount)) {
        return null;
      }

      return {
        transactionDate: date,
        valueDate: date, // Default to transaction date if missing
        counterparty: counterparty,
        counterpartyIban: iban,
        amount: amount,
        currency: currency,
        purpose: purpose,
      } as BankTransactionDataInput;
    }).filter((t: any): t is BankTransactionDataInput => t !== null);
  }

  private parseAmount(value: string): number {
    let clean = value.replace(/[^\d.,-]/g, ''); // keep digits, dots, commas, minus
    // Move trailing minus to front
    if (clean.endsWith('-')) {
        clean = '-' + clean.slice(0, -1);
    }

    // Guess format
    const commaIndex = clean.lastIndexOf(',');
    const dotIndex = clean.lastIndexOf('.');

    if (commaIndex > dotIndex) {
        // 1.000,50 -> remove dots, replace comma with dot
        clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (dotIndex > commaIndex) {
        // 1,000.50 -> remove commas
        clean = clean.replace(/,/g, '');
    } else {
        // No mixed separators.
        // If comma exists: assume decimal (DE default)
        if (clean.includes(',')) {
             clean = clean.replace(',', '.');
        }
    }
    return parseFloat(clean);
  }
}

export class Mt940Parser implements BankStatementParser {
  async parse(content: string): Promise<BankTransactionDataInput[]> {
    const parser = new mt940js.Parser();
    const statements = parser.parse(content);
    const transactions: BankTransactionDataInput[] = [];

    for (const stmt of statements) {
      for (const txn of stmt.transactions) {
        // MT940js returns date as Date object
        // Amount is number
        // Currency is string

        // Extract counterparty from details if possible, otherwise use a placeholder
        // Real-world MT940 parsing for counterparty is complex (SEPA tags)
        // We'll use the details field as purpose and try to find a name

        transactions.push({
          transactionDate: txn.date,
          valueDate: txn.entryDate || txn.date,
          counterparty: 'Bank Transaction', // Hard to extract without deep parsing of SEPA tags
          amount: txn.amount,
          currency: txn.currency,
          purpose: txn.details,
        });
      }
    }
    return transactions;
  }
}

export function detectFormat(content: string): 'CSV' | 'MT940' | 'UNKNOWN' {
  if (content.includes(':20:') && content.includes(':25:')) {
    return 'MT940';
  }
  // Simple CSV check (header row or commas)
  const lines = content.split('\n');
  if (lines.length > 0 && (lines[0].includes(',') || lines[0].includes(';'))) {
    return 'CSV';
  }
  return 'UNKNOWN';
}
