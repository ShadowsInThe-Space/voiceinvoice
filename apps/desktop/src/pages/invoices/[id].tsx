/**
 * Invoice Detail Page
 *
 * Displays a single invoice with all details and actions.
 *
 * @module pages/invoices/[id]
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { ChevronLeft, Download, Edit, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Invoice } from '@voiceinvoice/shared-types';

/**
 * Mock invoice data for demonstration.
 */
const MOCK_INVOICES: Record<string, Invoice & { customer: { name: string } }> = {
  'inv-1': {
    id: 'inv-1',
    invoiceNumber: 'RE-2025-001',
    date: new Date('2025-01-20'),
    dueDate: new Date('2025-02-20'),
    netAmount: 1000,
    taxRate: 19,
    taxAmount: 190,
    grossAmount: 1190,
    currency: 'EUR',
    status: 'PAID',
    description: 'Beratungsleistungen',
    customerId: 'c1',
    customer: { name: 'Kunde A GmbH' },
    createdAt: new Date('2025-01-20'),
    updatedAt: new Date('2025-01-20'),
  },
  'inv-2': {
    id: 'inv-2',
    invoiceNumber: 'RE-2025-002',
    date: new Date('2025-01-22'),
    dueDate: new Date('2025-02-22'),
    netAmount: 2000,
    taxRate: 19,
    taxAmount: 380,
    grossAmount: 2380,
    currency: 'EUR',
    status: 'PENDING',
    description: 'Softwareentwicklung',
    customerId: 'c2',
    customer: { name: 'Kunde B AG' },
    createdAt: new Date('2025-01-22'),
    updatedAt: new Date('2025-01-22'),
  },
  'inv-3': {
    id: 'inv-3',
    invoiceNumber: 'RE-2025-003',
    date: new Date('2025-01-10'),
    dueDate: new Date('2025-01-25'),
    netAmount: 500,
    taxRate: 19,
    taxAmount: 95,
    grossAmount: 595,
    currency: 'EUR',
    status: 'OVERDUE',
    description: 'Wartung',
    customerId: 'c1',
    customer: { name: 'Kunde A GmbH' },
    createdAt: new Date('2025-01-10'),
    updatedAt: new Date('2025-01-10'),
  },
};

/**
 * Status configuration for display.
 */
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT: {
    label: 'Entwurf',
    className: 'bg-gray-100 text-gray-600 border-gray-200',
  },
  PENDING: {
    label: 'Offen',
    className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  },
  PAID: {
    label: 'Bezahlt',
    className: 'bg-green-100 text-green-700 border-green-200',
  },
  CANCELLED: {
    label: 'Storniert',
    className: 'bg-red-100 text-red-600 border-red-200',
  },
  OVERDUE: {
    label: 'Überfällig',
    className: 'bg-red-500 text-white border-transparent',
  },
};

/**
 * Format currency for German locale.
 * @param amount
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

/**
 * Format date for German locale.
 * @param date
 */
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Invoice Detail Page component.
 */
export default function InvoiceDetailPage(): React.ReactElement {
  const router = useRouter();
  const { id } = router.query;

  const [invoice, setInvoice] = useState<(Invoice & { customer: { name: string } }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Load invoice data
  useEffect(() => {
    if (!id || typeof id !== 'string') return;

    setIsLoading(true);
    setError(null);

    // Simulate API call
    setTimeout(() => {
      const foundInvoice = MOCK_INVOICES[id];
      if (foundInvoice) {
        setInvoice(foundInvoice);
      } else {
        setError('Rechnung nicht gefunden');
      }
      setIsLoading(false);
    }, 300);
  }, [id]);

  /**
   * Handle back navigation.
   */
  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  /**
   * Handle PDF export.
   */
  const handleExportPDF = useCallback(async () => {
    if (!invoice) return;
    setIsExporting(true);
    setExportSuccess(false);

    try {
      // Simulate PDF generation
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // In production, this would use the PDF export service
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch {
      setError('PDF-Export fehlgeschlagen');
    } finally {
      setIsExporting(false);
    }
  }, [invoice]);

  /**
   * Handle invoice deletion.
   */
  const handleDelete = useCallback(async () => {
    if (!invoice) return;

    // Simulate deletion
    await new Promise((resolve) => setTimeout(resolve, 500));
    router.push('/invoices');
  }, [invoice, router]);

  /**
   * Handle edit navigation.
   */
  const handleEdit = useCallback(() => {
    // In production, this would navigate to an edit page
    router.push(`/invoices/new?edit=${id}`);
  }, [router, id]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-primary border-r-transparent mx-auto" />
          <p className="mt-6 text-lg font-medium text-muted-foreground">Rechnung wird geladen...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !invoice) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="max-w-md text-center p-8 bg-card rounded-2xl border border-destructive/20 shadow-xl">
          <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            {error || 'Rechnung nicht gefunden'}
          </h2>
          <p className="text-muted-foreground mb-8">
            Die angeforderte Rechnung konnte nicht gefunden werden.
          </p>
          <button
            type="button"
            onClick={handleBack}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all"
          >
            Zurück zur Übersicht
          </button>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.DRAFT;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 bg-background min-h-screen">
      {/* Success Toast */}
      {exportSuccess && (
        <div className="fixed bottom-8 right-8 z-50 p-4 bg-green-500 text-white rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right duration-300">
          <CheckCircle2 className="shrink-0" />
          <span className="font-bold">PDF-Export erfolgreich!</span>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-xl font-bold text-foreground mb-4">Rechnung löschen?</h3>
            <p className="text-muted-foreground mb-8">
              Möchten Sie die Rechnung {invoice.invoiceNumber} wirklich löschen? Diese Aktion kann
              nicht rückgängig gemacht werden.
            </p>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 bg-muted text-foreground rounded-xl font-bold hover:bg-muted/80 transition-all"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 py-3 bg-destructive text-white rounded-xl font-bold hover:bg-destructive/90 transition-all"
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={handleBack}
            className="p-3 rounded-xl bg-card border border-border shadow-sm text-muted-foreground hover:text-primary hover:border-primary/30 transition-all group"
            aria-label="Zurück"
          >
            <ChevronLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-foreground tracking-tight">
              {invoice.invoiceNumber}
            </h1>
            <p className="text-muted-foreground font-medium">
              Erstellt am {formatDate(invoice.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isExporting}
            className="px-6 py-3 rounded-xl bg-card border border-border text-foreground font-bold hover:bg-muted transition-all flex items-center gap-2"
          >
            {isExporting ? (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download size={18} />
            )}
            PDF
          </button>
          <button
            type="button"
            onClick={handleEdit}
            className="px-6 py-3 rounded-xl bg-card border border-border text-foreground font-bold hover:bg-muted transition-all flex items-center gap-2"
          >
            <Edit size={18} />
            Bearbeiten
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="px-6 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive font-bold hover:bg-destructive/20 transition-all flex items-center gap-2"
          >
            <Trash2 size={18} />
            Löschen
          </button>
        </div>
      </div>

      {/* Invoice Card */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-border/50 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-muted/30 px-10 py-8 border-b border-border/50 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">
              Empfänger
            </p>
            <p className="text-2xl font-bold text-foreground">{invoice.customer.name}</p>
          </div>
          <span
            className={`inline-flex items-center px-4 py-2 text-sm font-bold uppercase tracking-widest rounded-full border ${statusConfig.className}`}
          >
            {statusConfig.label}
          </span>
        </div>

        {/* Content */}
        <div className="p-10 space-y-10">
          {/* Meta Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">
                Rechnungsdatum
              </p>
              <p className="text-lg font-bold text-foreground">{formatDate(invoice.date)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">
                Fälligkeitsdatum
              </p>
              <p className="text-lg font-bold text-foreground">
                {invoice.dueDate ? formatDate(invoice.dueDate) : '-'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">
                Währung
              </p>
              <p className="text-lg font-bold text-foreground">{invoice.currency}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">
                Steuersatz
              </p>
              <p className="text-lg font-bold text-foreground">{invoice.taxRate}%</p>
            </div>
          </div>

          {/* Description */}
          {invoice.description && (
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">
                Beschreibung
              </p>
              <p className="text-foreground">{invoice.description}</p>
            </div>
          )}

          {/* Amounts */}
          <div className="border-t-4 border-double border-border pt-8 space-y-4">
            <div className="flex justify-between items-center text-lg">
              <span className="text-muted-foreground">Netto Betrag</span>
              <span className="font-mono font-bold text-foreground">
                {formatCurrency(invoice.netAmount)}
              </span>
            </div>
            <div className="flex justify-between items-center text-lg">
              <span className="text-muted-foreground">Mehrwertsteuer ({invoice.taxRate}%)</span>
              <span className="font-mono font-bold text-foreground">
                {formatCurrency(invoice.taxAmount)}
              </span>
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-border/50">
              <span className="text-2xl font-black uppercase tracking-widest text-primary">
                Gesamtbrutto
              </span>
              <span className="text-4xl font-black tracking-tighter text-foreground">
                {formatCurrency(invoice.grossAmount)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
