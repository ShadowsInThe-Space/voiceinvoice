import type { InvoiceStatus } from '@voiceinvoice/shared-types';

/**
 * Status configuration for display.
 * Synchronized with Dashboard for consistent branding.
 */
export const STATUS_CONFIG: Record<InvoiceStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Entwurf', className: 'bg-muted text-muted-foreground border-muted-foreground/20' },
  PENDING: { label: 'Offen', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  SENT: { label: 'Versendet', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  PAID: { label: 'Bezahlt', className: 'bg-primary/10 text-primary border-primary/20' },
  CANCELLED: { label: 'Storniert', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  OVERDUE: { label: 'Überfällig', className: 'bg-red-500 text-white border-transparent' },
};

/** Fallback for unknown statuses */
export const DEFAULT_STATUS = { label: 'Unbekannt', className: 'bg-gray-500/10 text-gray-600 border-gray-500/20' };

/** German status aliases (from voice input) */
export const STATUS_ALIASES: Record<string, InvoiceStatus> = {
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
export function getStatusConfig(status: string): { label: string; className: string } {
  const normalizedStatus = STATUS_ALIASES[status] || status;
  return STATUS_CONFIG[normalizedStatus as InvoiceStatus] || DEFAULT_STATUS;
}

/**
 * Formats a date to German locale format.
 *
 * @param {Date} date - The date object to format.
 * @returns {string} The formatted date string.
 */
export function formatDate(date: Date): string {
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
export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(amount);
}
