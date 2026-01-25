import { PrismaClient } from '@prisma/client';
import { CsvParser } from './parsers/CsvParser';
import { Mt940Parser } from './parsers/Mt940Parser';
import { ParsedTransaction } from './parsers/types';

export class BankService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async importTransactions(content: string, format: 'CSV' | 'MT940', fileName?: string): Promise<{ imported: number, skipped: number }> {
    let parser;
    if (format === 'CSV') {
      parser = new CsvParser();
    } else {
      parser = new Mt940Parser();
    }

    const transactions = await parser.parse(content);

    // Group transactions by account IBAN
    const transactionsByIban = new Map<string, ParsedTransaction[]>();
    // If we can't find an IBAN, we'll try to deduce it or use a placeholder that user can rename later.
    // Ideally we would return parsed transactions to UI and ask user to map to account, but that's out of scope for "Import Function" subtask if we want automation.
    // I'll use a placeholder "MANUAL_IMPORT" if no IBAN found.
    const defaultIban = 'MANUAL_IMPORT_' + (fileName ? fileName.replace(/\W/g, '_') : 'UNKNOWN');

    for (const t of transactions) {
        const key = t.accountIban || defaultIban;
        const list = transactionsByIban.get(key) || [];
        list.push(t);
        transactionsByIban.set(key, list);
    }

    let importedCount = 0;
    let skippedCount = 0;

    for (const [iban, transList] of transactionsByIban.entries()) {
        // Find or create account
        let account = await this.prisma.bankAccount.findUnique({
            where: { iban }
        });

        if (!account) {
            account = await this.prisma.bankAccount.create({
                data: {
                    iban,
                    bankName: 'Imported Account',
                    accountHolder: 'Unknown'
                }
            });
        }

        for (const t of transList) {
            // Check duplicate: Account + Date + Amount + Description (Partial)
            // Using findFirst over large datasets might be slow, but for local SQLite it's fine.
            const existing = await this.prisma.bankTransaction.findFirst({
                where: {
                    bankAccountId: account.id,
                    date: t.date,
                    amount: t.amount,
                    description: t.description,
                }
            });

            if (existing) {
                skippedCount++;
                continue;
            }

            await this.prisma.bankTransaction.create({
                data: {
                    bankAccountId: account.id,
                    date: t.date,
                    amount: t.amount,
                    currency: t.currency,
                    description: t.description,
                    senderName: t.senderName,
                    senderIban: t.senderIban,
                    reference: t.reference,
                    status: 'PENDING'
                }
            });
            importedCount++;
        }
    }

    return { imported: importedCount, skipped: skippedCount };
  }

  async getTransactions() {
      return this.prisma.bankTransaction.findMany({
          include: { bankAccount: true },
          orderBy: { date: 'desc' }
      });
  }
}
