import { BankStatementParser, ParsedTransaction } from './types';

export class Mt940Parser implements BankStatementParser {
  async parse(content: string): Promise<ParsedTransaction[]> {
    const transactions: ParsedTransaction[] = [];
    const lines = content.split(/\r?\n/);

    let accountIban: string | undefined;
    let currentTransaction: Partial<ParsedTransaction> | null = null;
    let pendingDescription = false;

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      if (line.startsWith(':25:')) {
        // Account Identification
        // :25:DE12345...
        // Can be account number or IBAN. Removing spaces and slashes.
        accountIban = line.substring(4).replace(/[\/\s]/g, '').trim();
      }
      else if (line.startsWith(':61:')) {
        // Finish previous transaction
        if (currentTransaction && this.isValid(currentTransaction)) {
           transactions.push(currentTransaction as ParsedTransaction);
        }

        currentTransaction = {
            currency: 'EUR', // Default
            accountIban,
            description: ''
        };
        pendingDescription = false;

        // Parse :61:
        // Structure: :61:YYMMDD[MMDD]D/CAMOUNTN[REF]
        const raw = line.substring(4);

        // First 6 chars: YYMMDD
        if (raw.length < 10) continue; // Safety check
        const dateStr = raw.substring(0, 6);

        // Check for optional Entry Date (4 digits)
        let cursor = 6;
        if (/^\d{4}/.test(raw.substring(cursor))) {
            cursor += 4; // Skip Entry Date
        }

        // Debit/Credit Mark: D, C, RD, RC
        const dcMatch = raw.substring(cursor).match(/^([A-Z]{1,2})/);
        if (!dcMatch) continue;
        const mark = dcMatch[1];
        cursor += mark.length;

        // Amount: digits, comma, digits.
        // Sometimes comma is not there if integer? MT940 usually requires comma.
        // It ends when next field starts. Next field starts with N, F, or S (Swift Type).
        // Actually, amount is defined as comma separated.
        const amountMatch = raw.substring(cursor).match(/^([\d,]+)([A-Z])?/);
        if (!amountMatch) continue;

        const amountStr = amountMatch[1].replace(',', '.');
        let amount = parseFloat(amountStr);
        if (isNaN(amount)) continue;

        // If Debit, negative
        if (mark === 'D' || mark === 'RD') {
            amount = -Math.abs(amount);
        } else {
            amount = Math.abs(amount);
        }

        currentTransaction.amount = amount;

        // Date Parsing
        const yy = parseInt(dateStr.substring(0, 2));
        const mm = parseInt(dateStr.substring(2, 4)) - 1;
        const dd = parseInt(dateStr.substring(4, 6));
        const year = 2000 + yy;
        currentTransaction.date = new Date(Date.UTC(year, mm, dd));

        // Capture reference (optional)
        if (amountMatch[2]) {
            currentTransaction.reference = raw.substring(cursor + amountMatch[0].length);
        }
      }
      else if (line.startsWith(':86:')) {
         if (currentTransaction) {
             const desc = line.substring(4);
             currentTransaction.description = (currentTransaction.description ? currentTransaction.description + ' ' : '') + desc;
             pendingDescription = true;
         }
      }
      else if (line.startsWith(':')) {
          // New tag, stop pending description
          pendingDescription = false;
      }
      else if (pendingDescription && currentTransaction) {
         // Continuation line (no tag at start)
         currentTransaction.description += ' ' + line;
      }
    }

    // Push last
    if (currentTransaction && this.isValid(currentTransaction)) {
        transactions.push(currentTransaction as ParsedTransaction);
    }

    return transactions;
  }

  private isValid(t: Partial<ParsedTransaction>): boolean {
      return t.date !== undefined && t.amount !== undefined;
  }
}
