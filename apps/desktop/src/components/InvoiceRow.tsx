import React, { memo, useCallback } from 'react';
import type { Invoice } from '@voiceinvoice/shared-types';
import { cn } from '../lib/utils';
import { FileText, Calendar, Trash2 } from 'lucide-react';
import { getStatusConfig, formatDate, formatCurrency } from './invoice-utils';

export interface InvoiceRowProps {
  invoice: Invoice;
  isSelected: boolean;
  onSelect: (invoice: Invoice) => void;
  onDelete?: (e: React.MouseEvent, id: string) => void;
}

export const InvoiceRow = memo(function InvoiceRow({
  invoice,
  isSelected,
  onSelect,
  onDelete,
}: InvoiceRowProps) {
  const handleSelect = useCallback(() => {
    onSelect(invoice);
  }, [invoice, onSelect]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        onSelect(invoice);
      }
    },
    [invoice, onSelect]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      if (onDelete) {
        onDelete(e, invoice.id);
      }
    },
    [invoice.id, onDelete]
  );

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
            getStatusConfig(invoice.status).className
          )}
        >
          {getStatusConfig(invoice.status).label}
        </span>
      </td>
      {onDelete && (
        <td className="px-8 py-6 text-right">
          <button
            onClick={handleDelete}
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
