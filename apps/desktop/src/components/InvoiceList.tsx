/**
 * InvoiceList component.
 *
 * A professional data table for displaying invoices with filtering,
 * sorting, and selection capabilities.
 *
 * @module components/InvoiceList
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { Invoice, InvoiceStatus } from '@voiceinvoice/shared-types';
import {
  Search,
  Trash2,
  FileText,
} from 'lucide-react';
import { STATUS_CONFIG } from './invoice-utils';
import { InvoiceRow } from './InvoiceRow';

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
 * Invoice list with filtering and sorting.
 *
 * @param {InvoiceListProps} props - The component props.
 * @param {Invoice[]} props.invoices - List of invoices to display.
 * @param {Function} props.onSelect - Callback when an invoice is selected.
 * @param {Function} [props.onDelete] - Callback when an invoice is deleted.
 * @returns {JSX.Element} The rendered list component.
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

    if (statusFilter) {
      result = result.filter((inv) => inv.status === statusFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(term) ||
          (inv.description?.toLowerCase().includes(term) ?? false)
      );
    }

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

  const handleSelect = useCallback(
    (invoice: Invoice) => {
      setSelectedId(invoice.id);
      onSelect(invoice);
    },
    [onSelect]
  );

  const handleDeleteClick = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteConfirmId && onDelete) {
      onDelete(deleteConfirmId);
    }
    setDeleteConfirmId(null);
  }, [deleteConfirmId, onDelete]);

  const cancelDelete = useCallback(() => {
    setDeleteConfirmId(null);
  }, []);

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border/50 rounded-2xl bg-muted/5">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-6">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-bold text-foreground tracking-tight">Keine Rechnungen</h3>
        <p className="text-muted-foreground mt-2 max-w-xs mx-auto">
          Erstellen Sie Ihre erste Rechnung via Spracheingabe um Zeit zu sparen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Toolbar - Modern Action Bar */}
      <div className="flex flex-col xl:flex-row gap-6 items-start xl:items-center justify-between bg-card p-4 rounded-2xl border border-border/50 shadow-sm">
        <div className="relative w-full xl:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Suchen nach Nummer oder Inhalt..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-12 w-full rounded-xl border-2 border-transparent bg-muted/20 pl-11 pr-4 text-sm transition-all focus:bg-background focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/5"
          />
        </div>

        <div className="flex flex-wrap gap-3 w-full xl:w-auto">
          <div className="flex items-center gap-2 bg-muted/20 px-3 py-1 rounded-xl border-2 border-transparent focus-within:border-primary transition-all">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Status</span>
            <select
              aria-label="Status Filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | '')}
              className="h-10 bg-transparent text-sm font-bold focus:outline-none cursor-pointer min-w-[140px]"
            >
              <option value="">Alle Anzeigen</option>
              {Object.entries(STATUS_CONFIG).map(([status, { label }]) => (
                <option key={status} value={status}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-muted/20 px-3 py-1 rounded-xl border-2 border-transparent focus-within:border-primary transition-all">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Sortierung</span>
            <select
              aria-label="Sortieren nach"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-10 bg-transparent text-sm font-bold focus:outline-none cursor-pointer min-w-[160px]"
            >
              <option value="date">Datum (Absteigend)</option>
              <option value="amount">Betrag (Absteigend)</option>
              <option value="invoiceNumber">Rechnungsnummer</option>
            </select>
          </div>
        </div>
      </div>

      {/* Data Table - Enterprise Style */}
      <div className="bg-card rounded-2xl border border-border/50 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" role="table">
            <thead>
              <tr className="bg-muted/30 border-b border-border/50">
                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]" role="columnheader">Dokument</th>
                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]" role="columnheader">Datum</th>
                <th className="px-8 py-5 text-right text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]" role="columnheader">Bruttobetrag</th>
                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]" role="columnheader">Status</th>
                {onDelete && <th className="px-8 py-5 text-right text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]" role="columnheader">Aktion</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {processedInvoices.map((invoice) => (
                <InvoiceRow
                  key={invoice.id}
                  invoice={invoice}
                  isSelected={selectedId === invoice.id}
                  onSelect={handleSelect}
                  onDelete={onDelete ? handleDeleteClick : undefined}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex justify-between items-center px-4">
        <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          {processedInvoices.length === 1 ? '1 Dokument gefunden' : `${processedInvoices.length} Dokumente gefunden`}
        </div>
        {processedInvoices.length === 0 && invoices.length > 0 && (
          <div className="text-sm font-medium text-destructive italic">
            Keine Treffer für die aktuelle Filterung.
          </div>
        )}
      </div>

      {/* Delete Dialog - Glass Effect */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-md px-4">
          <div className="w-full max-w-md rounded-2xl border-2 border-destructive/20 bg-card p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-6 mx-auto">
              <Trash2 size={32} />
            </div>
            <h3 className="text-2xl font-black text-foreground text-center mb-2 tracking-tight">
              Dokument löschen?
            </h3>
            <p className="text-muted-foreground text-center mb-8">
              Diese Aktion entfernt die Rechnung <span className="font-bold text-foreground">unwiderruflich</span> aus Ihrem System.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={cancelDelete}
                className="py-3 px-4 text-sm font-bold rounded-xl border-2 border-border hover:bg-muted transition-all"
              >
                Abbrechen
              </button>
              <button
                onClick={confirmDelete}
                data-testid="confirm-delete-button"
                className="py-3 px-4 text-sm font-black rounded-xl bg-destructive text-white shadow-lg shadow-destructive/20 hover:bg-destructive/90 transition-all"
              >
                Endgültig löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
