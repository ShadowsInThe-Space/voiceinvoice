import { PrismaClient, BankTransaction, Invoice, Customer } from '@prisma/client';
import { CsvParser, Mt940Parser, detectFormat, BankStatementParser } from './parser';
import { TransactionMatcher, MatchResult, InvoiceWithCustomer } from './matcher';

export class BankService {
  private prisma: PrismaClient;
  private matcher: TransactionMatcher;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.matcher = new TransactionMatcher();
  }

  /**
   * Imports bank transactions from a file content.
   * Detects format (CSV/MT940) automatically.
   */
  async importTransactions(content: string, fileName?: string): Promise<BankTransaction[]> {
    const format = detectFormat(content);
    let parser: BankStatementParser;

    if (format === 'CSV') {
      parser = new CsvParser();
    } else if (format === 'MT940') {
      parser = new Mt940Parser();
    } else {
      throw new Error(`Unsupported format or unable to detect format for file: ${fileName}`);
    }

    const data = await parser.parse(content);
    const savedTransactions: BankTransaction[] = [];

    // Save transactions
    // We process sequentially to avoid potential race conditions if run in parallel logic
    for (const item of data) {
      // Basic duplicate check
      const existing = await this.prisma.bankTransaction.findFirst({
        where: {
            transactionDate: item.transactionDate,
            amount: item.amount,
            counterparty: item.counterparty,
            // purpose is often messy, so we rely on date, amount, and counterparty
        }
      });

      if (!existing) {
        const created = await this.prisma.bankTransaction.create({
            data: {
                transactionDate: item.transactionDate,
                valueDate: item.valueDate,
                counterparty: item.counterparty,
                counterpartyIban: item.counterpartyIban,
                amount: item.amount,
                currency: item.currency,
                purpose: item.purpose,
                sourceFile: fileName,
                reconciled: false,
                matchConfidence: 0,
            }
        });
        savedTransactions.push(created);
      }
    }

    // Auto-match after import
    if (savedTransactions.length > 0) {
      await this.autoMatch(savedTransactions);
    }

    return savedTransactions;
  }

  /**
   * Runs the matching algorithm on unreconciled transactions.
   * If transactions are provided, only matches those.
   */
  async autoMatch(transactions?: BankTransaction[]) {
    const targetTransactions = transactions || await this.prisma.bankTransaction.findMany({
        where: { reconciled: false }
    });

    if (targetTransactions.length === 0) return;

    // Get candidate invoices: SENT, OVERDUE, and DRAFT (sometimes created but not sent yet)
    // Also we assume 1:1 matching, so exclude invoices already linked
    // We need to cast the result or rely on inference.
    // Prisma types can be tricky with include.
    const invoices = await this.prisma.invoice.findMany({
        where: {
            status: { in: ['SENT', 'OVERDUE', 'DRAFT'] },
            bankTransaction: { is: null }
        },
        include: { customer: true }
    });

    // Cast to expected type (Prisma generated types should match)
    const candidates = invoices as unknown as InvoiceWithCustomer[];
    const matchedInvoiceIds = new Set<string>();

    for (const txn of targetTransactions) {
        if (txn.reconciled) continue;

        // Filter out invoices already matched in this batch to prevent Unique Constraint Violation
        const availableInvoices = candidates.filter(inv => !matchedInvoiceIds.has(inv.id));

        const match = this.matcher.match(txn, availableInvoices);

        // If high confidence, we could auto-link, but usually user approval is safer.
        // For now, we update the suggestion fields on the transaction.
        // If confidence > 0.95 (e.g. Invoice Number match), maybe auto-link?
        // Let's stick to suggesting (storing match) and let UI confirm, unless very high.

        if (match) {
            await this.prisma.bankTransaction.update({
                where: { id: txn.id },
                data: {
                    matchConfidence: match.confidence,
                    matchedInvoiceId: match.invoiceId
                }
            });
            matchedInvoiceIds.add(match.invoiceId);

            // If EXTREMELY high confidence, we might consider auto-reconcile logic here
            // but requirements didn't specify auto-approve. "Matching-Algorithmus" implies finding matches.
        }
    }
  }

  /**
   * Confirms a match and updates both transaction and invoice.
   */
  async confirmMatch(transactionId: string, invoiceId: string) {
      // Verify they exist
      const txn = await this.prisma.bankTransaction.findUnique({ where: { id: transactionId }});
      const inv = await this.prisma.invoice.findUnique({ where: { id: invoiceId }});

      if (!txn || !inv) throw new Error('Transaction or Invoice not found');
      if (txn.reconciled) throw new Error('Transaction already reconciled');

      // Use transaction
      await this.prisma.$transaction(async (tx) => {
          await tx.bankTransaction.update({
              where: { id: transactionId },
              data: {
                  matchedInvoiceId: invoiceId,
                  reconciled: true,
                  matchConfidence: 1.0 // Confirmed by user
              }
          });

          await tx.invoice.update({
              where: { id: invoiceId },
              data: {
                  status: 'PAID',
                  paidAt: new Date()
              }
          });
      });
  }

  /**
   * Gets all unreconciled transactions for the UI.
   */
  async getUnreconciled() {
      return this.prisma.bankTransaction.findMany({
          where: { reconciled: false },
          orderBy: { transactionDate: 'desc' },
          include: { matchedInvoice: { include: { customer: true } } }
      });
  }
}
