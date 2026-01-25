import Papa from 'papaparse';
import { BankStatementParser, ParsedTransaction } from './types';

export class CsvParser implements BankStatementParser {
  async parse(content: string): Promise<ParsedTransaction[]> {
    return new Promise((resolve, reject) => {
      Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const transactions: ParsedTransaction[] = results.data
              .map((row: any) => this.mapRowToTransaction(row))
              .filter((t): t is ParsedTransaction => t !== null);
            resolve(transactions);
          } catch (e) {
            reject(e);
          }
        },
        error: (error: any) => {
          reject(error);
        }
      });
    });
  }

  private mapRowToTransaction(row: any): ParsedTransaction | null {
    const keys = Object.keys(row);
    const lowerKeys = keys.map(k => k.toLowerCase());

    const findKey = (candidates: string[]) => {
        const index = lowerKeys.findIndex(k => candidates.some(c => k.includes(c)));
        return index !== -1 ? keys[index] : null;
    };

    // Date
    const dateKey = findKey(['datum', 'date', 'buchungstag', 'valuta']);
    if (!dateKey) return null;

    // Amount
    const amountKey = findKey(['betrag', 'amount', 'saldo', 'umsatz']);
    if (!amountKey) return null;

    // Description
    const descKey = findKey(['verwendungszweck', 'description', 'text', 'buchungstext']);

    // Sender/Receiver Name
    const nameKey = findKey(['begünstigter', 'zahlunsgpflichtiger', 'name', 'partner']);

    // IBAN (Sender/Receiver)
    const ibanKey = findKey(['iban', 'konto']);

    // Currency
    const currencyKey = findKey(['währung', 'currency', 'waehrung']);

    // Parse Amount
    let amountStr = String(row[amountKey]).trim();
    // Normalize german number format: 1.234,56 -> 1234.56
    if (amountStr.includes(',') && amountStr.includes('.')) {
         // 1.000,00 or 1,000.00
         if (amountStr.lastIndexOf(',') > amountStr.lastIndexOf('.')) {
             // 1.000,00 -> remove dots, replace comma with dot
             amountStr = amountStr.replace(/\./g, '').replace(',', '.');
         } else {
             // 1,000.00 -> remove commas
             amountStr = amountStr.replace(/,/g, '');
         }
    } else if (amountStr.includes(',')) {
        // 100,00 -> 100.00
        amountStr = amountStr.replace(',', '.');
    }
    const amount = parseFloat(amountStr);
    if (isNaN(amount)) return null;

    // Parse Date
    let dateStr = String(row[dateKey]).trim();
    let date: Date;
    // Try DD.MM.YYYY
    const germanDateMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
    if (germanDateMatch) {
       let year = parseInt(germanDateMatch[3]);
       if (year < 100) year += 2000; // Assume 21st century for 2-digit years
       const month = parseInt(germanDateMatch[2]) - 1;
       const day = parseInt(germanDateMatch[1]);
       date = new Date(Date.UTC(year, month, day)); // Use UTC to avoid timezone shifts
    } else {
       date = new Date(dateStr);
    }

    if (isNaN(date.getTime())) return null;

    const currency = currencyKey ? String(row[currencyKey]).trim() : 'EUR';
    const description = descKey ? String(row[descKey]).trim() : '';
    const senderName = nameKey ? String(row[nameKey]).trim() : undefined;
    const senderIban = ibanKey ? String(row[ibanKey]).trim() : undefined;

    return {
      date,
      amount,
      currency,
      description,
      senderName,
      senderIban,
    };
  }
}
