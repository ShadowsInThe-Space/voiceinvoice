/**
 * InvoiceList component.
 *
 * A list component for displaying invoices with filtering,
 * sorting, and selection capabilities.
 *
 * @module components/InvoiceList
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { Invoice, InvoiceStatus } from '@voiceinvoice/shared-types';

/**
 * Props for InvoiceList component.
 */
export interface InvoiceListProps {
  /** List of invoices to display */
  invoices: Invoice[];
  /** Callback when an invoice is selected */
  onSelect: (invoice: Invoice) => void;
  /** Callback when an invoice is deleted */
  onDelete?: (id: string) => void;
}

/**
 * Sort options for the invoice list.
 */
type SortOption = 'date' | 'amount' | 'invoiceNumber';

/**
 * Status configuration for display.
 */
const STATUS_CONFIG: Record<InvoiceStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Entwurf', className: 'bg-gray-100 text-gray-800' },
  PENDING: { label: 'Offen', className: 'bg-yellow-100 text-yellow-800' },
  PAID: { label: 'Bezahlt', className: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Storniert', className: 'bg-red-100 text-red-800' },
  OVERDUE: { label: 'Ueberfaellig', className: 'bg-red-200 text-red-900' },
};

/**
 * Formats a date to German locale format.
 *
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Formats a currency amount.
 *
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Invoice list with filtering and sorting.
 *
 * Features:
 * - Filter by status
 * - Search by invoice number and description
 * - Sort by date, amount, or invoice number
 * - Delete confirmation dialog
 * - Keyboard navigation
 *
 * @param {InvoiceListProps} props - Component props
 * @returns {JSX.Element} Rendered component
 *
 * @example
 * <InvoiceList
 *   invoices={invoiceData}
 *   onSelect={(invoice) => openInvoice(invoice)}
 *   onDelete={(id) => deleteInvoice(id)}
 * />
 */
export function InvoiceList({
  invoices,
  onSelect,
  onDelete,
}: InvoiceListProps): JSX.Element {
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | ''>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filter and sort invoices
  const processedInvoices = useMemo(() => {
    let result = [...invoices];

    // Apply status filter
    if (statusFilter) {
      result = result.filter((inv) => inv.status === statusFilter);
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(term) ||
          (inv.description?.toLowerCase().includes(term) ?? false)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'amount':
          return b.grossAmount - a.grossAmount;
        case 'invoiceNumber':
          return a.invoiceNumber.localeCompare(b.invoiceNumber);
        default:
          return 0;
      }
    });

    return result;
  }, [invoices, statusFilter, searchTerm, sortBy]);

  /**
   * Handles invoice selection.
   */
  const handleSelect = useCallback(
    (invoice: Invoice) => {
      setSelectedId(invoice.id);
      onSelect(invoice);
    },
    [onSelect]
  );

  /**
   * Handles delete button click.
   */
  const handleDeleteClick = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  }, []);

  /**
   * Confirms deletion.
   */
  const confirmDelete = useCallback(() => {
    if (deleteConfirmId && onDelete) {
      onDelete(deleteConfirmId);
    }
    setDeleteConfirmId(null);
  }, [deleteConfirmId, onDelete]);

  /**
   * Cancels deletion.
   */
  const cancelDelete = useCallback(() => {
    setDeleteConfirmId(null);
  }, []);

  /**
   * Handles keyboard navigation.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, invoice: Invoice) => {
      if (e.key === 'Enter') {
        handleSelect(invoice);
      }
    },
    [handleSelect]
  );

  // Count text
  const countText =
    processedInvoices.length === 1
      ? '1 Rechnung'
      : `${processedInvoices.length} Rechnungen`;

  // Empty state
  if (invoices.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Keine Rechnungen vorhanden
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter and sort controls */}
      <div className="flex flex-wrap gap-4">
        {/* Status filter */}
        <div>
          <label htmlFor="statusFilter" className="sr-only">
            Status Filter
          </label>
          <select
            id="statusFilter"
            aria-label="Status Filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | '')}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Alle Status</option>
            {Object.entries(STATUS_CONFIG).map(([status, { label }]) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="search" className="sr-only">
            Suchen
          </label>
          <input
            id="search"
            type="text"
            placeholder="Suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        {/* Sort */}
        <div>
          <label htmlFor="sortBy" className="sr-only">
            Sortieren nach
          </label>
          <select
            id="sortBy"
            aria-label="Sortieren nach"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="date">Datum</option>
            <option value="amount">Betrag</option>
            <option value="invoiceNumber">Nummer</option>
          </select>
        </div>
      </div>

      {/* Count */}
      <div className="text-sm text-gray-600">{countText}</div>

      {/* Invoice table */}
      <div className="overflow-x-auto">
        <table role="table" className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                role="columnheader"
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Nummer
              </th>
              <th
                role="columnheader"
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Datum
              </th>
              <th
                role="columnheader"
                scope="col"
                className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Betrag
              </th>
              <th
                role="columnheader"
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Status
              </th>
              {onDelete && (
                <th
                  role="columnheader"
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Aktionen
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {processedInvoices.map((invoice) => (
              <tr
                key={invoice.id}
                data-testid={`invoice-row-${invoice.id}`}
                role="row"
                tabIndex={0}
                onClick={() => handleSelect(invoice)}
                onKeyDown={(e) => handleKeyDown(e, invoice)}
                className={`
                  cursor-pointer hover:bg-gray-50 focus:outline-none focus:bg-blue-50
                  ${selectedId === invoice.id ? 'selected bg-blue-50' : ''}
                `}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {invoice.invoiceNumber}
                  </div>
                  {invoice.description && (
                    <div className="text-sm text-gray-500 truncate max-w-[200px]">
                      {invoice.description}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(invoice.date)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                  {formatCurrency(invoice.grossAmount, invoice.currency)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    data-testid={`status-${invoice.id}`}
                    className={`
                      px-2 py-1 text-xs font-medium rounded-full
                      ${STATUS_CONFIG[invoice.status].className}
                    `}
                  >
                    {STATUS_CONFIG[invoice.status].label}
                  </span>
                </td>
                {onDelete && (
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <button
                      type="button"
                      onClick={(e) => handleDeleteClick(e, invoice.id)}
                      aria-label="Loeschen"
                      className="text-red-600 hover:text-red-900 focus:outline-none focus:underline"
                    >
                      Loeschen
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* No results */}
      {processedInvoices.length === 0 && invoices.length > 0 && (
        <div className="text-center py-4 text-gray-500">
          Keine Rechnungen gefunden
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirmId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
        >
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 id="delete-dialog-title" className="text-lg font-medium text-gray-900 mb-4">
              Loeschung bestaetigen
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              Moechten Sie diese Rechnung wirklich loeschen? Diese Aktion kann nicht rueckgaengig gemacht werden.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={cancelDelete}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Abbrechen
              </button>
              <button
                type="button"
                data-testid="confirm-delete-button"
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Loeschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
