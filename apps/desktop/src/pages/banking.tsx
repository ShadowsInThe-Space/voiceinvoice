/**
 * Banking Page
 *
 * Displays bank transactions imported from CSV files.
 * Supports automatic invoice matching with confidence scoring.
 *
 * @module pages/banking
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Upload,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Search,
  FolderOpen,
  ArrowUpDown,
} from 'lucide-react';

interface BankTransaction {
  id: string;
  transactionDate: string;
  counterparty: string;
  counterpartyIban?: string;
  amount: number;
  currency: string;
  purpose?: string;
  sourceFile?: string;
  matchedInvoiceId?: string;
  matchConfidence?: number;
  reconciled: boolean;
}

interface MatchResult {
  transactionId: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  invoiceAmount: number;
  confidence: number;
  matchReasons: string[];
}

interface ImportResult {
  success: boolean;
  imported: number;
  duplicates: number;
  matched: number;
  errors: string[];
}

interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: { message: string };
}

function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getConfidenceBadgeClasses(confidence: number): string {
  if (confidence >= 0.85)
    return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  if (confidence >= 0.65)
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
}

/**
 * Banking page component for managing bank transactions and invoice matching.
 *
 * Allows importing CSV bank statements and matching transactions to invoices
 * using fuzzy matching algorithms.
 *
 * @returns {React.ReactElement} The banking page component
 */
export default function BankingPage(): React.ReactElement {
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'matched' | 'unmatched'>('all');
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const api = (
        window as unknown as {
          voiceinvoice: {
            banking: { getAllTransactions: () => Promise<ApiResult<BankTransaction[]>> };
          };
        }
      ).voiceinvoice;
      const result = await api.banking.getAllTransactions();
      if (result.success && result.data) setTransactions(result.data);
      else setError(result.error?.message || 'Fehler beim Laden');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleImportCsv = useCallback(async () => {
    setImporting(true);
    setImportResult(null);
    setError(null);
    try {
      const api = (
        window as unknown as {
          voiceinvoice: {
            banking: {
              selectCsvFiles: () => Promise<ApiResult<string[]>>;
              importCsv: (path: string) => Promise<ApiResult<ImportResult>>;
            };
          };
        }
      ).voiceinvoice;
      const selectResult = await api.banking.selectCsvFiles();
      if (!selectResult.success || !selectResult.data?.length) {
        setImporting(false);
        return;
      }
      let totalImported = 0,
        totalDuplicates = 0,
        totalMatched = 0;
      const allErrors: string[] = [];
      for (const filePath of selectResult.data) {
        const importRes = await api.banking.importCsv(filePath);
        if (importRes.success && importRes.data) {
          totalImported += importRes.data.imported;
          totalDuplicates += importRes.data.duplicates;
          totalMatched += importRes.data.matched;
          allErrors.push(...importRes.data.errors);
        } else allErrors.push(importRes.error?.message || 'Import fehlgeschlagen');
      }
      setImportResult({
        success: allErrors.length === 0,
        imported: totalImported,
        duplicates: totalDuplicates,
        matched: totalMatched,
        errors: allErrors,
      });
      await loadTransactions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import fehlgeschlagen');
    } finally {
      setImporting(false);
    }
  }, [loadTransactions]);

  const loadMatches = useCallback(async (transaction: BankTransaction) => {
    setSelectedTransaction(transaction);
    setLoadingMatches(true);
    setMatches([]);
    try {
      const api = (
        window as unknown as {
          voiceinvoice: {
            banking: { findMatches: (id: string) => Promise<ApiResult<MatchResult[]>> };
          };
        }
      ).voiceinvoice;
      const result = await api.banking.findMatches(transaction.id);
      if (result.success && result.data) setMatches(result.data);
    } catch {
      /* silent */
    } finally {
      setLoadingMatches(false);
    }
  }, []);

  const handleConfirmMatch = useCallback(
    async (match: MatchResult) => {
      try {
        const api = (
          window as unknown as {
            voiceinvoice: {
              banking: {
                confirmMatch: (
                  txId: string,
                  invId: string,
                  conf: number
                ) => Promise<ApiResult<void>>;
              };
            };
          }
        ).voiceinvoice;
        const result = await api.banking.confirmMatch(
          match.transactionId,
          match.invoiceId,
          match.confidence
        );
        if (result.success) {
          await loadTransactions();
          setSelectedTransaction(null);
          setMatches([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Zuordnung fehlgeschlagen');
      }
    },
    [loadTransactions]
  );

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const filteredTransactions = transactions.filter((tx) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (
        !tx.counterparty.toLowerCase().includes(term) &&
        !tx.purpose?.toLowerCase().includes(term)
      )
        return false;
    }
    if (filterStatus === 'matched' && !tx.reconciled) return false;
    if (filterStatus === 'unmatched' && tx.reconciled) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Banking</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Kontoauszuege importieren und mit Rechnungen abgleichen
          </p>
        </div>
        <div className="flex gap-3 mt-4 md:mt-0">
          <button
            onClick={loadTransactions}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </button>
          <button
            onClick={handleImportCsv}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {importing ? 'Importiert...' : 'CSV Importieren'}
          </button>
        </div>
      </div>

      {importResult && (
        <div
          className={`mb-6 p-4 rounded-lg ${importResult.success ? 'bg-green-50 border border-green-200 dark:bg-green-900/20' : 'bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20'}`}
        >
          <div className="flex items-start gap-3">
            {importResult.success ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-600" />
            )}
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Import abgeschlossen</p>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                {importResult.imported} importiert, {importResult.duplicates} Duplikate,{' '}
                {importResult.matched} automatisch zugeordnet
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Suche..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as 'all' | 'matched' | 'unmatched')}
          className="px-4 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        >
          <option value="all">Alle Status</option>
          <option value="matched">Zugeordnet</option>
          <option value="unmatched">Nicht zugeordnet</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Transaktionen ({filteredTransactions.length})
              </h2>
            </div>
            {loading ? (
              <div className="p-8 text-center text-gray-500">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                Laden...
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Keine Transaktionen</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
                {filteredTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    onClick={() => !tx.reconciled && loadMatches(tx)}
                    className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 ${!tx.reconciled ? 'cursor-pointer' : ''} ${selectedTransaction?.id === tx.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-white truncate">
                            {tx.counterparty}
                          </span>
                          {tx.reconciled ? (
                            <span className="flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle className="h-3 w-3" />
                              Zugeordnet
                            </span>
                          ) : (
                            tx.amount > 0 && (
                              <span className="flex items-center gap-1 text-xs text-yellow-600">
                                <Clock className="h-3 w-3" />
                                Offen
                              </span>
                            )
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate mt-1">{tx.purpose || '-'}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDate(tx.transactionDate)}
                          {tx.sourceFile && ` - ${tx.sourceFile}`}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p
                          className={`font-semibold ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {tx.amount >= 0 ? '+' : ''}
                          {formatCurrency(tx.amount)}
                        </p>
                        {tx.matchConfidence && (
                          <span
                            className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded ${getConfidenceBadgeClasses(tx.matchConfidence)}`}
                          >
                            {Math.round(tx.matchConfidence * 100)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">Rechnungsvorschlaege</h2>
            </div>
            {!selectedTransaction ? (
              <div className="p-6 text-center text-gray-500">
                <ArrowUpDown className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Waehlen Sie eine offene Transaktion</p>
              </div>
            ) : loadingMatches ? (
              <div className="p-6 text-center text-gray-500">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
              </div>
            ) : matches.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Keine passenden Rechnungen</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {matches.map((match) => (
                  <div key={match.invoiceId} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {match.invoiceNumber}
                        </p>
                        <p className="text-sm text-gray-500">{match.customerName}</p>
                      </div>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded ${getConfidenceBadgeClasses(match.confidence)}`}
                      >
                        {Math.round(match.confidence * 100)}%
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      {formatCurrency(match.invoiceAmount)}
                    </p>
                    <ul className="text-xs text-gray-500 mb-3">
                      {match.matchReasons.map((r, i) => (
                        <li key={i}>- {r}</li>
                      ))}
                    </ul>
                    <button
                      onClick={() => handleConfirmMatch(match)}
                      className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                    >
                      Zuordnung bestaetigen
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {selectedTransaction && (
            <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
                Ausgewaehlte Transaktion
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                {selectedTransaction.counterparty}
              </p>
              <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                {formatCurrency(selectedTransaction.amount)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
