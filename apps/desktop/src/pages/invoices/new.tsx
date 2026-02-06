/**
 * Seite zur Rechnungserstellung.
 *
 * Voice-first Rechnungserstellung mit Transkription, Vorschau und PDF-Export.
 *
 * @module pages/invoices/new
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { VoiceRecorderButton } from '../../components/VoiceRecorderButton';
import { KeywordHelp } from '../../components/KeywordHelp';
import {
  ChevronLeft,
  FileText,
  Send,
  Download,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { PDFExporter } from '../../lib/export/pdf-exporter';

/**
 * Rechnungsposition.
 */
interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  unit?: string | undefined;
}

/**
 * Kundendaten zur Rechnung.
 */
interface CustomerInfo {
  id: string;
  name: string;
  email?: string | undefined;
  phone?: string | undefined;
  address?: string | undefined;
  city?: string | undefined;
  zipCode?: string | undefined;
  taxId?: string | undefined;
}

/**
 * Rechnung.
 */
interface Invoice {
  id: string;
  number: string;
  customerId: string;
  customer: CustomerInfo;
  items: InvoiceItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  status: string;
  createdAt: Date;
  dueDate?: Date | undefined;
  paymentTerms?: string | undefined;
  notes?: string | undefined;
}

/**
 * API-Modelle fuer das Edit-Loading (Route: `/api/invoices/[id]`).
 *
 * Hinweis: Diese Typen sind bewusst lokal, um `any` zu vermeiden und
 * die Konvertierung in das UI-Model (`Invoice`) explizit zu halten.
 */
interface InvoiceApiItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  unit?: string | null | undefined;
}

interface InvoiceApiCustomer {
  name: string;
  email?: string | null | undefined;
  phone?: string | null | undefined;
  address?: string | null | undefined;
  city?: string | null | undefined;
  zipCode?: string | null | undefined;
  taxId?: string | null | undefined;
}

interface InvoiceApiModel {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customer: InvoiceApiCustomer;
  items?: InvoiceApiItem[] | null | undefined;
  date?: string | null | undefined;
  dueDate?: string | null | undefined;
  paymentTerms?: string | null | undefined;
  notes?: string | null | undefined;
  taxRate?: number | null | undefined;
  taxAmount: number;
  netAmount: number;
  grossAmount: number;
  status: string;
  createdAt: string;
}

interface FetchInvoiceForEditResponse {
  success: boolean;
  invoice?: InvoiceApiModel | null | undefined;
  error?: string | undefined;
}

/**
 * Formatiert einen Betrag als Waehrung im deutschen Locale.
 *
 * @param {number} amount - Betrag als Zahl.
 * @returns {string} Formatierter Betrag (EUR).
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

/**
 * Seite zur Erstellung einer neuen Rechnung.
 *
 * @returns {React.ReactElement} Gerenderte Seite.
 */
export default function NewInvoicePage(): React.ReactElement {
  const router = useRouter();
  const { speak } = useSpeechSynthesis();

  // Processing state
  const [processingState, setProcessingState] = useState<
    'idle' | 'processing' | 'complete' | 'error'
  >('idle');
  const [transcription, setTranscription] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);

  // Manual entry mode
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualForm, setManualForm] = useState<{
    // Customer fields
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    customerAddress: string;
    customerCity: string;
    customerZipCode: string;
    customerTaxId: string;
    // Invoice fields
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    paymentTerms: string;
    notes: string;
    // Items
    items: {
      id: string;
      description: string;
      quantity: number | '';
      unitPrice: number | '';
      unit: string;
    }[];
    taxRate: string;
  }>({
    // Customer defaults
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    customerCity: '',
    customerZipCode: '',
    customerTaxId: '',
    // Invoice defaults
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    paymentTerms: 'Zahlbar innerhalb von 14 Tagen nach Rechnungserhalt.',
    notes: '',
    // Items
    items: [{ id: '1', description: '', quantity: 1, unitPrice: '', unit: 'Stück' }],
    taxRate: '19',
  });

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load invoice for editing if edit query param is present
  useEffect(() => {
    const { edit } = router.query;

    if (!edit || typeof edit !== 'string') return;

    const fetchInvoiceForEdit = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/invoices/${edit}`);
        const data = (await response.json()) as FetchInvoiceForEditResponse;

        if (data.success && data.invoice) {
          // In eine lokale Konstante ziehen, damit TypeScript das Narrowing auch in Callbacks beibehaelt.
          const invoiceForEdit = data.invoice;
          const taxRate = invoiceForEdit.taxRate ?? 19;
          const invoiceItems = invoiceForEdit.items ?? [];

          // Switch to manual mode
          setIsManualMode(true);

          // Fill form with invoice data
          setManualForm((prev) => ({
            ...prev,
            customerName: invoiceForEdit.customer?.name || '',
            customerEmail: invoiceForEdit.customer?.email || '',
            customerPhone: invoiceForEdit.customer?.phone || '',
            customerAddress: invoiceForEdit.customer?.address || '',
            customerCity: invoiceForEdit.customer?.city || '',
            customerZipCode: invoiceForEdit.customer?.zipCode || '',
            customerTaxId: invoiceForEdit.customer?.taxId || '',
            invoiceNumber: invoiceForEdit.invoiceNumber || '',
            invoiceDate: invoiceForEdit.date
              ? new Date(invoiceForEdit.date).toISOString().split('T')[0]
              : new Date().toISOString().split('T')[0],
            dueDate: invoiceForEdit.dueDate
              ? new Date(invoiceForEdit.dueDate).toISOString().split('T')[0]
              : '',
            paymentTerms:
              invoiceForEdit.paymentTerms || 'Zahlbar innerhalb von 14 Tagen nach Rechnungserhalt.',
            notes: invoiceForEdit.notes || '',
            items: invoiceItems.map((item: InvoiceApiItem) => ({
              id: item.id,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              unit: item.unit || 'Stück',
            })) || [{ id: '1', description: '', quantity: 1, unitPrice: 0, unit: 'Stück' }],
            taxRate: String(taxRate),
          }));

          // Set processing state to complete to show preview
          setProcessingState('complete');

          // Set the invoice for preview
          const transformedInvoice: Invoice = {
            id: invoiceForEdit.id,
            number: invoiceForEdit.invoiceNumber,
            customerId: invoiceForEdit.customerId,
            customer: { id: invoiceForEdit.customerId, name: invoiceForEdit.customer.name },
            items: invoiceItems.map((item: InvoiceApiItem) => ({
              id: item.id,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
            })),
            subtotal: invoiceForEdit.netAmount,
            taxRate,
            taxAmount: invoiceForEdit.taxAmount,
            total: invoiceForEdit.grossAmount,
            status: invoiceForEdit.status,
            createdAt: new Date(invoiceForEdit.createdAt),
          };
          setInvoice(transformedInvoice);
        }
      } catch (err) {
        console.error('Failed to load invoice for editing:', err);
        setError('Rechnung konnte nicht geladen werden');
      }
    };

    fetchInvoiceForEdit();
  }, [router.query]);

  /**
   * Handler nach Abschluss der Audioaufnahme.
   */
  const handleRecordingComplete = useCallback(async (blob: Blob, duration: number) => {
    console.log(
      `Recording completed. Duration: ${duration}ms, Size: ${blob.size} bytes, Type: ${blob.type}`
    );
    setProcessingState('processing');
    setError(null);

    try {
      // Send audio to Voice Processing API
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');

      const response = await fetch('/api/voice/process', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = `API returned ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.error) errorMessage = errorData.error;
        } catch (e) {
          // Response was not JSON
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Voice processing failed');
      }

      // Update UI with results
      setInvoice({
        ...result.invoice,
        createdAt: new Date(result.invoice.createdAt),
      });
      setTranscription(result.transcription);
      setConfidence(result.confidence);
      setProcessingState('complete');

      // Voice feedback
      if (result.invoice.items && result.invoice.items.length > 0) {
        speak(
          `Rechnung erkannt für ${result.invoice.customer.name} über ${formatCurrency(result.invoice.total)}.`
        );
      } else {
        speak('Rechnungsinformationen erkannt. Bitte überprüfen.');
      }
    } catch (err) {
      console.error('[Voice Recording] Error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Verarbeitung fehlgeschlagen';
      setError(`Fehler: ${errorMsg}`);
      setProcessingState('error');
    }
  }, []);

  const handleTranscriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTranscription(e.target.value);
  }, []);

  const handleEditClick = useCallback(() => setIsEditing(true), []);

  const handleSave = useCallback(async () => {
    if (!invoice) return;
    setIsSaving(true);
    setSaveSuccess(false);
    setError(null);

    try {
      // Save invoice to database via API
      const response = await fetch('/api/invoices/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice: {
            number: invoice.number || `RE-${Date.now()}`,
            customerId: invoice.customerId,
            customer: invoice.customer,
            items: invoice.items,
            subtotal: invoice.subtotal,
            taxRate: invoice.taxRate,
            taxAmount: invoice.taxAmount,
            total: invoice.total,
            status: 'ENTWURF',
          },
          transcription: transcription,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Speichern fehlgeschlagen');
      }

      const data = await response.json();

      if (!data.success || !data.invoiceId) {
        throw new Error('Keine Rechnungs-ID erhalten');
      }

      setSaveSuccess(true);
      speak('Rechnung erfolgreich gespeichert.');

      // Redirect to the saved invoice
      setTimeout(() => {
        setSaveSuccess(false);
        setIsEditing(false);
        router.push(`/invoices/${data.invoiceId}`);
      }, 2000);
    } catch (err) {
      console.error('Failed to save invoice:', err);
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
    } finally {
      setIsSaving(false);
    }
  }, [invoice, router, speak, transcription]);

  const handleExportPDF = useCallback(async () => {
    if (!invoice) return;
    setIsExporting(true);
    setExportSuccess(false);
    setError(null);

    try {
      const exporter = new PDFExporter();

      // Map invoice to PDFExporter format
      const pdfInvoice = {
        id: invoice.id,
        number: invoice.number || `RE-${Date.now()}`,
        customerId: invoice.customerId,
        subtotal: invoice.subtotal,
        taxRate: invoice.taxRate,
        taxAmount: invoice.taxAmount,
        total: invoice.total,
        currency: 'EUR',
        status: invoice.status || 'DRAFT',
        issuedAt: new Date(),
        dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        paidAt: null,
        voiceRecordingId: null,
        transcription: null,
        notes: null,
        paymentTerms: 'Zahlbar innerhalb von 14 Tagen',
        createdAt: invoice.createdAt || new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        syncVersion: 1,
        items: (invoice.items || []).map((item, idx) => ({
          id: item.id || `item-${idx}`,
          invoiceId: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total || item.quantity * item.unitPrice,
          category: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          syncVersion: 1,
        })),
      };

      const pdfCustomer = {
        id: invoice.customerId,
        name: invoice.customer?.name || 'Kunde',
        email: null,
        phone: null,
        address: null,
        city: null,
        zipCode: null,
        country: 'DE',
        taxId: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        syncVersion: 1,
      };

      const blob = await exporter.generateInvoicePDF({
        invoice: pdfInvoice,
        customer: pdfCustomer,
        language: 'de',
      });

      await exporter.saveToFile(blob, `${pdfInvoice.number}.pdf`);

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error('[PDF Export] Error:', err);
      setError(err instanceof Error ? err.message : 'PDF Fehler');
    } finally {
      setIsExporting(false);
    }
  }, [invoice]);

  const handleBack = useCallback(() => router.back(), [router]);

  /**
   * Handler fuer Aenderungen an Feldern im manuellen Formular.
   */
  const handleManualFormChange = useCallback((field: string, value: string) => {
    setManualForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleItemChange = useCallback((id: string, field: string, value: string | number) => {
    setManualForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  }, []);

  const handleAddItem = useCallback(() => {
    const newId = Math.random().toString(36).substr(2, 9);
    setManualForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { id: newId, description: '', quantity: 1, unitPrice: '', unit: 'Stück' },
      ],
    }));
  }, []);

  const handleRemoveItem = useCallback((id: string) => {
    setManualForm((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id),
    }));
  }, []);

  /**
   * Berechnet Summen aus den Positionen des manuellen Formulars.
   */
  const manualTotals = useMemo(() => {
    let subtotal = 0;
    manualForm.items.forEach((item) => {
      const q = typeof item.quantity === 'number' ? item.quantity : 0;
      const p = typeof item.unitPrice === 'number' ? item.unitPrice : 0;
      subtotal += q * p;
    });
    const taxRate = parseFloat(manualForm.taxRate) || 19;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  }, [manualForm.items, manualForm.taxRate]);

  /**
   * Generiert eine Rechnungsnummer.
   */
  const generateInvoiceNumber = useCallback(() => {
    const year = new Date().getFullYear();
    const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return `RE-${year}-${random}`;
  }, []);

  /**
   * Handler fuer das Erstellen der Rechnung aus der manuellen Eingabe.
   */
  const handleManualSubmit = useCallback(() => {
    const { subtotal, taxAmount, total } = manualTotals;
    const taxRate = parseFloat(manualForm.taxRate) || 19;

    const newInvoice: Invoice = {
      id: 'inv-new-' + Date.now(),
      number: manualForm.invoiceNumber || generateInvoiceNumber(),
      customerId: 'c-manual',
      customer: {
        id: 'c-manual',
        name: manualForm.customerName || 'Unbekannter Kunde',
        email: manualForm.customerEmail || undefined,
        phone: manualForm.customerPhone || undefined,
        address: manualForm.customerAddress || undefined,
        city: manualForm.customerCity || undefined,
        zipCode: manualForm.customerZipCode || undefined,
        taxId: manualForm.customerTaxId || undefined,
      },
      items: manualForm.items.map((item, index) => ({
        id: item.id || `item-${index}`,
        description: item.description || 'Position',
        quantity: typeof item.quantity === 'number' ? item.quantity : 0,
        unitPrice: typeof item.unitPrice === 'number' ? item.unitPrice : 0,
        total:
          (typeof item.quantity === 'number' ? item.quantity : 0) *
          (typeof item.unitPrice === 'number' ? item.unitPrice : 0),
        unit: item.unit || 'Stück',
      })),
      subtotal,
      taxRate,
      taxAmount,
      total,
      status: 'DRAFT',
      createdAt: new Date(manualForm.invoiceDate),
      dueDate: new Date(manualForm.dueDate),
      paymentTerms: manualForm.paymentTerms || undefined,
      notes: manualForm.notes || undefined,
    };

    setInvoice(newInvoice);
    setTranscription(
      `Manuelle Eingabe: ${manualForm.customerName} - ${manualForm.items.length} Positionen`
    );
    setConfidence(1.0);
    setProcessingState('complete');

    // Voice feedback
    speak(
      `Rechnung für ${manualForm.customerName} mit ${manualForm.items.length} Positionen über ${formatCurrency(manualTotals.total)} erstellt.`
    );
  }, [manualForm]);

  /**
   * Wechselt zwischen Sprach- und manuellem Modus.
   */
  const handleToggleMode = useCallback(() => {
    setIsManualMode((prev) => !prev);
    // Reset state when switching modes
    setProcessingState('idle');
    setInvoice(null);
    setTranscription('');
    setConfidence(null);
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10 bg-background min-h-screen">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-6">
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
            <h1 className="text-4xl font-black text-foreground tracking-tight">Neue Rechnung</h1>
            <p className="text-muted-foreground font-medium">
              Erstellen Sie Dokumente in Sekundenschnelle per Stimme.
            </p>
          </div>
        </div>
        <KeywordHelp />
      </div>

      {/* Status Messages - Floating Alerts */}
      <div
        className="fixed bottom-8 right-8 z-50 space-y-4 max-w-md w-full"
        role="status"
        aria-live="polite"
      >
        {error && (
          <div className="p-4 bg-destructive text-white rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right duration-300">
            <AlertCircle className="shrink-0" />
            <span className="font-bold">{error}</span>
          </div>
        )}
        {saveSuccess && (
          <div className="p-4 bg-primary text-white rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right duration-300">
            <CheckCircle2 className="shrink-0" />
            <span className="font-bold">Dokument erfolgreich gespeichert!</span>
          </div>
        )}
        {exportSuccess && (
          <div className="p-4 bg-accent text-white rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right duration-300">
            <Download className="shrink-0" />
            <span className="font-bold">PDF-Export erfolgreich abgeschlossen!</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        {/* Voice Recording / Manual Entry Section - Left (2/5) */}
        <div className="lg:col-span-2 space-y-8">
          {/* Mode Toggle */}
          <div className="flex rounded-xl bg-muted p-1">
            <button
              type="button"
              onClick={() => !isManualMode || handleToggleMode()}
              className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all ${
                !isManualMode
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Spracheingabe
            </button>
            <button
              type="button"
              onClick={() => isManualMode || handleToggleMode()}
              className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all ${
                isManualMode
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Manuelle Eingabe
            </button>
          </div>

          <section className="bg-card rounded-3xl border-2 border-primary/10 shadow-2xl shadow-primary/5 p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5">
              <Sparkles size={120} />
            </div>

            {!isManualMode ? (
              /* Voice Mode */
              <div className="relative z-10 flex flex-col items-center text-center space-y-8">
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-foreground">Voice Interface</h2>
                  <p className="text-sm text-muted-foreground">
                    Klicken Sie auf den Button und diktieren Sie die Rechnungsdaten.
                  </p>
                </div>

                <VoiceRecorderButton
                  onRecordingComplete={handleRecordingComplete}
                  disabled={processingState === 'processing'}
                />

                {/* Processing Indicator */}
                {processingState === 'processing' && (
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex gap-1">
                      <div className="w-2 h-8 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-2 h-12 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-2 h-8 bg-primary rounded-full animate-bounce" />
                    </div>
                    <span className="text-sm font-black text-primary uppercase tracking-[0.2em]">
                      AI Analyse läuft...
                    </span>
                  </div>
                )}
              </div>
            ) : (
              /* Manual Mode */
              <div className="relative z-10 space-y-6">
                <div className="space-y-2 text-center">
                  <h2 className="text-2xl font-black text-foreground">Manuelle Eingabe</h2>
                  <p className="text-sm text-muted-foreground">
                    Geben Sie die Rechnungsdaten direkt ein.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="customerName"
                      className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2"
                    >
                      Kundenname
                    </label>
                    <input
                      id="customerName"
                      type="text"
                      value={manualForm.customerName}
                      onChange={(e) => handleManualFormChange('customerName', e.target.value)}
                      placeholder="z.B. Musterfirma GmbH"
                      className="w-full bg-muted/20 border-2 border-transparent rounded-xl p-4 text-sm font-medium focus:border-primary/30 focus:outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-4">
                    {manualForm.items.map((item, index) => (
                      <div
                        key={item.id}
                        className="p-4 bg-muted/20 rounded-xl relative group border border-transparent hover:border-border transition-all"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            Position {index + 1}
                          </span>
                          {manualForm.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-destructive hover:text-red-700"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) =>
                              handleItemChange(item.id, 'description', e.target.value)
                            }
                            placeholder="Beschreibung"
                            className="w-full bg-background border-2 border-transparent rounded-lg p-2 text-sm focus:border-primary/30 outline-none"
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) =>
                                handleItemChange(item.id, 'quantity', parseFloat(e.target.value))
                              }
                              placeholder="Menge"
                              step="0.1"
                              className="w-full bg-background border-2 border-transparent rounded-lg p-2 text-sm focus:border-primary/30 outline-none"
                            />
                            <input
                              type="number"
                              value={item.unitPrice}
                              onChange={(e) =>
                                handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value))
                              }
                              placeholder="Einzelpreis (€)"
                              step="0.01"
                              className="w-full bg-background border-2 border-transparent rounded-lg p-2 text-sm focus:border-primary/30 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="w-full py-2 bg-muted/30 border-2 border-dashed border-muted-foreground/20 rounded-xl text-sm font-bold text-muted-foreground hover:bg-muted/50 hover:text-primary transition-all flex items-center justify-center gap-2"
                    >
                      + Weitere Position hinzufügen
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-4 bg-muted/10 rounded-xl border border-border/50 col-span-2">
                      <span className="text-sm font-bold text-muted-foreground">
                        Zwischensumme:
                      </span>
                      <span className="text-lg font-black">
                        {formatCurrency(manualTotals.subtotal)}
                      </span>
                    </div>

                    <div className="col-span-2">
                      <label
                        htmlFor="taxRate"
                        className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2"
                      >
                        MwSt. (%)
                      </label>
                      <select
                        id="taxRate"
                        value={manualForm.taxRate}
                        onChange={(e) => handleManualFormChange('taxRate', e.target.value)}
                        className="w-full bg-muted/20 border-2 border-transparent rounded-xl p-4 text-sm font-medium focus:border-primary/30 focus:outline-none transition-all"
                      >
                        <option value="19">19%</option>
                        <option value="7">7%</option>
                        <option value="0">0%</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleManualSubmit}
                    disabled={
                      !manualForm.customerName ||
                      manualForm.items.length === 0 ||
                      !manualForm.items[0].description
                    }
                    className="w-full py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Rechnung erstellen
                  </button>
                </div>
              </div>
            )}

            {/* Transcription Area */}
            <div className="mt-10 space-y-4">
              <div className="flex justify-between items-end">
                <label
                  htmlFor="transcription"
                  className="text-[10px] font-black uppercase tracking-widest text-muted-foreground"
                >
                  Echtzeit-Transkription
                </label>
                {confidence !== null && (
                  <div className="px-2 py-0.5 rounded-md bg-green-500/10 text-green-600 text-[10px] font-black">
                    {Math.round(confidence * 100)}% Genauigkeit
                  </div>
                )}
              </div>
              <textarea
                id="transcription"
                value={transcription}
                onChange={handleTranscriptionChange}
                rows={5}
                placeholder="Hier erscheint Ihre Sprache als Text..."
                className="w-full bg-muted/20 border-2 border-transparent rounded-2xl p-4 text-sm font-medium focus:border-primary/30 focus:outline-none transition-all resize-none italic text-muted-foreground"
              />
            </div>
          </section>
        </div>

        {/* Invoice Preview Section - Right (3/5) */}
        <div className="lg:col-span-3 space-y-8">
          <section className="bg-white dark:bg-gray-900 rounded-3xl border border-border/50 shadow-2xl p-10 min-h-[600px] flex flex-col relative">
            <div className="flex items-center justify-between mb-10 border-b border-border/50 pb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-accent text-white flex items-center justify-center">
                  <FileText size={24} />
                </div>
                <h2 className="text-2xl font-black text-foreground tracking-tight">
                  Dokumentenvorschau
                </h2>
              </div>
              {invoice && !isEditing && (
                <button
                  type="button"
                  onClick={handleEditClick}
                  className="px-4 py-2 rounded-xl bg-muted text-foreground text-xs font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-sm"
                >
                  Manuell anpassen
                </button>
              )}
            </div>

            {invoice ? (
              <div className="flex-1 space-y-10 animate-in fade-in zoom-in-95 duration-500">
                {/* Invoice Header */}
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                      Rechnungsnummer
                    </p>
                    <p className="text-2xl font-black text-foreground">{invoice.number}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                      Empfänger
                    </p>
                    <p className="text-xl font-bold text-foreground">{invoice.customer.name}</p>
                  </div>
                </div>

                {/* Invoice Items Table */}
                <div className="overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-border text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                        <th className="pb-4 text-left">Beschreibung</th>
                        <th className="pb-4 text-right">Menge</th>
                        <th className="pb-4 text-right">Einzelpreis</th>
                        <th className="pb-4 text-right">Gesamt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {invoice.items.map((item) => (
                        <tr key={item.id} className="text-foreground group">
                          <td className="py-6 font-bold">{item.description}</td>
                          <td className="py-6 text-right text-muted-foreground">{item.quantity}</td>
                          <td className="py-6 text-right text-muted-foreground font-mono">
                            {formatCurrency(item.unitPrice)}
                          </td>
                          <td className="py-6 text-right font-black font-mono">
                            {formatCurrency(item.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Invoice Totals */}
                <div className="mt-auto pt-10 border-t-4 border-double border-border space-y-4">
                  <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
                    <span>Netto Betrag</span>
                    <span className="font-mono">{formatCurrency(invoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
                    <span>Mehrwertsteuer ({invoice.taxRate}%)</span>
                    <span className="font-mono">{formatCurrency(invoice.taxAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-border/50">
                    <span className="text-xl font-black uppercase tracking-widest text-primary">
                      Gesamtbrutto
                    </span>
                    <div className="text-right">
                      <span
                        className="text-4xl font-black block tracking-tighter text-foreground"
                        data-testid="invoice-total"
                      >
                        {formatCurrency(invoice.total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground space-y-6 border-4 border-dashed border-border/20 rounded-3xl">
                <div className="w-20 h-20 bg-muted/30 rounded-full flex items-center justify-center animate-pulse">
                  <FileText size={40} className="opacity-20" />
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-foreground/40">Keine Daten verfügbar</p>
                  <p className="text-sm">
                    Starten Sie die Sprachaufnahme um die Vorschau zu füllen.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Action Buttons */}
          {invoice && (
            <div className="flex flex-col sm:flex-row justify-end gap-4 animate-in slide-up-4 duration-500">
              <button
                type="button"
                onClick={handleExportPDF}
                disabled={isExporting}
                className="flex-1 sm:flex-none px-10 py-4 rounded-2xl bg-card border-2 border-border text-foreground font-black uppercase tracking-widest text-xs hover:bg-muted transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {isExporting ? (
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download size={16} />
                )}
                {isExporting ? 'Exportiert...' : 'PDF Export'}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 sm:flex-none px-12 py-4 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/25 hover:bg-primary/90 transition-all flex items-center justify-center gap-2 transform active:scale-95"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                {isSaving ? 'Speichert...' : 'Dokument Finalisieren'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
