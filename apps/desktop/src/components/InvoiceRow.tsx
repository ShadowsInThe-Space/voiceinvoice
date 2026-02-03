import React, { memo } from 'react';
import type { Invoice } from '@voiceinvoice/shared-types';
import { FileText, Calendar, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { formatDate, formatCurrency, getStatusConfig } from '../lib/invoice-utils';

/**
 * Props for InvoiceRow component.
 */
export interface InvoiceRowProps {
  /** The invoice to display */
  invoice: Invoice;
  /** Whether this row is currently selected */
  isSelected: boolean;
  /** Callback when the row is selected */
  onSelect: (invoice: Invoice) => void;
  /** Callback when the delete button is clicked */
  onDelete?: (e: React.MouseEvent, id: string) => void;
}

/**
 * A memoized table row component for displaying a single invoice.
 * Using React.memo prevents unnecessary re-renders of all rows when only one changes
 * (e.g. selection state) or when parent re-renders for unrelated reasons.
 */
export const InvoiceRow = memo(function InvoiceRow({
  invoice,
  isSelected,
  onSelect,
  onDelete,
}: InvoiceRowProps) {
  // Event handlers
  const handleSelect = (): void => onSelect(invoice);

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      onSelect(invoice);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent): void => {
    if (onDelete) {
      onDelete(e, invoice.id);
    }
  };

  const statusConfig = getStatusConfig(invoice.status);

  return (
    <tr
      data-testid={`invoice-row-${invoice.id}`}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className={cn(
        "group cursor-pointer transition-all hover:bg-muted/20 focus:outline-none focus:bg-primary/5",
        isSelected && "bg-primary/5 border-l-4 border-l-primary"
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
            statusConfig.className
          )}
        >
          {statusConfig.label}
        </span>
      </td>
      {onDelete && (
        <td className="px-8 py-6 text-right">
          <button
            onClick={handleDeleteClick}
            className="p-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
            title="Rechnung löschen"
            aria-label="Loeschen"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </td>
      )}
    </tr>
  );
});
