/**
 * InvoiceList component.
 *
 * A professional data table for displaying invoices with filtering,
 * sorting, and selection capabilities.
 *
 * @module components/InvoiceList
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { Invoice, InvoiceStatus } from '@voiceinvoice/shared-types';
import { cn } from '../lib/utils';
import {
  Search,
  Trash2,
  FileText,
  Calendar,
} from 'lucide-react';

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
 * Synchronized with Dashboard for consistent branding.
 */
const STATUS_CONFIG: Record<InvoiceStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Entwurf', className: 'bg-muted text-muted-foreground border-muted-foreground/20' },
  PENDING: { label: 'Offen', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  SENT: { label: 'Versendet', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  PAID: { label: 'Bezahlt', className: 'bg-primary/10 text-primary border-primary/20' },
  CANCELLED: { label: 'Storniert', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  OVERDUE: { label: 'Überfällig', className: 'bg-red-500 text-white border-transparent' },
};

/** Fallback for unknown statuses */
const DEFAULT_STATUS = { label: 'Unbekannt', className: 'bg-gray-500/10 text-gray-600 border-gray-500/20' };

/** German status aliases (from voice input) */
const STATUS_ALIASES: Record<string, InvoiceStatus> = {
  ENTWURF: 'DRAFT',
  OFFEN: 'PENDING',
  VERSENDET: 'SENT',
  BEZAHLT: 'PAID',
  STORNIERT: 'CANCELLED',
  ÜBERFÄLLIG: 'OVERDUE',
  // Lowercase variants
  draft: 'DRAFT',
  pending: 'PENDING',
  sent: 'SENT',
  paid: 'PAID',
  cancelled: 'CANCELLED',
  overdue: 'OVERDUE',
};

/**
 * Gets status config with fallback for unknown statuses.
 * Supports German aliases from voice input.
 *
 * @param {string} status - Invoice status
 * @returns {object} Status configuration
 */
function getStatusConfig(status: string): { label: string; className: string } {
  const normalizedStatus = STATUS_ALIASES[status] || status;
  return STATUS_CONFIG[normalizedStatus as InvoiceStatus] || DEFAULT_STATUS;
}

/**
 * Formats a date to German locale format.
 *
 * @param {Date} date - The date object to format.
 * @returns {string} The formatted date string.
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
 * @param {number} amount - The numeric amount to format.
 * @param {string} currency - ISO currency code (e.g. 'EUR').
 * @returns {string} The formatted currency string.
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

  // Ref for focus management
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus cancel button when dialog opens
  useEffect(() => {
    if (deleteConfirmId) {
      const timer = setTimeout(() => {
        cancelRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [deleteConfirmId]);

  // Handle Escape key to close dialog
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && deleteConfirmId) {
        cancelDelete();
      }
    };

    if (deleteConfirmId) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [deleteConfirmId, cancelDelete]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, invoice: Invoice) => {
      if (e.key === 'Enter') {
        handleSelect(invoice);
      }
    },
    [handleSelect]
  );

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
                <tr
                  key={invoice.id}
                  data-testid={`invoice-row-${invoice.id}`}
                  onClick={() => handleSelect(invoice)}
                  onKeyDown={(e) => handleKeyDown(e, invoice)}
                  tabIndex={0}
                  className={cn(
                    "group cursor-pointer transition-all hover:bg-muted/20 focus:outline-none focus:bg-primary/5",
                    selectedId === invoice.id && "bg-primary/5 border-l-4 border-l-primary"
                  )}
                >
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="overflow-hidden">
                        <div className="font-bold text-foreground text-base tracking-tight">
                          {invoice.invoiceNumber}
                        </div>
                        {invoice.description && (
                          <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                            {invoice.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                      <Calendar className="h-4 w-4 opacity-50" />
                      <span>{formatDate(invoice.date)}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="font-black text-foreground text-lg tracking-tighter">
                      {formatCurrency(invoice.grossAmount, invoice.currency)}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span
                      data-testid={`status-${invoice.id}`}
                      className={cn(
                        "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all shadow-sm",
                        getStatusConfig(invoice.status).className
                      )}
                    >
                      {getStatusConfig(invoice.status).label}
                    </span>
                  </td>
                  {onDelete && (
                    <td className="px-8 py-6 text-right">
                      <button
                        onClick={(e) => handleDeleteClick(e, invoice.id)}
                        className="p-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                        title="Rechnung löschen"
                        aria-label={`Rechnung ${invoice.invoiceNumber} löschen`}
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </td>
                  )}
                </tr>
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-md px-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <div className="w-full max-w-md rounded-2xl border-2 border-destructive/20 bg-card p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-6 mx-auto">
              <Trash2 size={32} />
            </div>
            <h3
              id="alert-dialog-title"
              className="text-2xl font-black text-foreground text-center mb-2 tracking-tight"
            >
              Dokument löschen?
            </h3>
            <p
              id="alert-dialog-description"
              className="text-muted-foreground text-center mb-8"
            >
              Diese Aktion entfernt die Rechnung <span className="font-bold text-foreground">unwiderruflich</span> aus Ihrem System.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                ref={cancelRef}
                onClick={cancelDelete}
                className="py-3 px-4 text-sm font-bold rounded-xl border-2 border-border hover:bg-muted transition-all focus-visible:ring-2 focus-visible:ring-primary focus:outline-none"
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

