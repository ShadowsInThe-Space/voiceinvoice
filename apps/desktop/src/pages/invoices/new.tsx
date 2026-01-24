/**
 * Invoice Creation Page
 *
 * Voice-first invoice creation with transcription, preview, and PDF export.
 *
 * @module pages/invoices/new
 */

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { VoiceRecorderButton } from '../../components/VoiceRecorderButton';
import { ChevronLeft, FileText, Send, Download, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';

/**
 * Invoice item type.
 */
interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

/**
 * Invoice type.
 */
interface Invoice {
  id: string;
  number: string;
  customerId: string;
  customer: { id: string; name: string };
  items: InvoiceItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  status: string;
  createdAt: Date;
}

/**
 * Format currency for German locale.
 *
 * @param {number} amount - The numeric amount to format.
 * @returns {string} The formatted currency string.
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

/**
 * Invoice Creation Page component.
 *
 * @returns {React.ReactElement} The rendered NewInvoicePage.
 */
export default function NewInvoicePage(): React.ReactElement {
  const router = useRouter();

  // Processing state
  const [processingState, setProcessingState] = useState<'idle' | 'processing' | 'complete' | 'error'>('idle');
  const [transcription, setTranscription] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  /**
   * Handle recording completion.
   */
  const handleRecordingComplete = useCallback(async (blob: Blob, duration: number) => {
    console.log(`Recording completed. Duration: ${duration}ms, Size: ${blob.size} bytes, Type: ${blob.type}`);
    setProcessingState('processing');
    setError(null);

    // Simulated AI Processing
    setTimeout(() => {
      const mockResult = {
        success: true,
        invoice: {
          id: 'inv-new-' + Date.now(),
          number: 'RE-2025-001',
          customerId: 'c1',
          customer: { id: 'c1', name: 'Musterfirma GmbH' },
          items: [
            { id: 'item-1', description: 'Beratung & Strategie', quantity: 1, unitPrice: 150, total: 150 },
          ],
          subtotal: 150,
          taxRate: 19,
          taxAmount: 28.5,
          total: 178.5,
          status: 'DRAFT',
          createdAt: new Date(),
        },
        transcription: 'Erstelle eine Rechnung für Test Kunde über Sprachgesteuerte Rechnungserstellung für 150 Euro.',
        confidence: 0.98,
      };

      setInvoice(mockResult.invoice);
      setTranscription(mockResult.transcription);
      setConfidence(mockResult.confidence);
      setProcessingState('complete');
    }, 800);
  }, []);

  const handleTranscriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTranscription(e.target.value);
  }, []);

  const handleEditClick = useCallback(() => setIsEditing(true), []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    }, 1000);
  }, []);

  const handleExportPDF = useCallback(async () => {
    if (!invoice) return;
    setIsExporting(true);
    setExportSuccess(false);
    setError(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF Fehler');
    } finally {
      setIsExporting(false);
    }
  }, [invoice]);

  const handleBack = useCallback(() => router.back(), [router]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10 bg-background min-h-screen">
      {/* Page Header */}
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
          <h1 className="text-4xl font-black text-foreground tracking-tight">
            Neue Rechnung
          </h1>
          <p className="text-muted-foreground font-medium">Erstellen Sie Dokumente in Sekundenschnelle per Stimme.</p>
        </div>
      </div>

      {/* Status Messages - Floating Alerts */}
      <div className="fixed bottom-8 right-8 z-50 space-y-4 max-w-md w-full" role="status" aria-live="polite">
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
        {/* Voice Recording Section - Left (2/5) */}
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-card rounded-3xl border-2 border-primary/10 shadow-2xl shadow-primary/5 p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5">
              <Sparkles size={120} />
            </div>
            
            <div className="relative z-10 flex flex-col items-center text-center space-y-8">
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-foreground">Voice Interface</h2>
                <p className="text-sm text-muted-foreground">Klicken Sie auf den Button und diktieren Sie die Rechnungsdaten.</p>
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
                  <span className="text-sm font-black text-primary uppercase tracking-[0.2em]">AI Analyse läuft...</span>
                </div>
              )}
            </div>

            {/* Transcription Area */}
            <div className="mt-10 space-y-4">
              <div className="flex justify-between items-end">
                <label htmlFor="transcription" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
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
                <h2 className="text-2xl font-black text-foreground tracking-tight">Dokumentenvorschau</h2>
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
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Rechnungsnummer</p>
                    <p className="text-2xl font-black text-foreground">{invoice.number}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Empfänger</p>
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
                          <td className="py-6 text-right text-muted-foreground font-mono">{formatCurrency(item.unitPrice)}</td>
                          <td className="py-6 text-right font-black font-mono">{formatCurrency(item.total)}</td>
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
                    <span className="text-xl font-black uppercase tracking-widest text-primary">Gesamtbrutto</span>
                    <div className="text-right">
                      <span className="text-4xl font-black block tracking-tighter text-foreground" data-testid="invoice-total">
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
                  <p className="text-sm">Starten Sie die Sprachaufnahme um die Vorschau zu füllen.</p>
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
                {isExporting ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Download size={16} />}
                {isExporting ? 'Exportiert...' : 'PDF Export'}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 sm:flex-none px-12 py-4 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/25 hover:bg-primary/90 transition-all flex items-center justify-center gap-2 transform active:scale-95"
              >
                {isSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={16} />}
                {isSaving ? 'Speichert...' : 'Dokument Finalisieren'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

