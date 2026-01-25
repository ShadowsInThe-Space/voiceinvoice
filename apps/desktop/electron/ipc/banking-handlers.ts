/**
 * IPC Handlers for Banking Operations
 *
 * Provides IPC handlers for CSV import and invoice matching.
 *
 * @module electron/ipc/banking-handlers
 */

import { dialog } from 'electron';
import { PrismaClient } from '@prisma/client';
import { BankingService } from '../../src/lib/banking/banking-service';

/**
 * Context for banking IPC handlers.
 */
export interface BankingIpcContext {
  prisma: PrismaClient;
  bankingService: BankingService;
}

/**
 * API result wrapper for consistent response format.
 */
interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: { message: string };
}

/**
 * Creates a success result.
 *
 * @param {T} data - Result data
 * @returns {ApiResult<T>} Success result
 */
function success<T>(data: T): ApiResult<T> {
  return { success: true, data };
}

/**
 * Creates an error result.
 *
 * @param {string} message - Error message
 * @returns {ApiResult<never>} Error result
 */
function error(message: string): ApiResult<never> {
  return { success: false, error: { message } };
}

/**
 * Opens file dialog to select CSV files.
 *
 * @returns {Promise<ApiResult<string[]>>} Selected file paths
 */
export async function selectCsvFilesHandler(): Promise<ApiResult<string[]>> {
  try {
    const result = await dialog.showOpenDialog({
      title: 'CSV-Dateien auswählen',
      filters: [
        { name: 'CSV-Dateien', extensions: ['csv'] },
        { name: 'Alle Dateien', extensions: ['*'] },
      ],
      properties: ['openFile', 'multiSelections'],
    });

    if (result.canceled) {
      return success([]);
    }

    return success(result.filePaths);
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Dateiauswahl fehlgeschlagen');
  }
}

/**
 * Opens folder dialog to select a directory.
 *
 * @returns {Promise<ApiResult<string | null>>} Selected folder path
 */
export async function selectFolderHandler(): Promise<ApiResult<string | null>> {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Ordner auswählen',
      properties: ['openDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return success(null);
    }

    return success(result.filePaths[0]);
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Ordnerauswahl fehlgeschlagen');
  }
}

/**
 * Imports transactions from a CSV file.
 *
 * @param {BankingIpcContext} ctx - Handler context
 * @param {string} filePath - Path to CSV file
 * @returns {Promise<ApiResult<{imported: number, duplicates: number, matched: number, errors: string[]}>>} Import result
 */
export async function importCsvHandler(
  ctx: BankingIpcContext,
  filePath: string
): Promise<ApiResult<{ imported: number; duplicates: number; matched: number; errors: string[] }>> {
  try {
    const transactions = ctx.bankingService.parseCsvFile(filePath);
    const fileName = filePath.split(/[\\/]/).pop() || filePath;

    let imported = 0;
    let duplicates = 0;
    let matched = 0;
    const errors: string[] = [];

    // Get unpaid invoices for matching
    const invoices = await ctx.prisma.invoice.findMany({
      where: {
        status: { in: ['SENT', 'OVERDUE'] },
        deletedAt: null,
      },
      include: {
        customer: true,
      },
    });

    const invoicesForMatching = invoices.map((inv) => ({
      id: inv.id,
      number: inv.number,
      customerName: inv.customer.name,
      total: inv.total,
    }));

    for (const tx of transactions) {
      try {
        // Check for duplicates (same date, amount, counterparty)
        const existing = await ctx.prisma.bankTransaction.findFirst({
          where: {
            transactionDate: tx.transactionDate,
            amount: tx.amount,
            counterparty: tx.counterparty,
            deletedAt: null,
          },
        });

        if (existing) {
          duplicates++;
          continue;
        }

        // Find potential matches
        const matchInput: { counterparty: string; amount: number; purpose?: string } = {
          counterparty: tx.counterparty,
          amount: tx.amount,
        };
        if (tx.purpose) {
          matchInput.purpose = tx.purpose;
        }

        const matches = ctx.bankingService.findMatches(matchInput, invoicesForMatching);

        // Only auto-match if confidence is very high
        const bestMatch = matches.length > 0 && matches[0].confidence >= 0.85 ? matches[0] : null;

        // Build data object conditionally to satisfy exactOptionalPropertyTypes
        const txData: Parameters<typeof ctx.prisma.bankTransaction.create>[0]['data'] = {
          transactionDate: tx.transactionDate,
          counterparty: tx.counterparty,
          amount: tx.amount,
          currency: tx.currency,
          sourceFile: fileName,
          reconciled: !!bestMatch,
        };

        if (tx.valueDate) txData.valueDate = tx.valueDate;
        if (tx.counterpartyIban) txData.counterpartyIban = tx.counterpartyIban;
        if (tx.purpose) txData.purpose = tx.purpose;
        if (bestMatch) {
          txData.matchedInvoiceId = bestMatch.invoiceId;
          txData.matchConfidence = bestMatch.confidence;
        }

        // Create transaction record
        await ctx.prisma.bankTransaction.create({ data: txData });

        imported++;
        if (bestMatch) {
          matched++;

          // Update invoice status if fully paid
          if (bestMatch.confidence >= 0.85) {
            await ctx.prisma.invoice.update({
              where: { id: bestMatch.invoiceId },
              data: { status: 'PAID', paidAt: tx.transactionDate },
            });
          }
        }
      } catch (err) {
        errors.push(
          `Zeile übersprungen: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`
        );
      }
    }

    return success({ imported, duplicates, matched, errors });
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Import fehlgeschlagen');
  }
}

/**
 * Gets all bank transactions.
 *
 * @param {BankingIpcContext} ctx - Handler context
 * @returns {Promise<ApiResult<object[]>>} Bank transactions
 */
export async function getAllTransactionsHandler(
  ctx: BankingIpcContext
): Promise<ApiResult<object[]>> {
  try {
    const transactions = await ctx.prisma.bankTransaction.findMany({
      where: { deletedAt: null },
      orderBy: { transactionDate: 'desc' },
    });

    return success(transactions);
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Fehler beim Laden');
  }
}

/**
 * Gets unmatched bank transactions.
 *
 * @param {BankingIpcContext} ctx - Handler context
 * @returns {Promise<ApiResult<object[]>>} Unmatched transactions
 */
export async function getUnmatchedTransactionsHandler(
  ctx: BankingIpcContext
): Promise<ApiResult<object[]>> {
  try {
    const transactions = await ctx.prisma.bankTransaction.findMany({
      where: {
        deletedAt: null,
        reconciled: false,
        amount: { gt: 0 }, // Only incoming payments
      },
      orderBy: { transactionDate: 'desc' },
    });

    return success(transactions);
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Fehler beim Laden');
  }
}

/**
 * Finds invoice matches for a transaction.
 *
 * @param {BankingIpcContext} ctx - Handler context
 * @param {string} transactionId - Transaction ID
 * @returns {Promise<ApiResult<object[]>>} Match results
 */
export async function findMatchesHandler(
  ctx: BankingIpcContext,
  transactionId: string
): Promise<ApiResult<object[]>> {
  try {
    const transaction = await ctx.prisma.bankTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return error('Transaktion nicht gefunden');
    }

    // Get unpaid invoices
    const invoices = await ctx.prisma.invoice.findMany({
      where: {
        status: { in: ['SENT', 'OVERDUE'] },
        deletedAt: null,
      },
      include: {
        customer: true,
      },
    });

    const invoicesForMatching = invoices.map((inv) => ({
      id: inv.id,
      number: inv.number,
      customerName: inv.customer.name,
      total: inv.total,
    }));

    const matchInput: { counterparty: string; amount: number; purpose?: string } = {
      counterparty: transaction.counterparty,
      amount: transaction.amount,
    };
    if (transaction.purpose) {
      matchInput.purpose = transaction.purpose;
    }

    const matches = ctx.bankingService.findMatches(matchInput, invoicesForMatching);

    // Enrich with invoice details
    const enrichedMatches = matches.map((match) => {
      const invoice = invoices.find((inv) => inv.id === match.invoiceId)!;
      return {
        transactionId,
        invoiceId: match.invoiceId,
        invoiceNumber: invoice.number,
        customerName: invoice.customer.name,
        invoiceAmount: invoice.total,
        confidence: match.confidence,
        matchReasons: match.reasons,
      };
    });

    return success(enrichedMatches);
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Fehler beim Suchen');
  }
}

/**
 * Confirms a match between transaction and invoice.
 *
 * @param {BankingIpcContext} ctx - Handler context
 * @param {string} transactionId - Transaction ID
 * @param {string} invoiceId - Invoice ID
 * @param {number} confidence - Match confidence
 * @returns {Promise<ApiResult<void>>} Result
 */
export async function confirmMatchHandler(
  ctx: BankingIpcContext,
  transactionId: string,
  invoiceId: string,
  confidence: number
): Promise<ApiResult<void>> {
  try {
    const transaction = await ctx.prisma.bankTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return error('Transaktion nicht gefunden');
    }

    // Update transaction
    await ctx.prisma.bankTransaction.update({
      where: { id: transactionId },
      data: {
        matchedInvoiceId: invoiceId,
        matchConfidence: confidence,
        reconciled: true,
      },
    });

    // Mark invoice as paid
    await ctx.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PAID',
        paidAt: transaction.transactionDate,
      },
    });

    return success(undefined);
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Zuordnung fehlgeschlagen');
  }
}
