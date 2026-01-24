/**
 * Invoice Creation Page
 *
 * Voice-first invoice creation with transcription, preview, and PDF export.
 *
 * @module pages/invoices/new
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/router';

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
 * Pipeline result type.
 */
interface PipelineResult {
  success: boolean;
  invoice?: Invoice;
  transcription?: string;
  confidence?: number;
  error?: string;
}

/**
 * Processing state.
 */
type ProcessingState = 'idle' | 'recording' | 'processing' | 'complete' | 'error';

/**
 * Format duration in milliseconds to MM:SS.
 */
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format currency for German locale.
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

/**
 * Invoice Creation Page component.
 */
export default function NewInvoicePage(): React.ReactElement {
  const router = useRouter();

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Processing state
  const [processingState, setProcessingState] = useState<ProcessingState>('idle');
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

  // Recording timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration((prev) => prev + 1000);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  // Simulate mock data on mount for demo
  useEffect(() => {
    // Load mock invoice data for demonstration
    const mockInvoice: Invoice = {
      id: 'inv-1',
      number: 'RE-2025-001',
      customerId: 'c1',
      customer: { id: 'c1', name: 'Musterfirma GmbH' },
      items: [
        { id: 'item-1', description: 'Beratung', quantity: 2, unitPrice: 150, total: 300 },
      ],
      subtotal: 300,
      taxRate: 19,
      taxAmount: 57,
      total: 357,
      status: 'DRAFT',
      createdAt: new Date(),
    };

    setInvoice(mockInvoice);
    setTranscription('Rechnung fuer Musterfirma GmbH');
    setConfidence(0.95);
    setProcessingState('complete');
  }, []);

  /**
   * Start voice recording.
   */
  const handleStartRecording = useCallback(async () => {
    setError(null);
    setRecordingDuration(0);
    setIsRecording(true);
    setProcessingState('recording');
  }, []);

  /**
   * Stop voice recording and process.
   */
  const handleStopRecording = useCallback(async () => {
    setIsRecording(false);
    setProcessingState('processing');

    // Simulate processing delay
    setTimeout(() => {
      const mockResult: PipelineResult = {
        success: true,
        invoice: {
          id: 'inv-new',
          number: 'RE-2025-002',
          customerId: 'c1',
          customer: { id: 'c1', name: 'Test Kunde' },
          items: [
            { id: 'item-1', description: 'Dienstleistung', quantity: 1, unitPrice: 100, total: 100 },
          ],
          subtotal: 100,
          taxRate: 19,
          taxAmount: 19,
          total: 119,
          status: 'DRAFT',
          createdAt: new Date(),
        },
        transcription: 'Rechnung fuer Test Kunde',
        confidence: 0.92,
      };

      if (mockResult.success && mockResult.invoice) {
        setInvoice(mockResult.invoice);
        setTranscription(mockResult.transcription || '');
        setConfidence(mockResult.confidence || null);
        setProcessingState('complete');
      } else {
        setError(mockResult.error || 'Verarbeitung fehlgeschlagen');
        setProcessingState('error');
      }
    }, 1500);
  }, []);

  /**
   * Handle transcription change.
   */
  const handleTranscriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTranscription(e.target.value);
  }, []);

  /**
   * Toggle edit mode.
   */
  const handleEditClick = useCallback(() => {
    setIsEditing(true);
  }, []);

  /**
   * Save invoice.
   */
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    // Simulate save delay
    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess(true);
      setIsEditing(false);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    }, 1000);
  }, []);

  /**
   * Export invoice as PDF.
   */
  const handleExportPDF = useCallback(async () => {
    if (!invoice) return;

    setIsExporting(true);
    setExportSuccess(false);
    setError(null);

    try {
      // Simulate PDF generation delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setExportSuccess(true);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setExportSuccess(false);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF Fehler');
    } finally {
      setIsExporting(false);
    }
  }, [invoice]);

  /**
   * Navigate back.
   */
  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleBack}
          className="p-2 rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          aria-label="Zurueck"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Neue Rechnung
        </h1>
      </div>

      {/* Status Messages */}
      <div role="status" aria-live="polite">
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/50 text-red-800 dark:text-red-300 rounded-md">
            {error}
          </div>
        )}
        {saveSuccess && (
          <div className="p-4 bg-green-50 dark:bg-green-900/50 text-green-800 dark:text-green-300 rounded-md">
            Rechnung gespeichert!
          </div>
        )}
        {exportSuccess && (
          <div className="p-4 bg-green-50 dark:bg-green-900/50 text-green-800 dark:text-green-300 rounded-md">
            PDF erstellt!
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Voice Recording Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Sprachaufnahme
          </h2>

          {/* Recording Button */}
          <div className="flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              disabled={processingState === 'processing'}
              aria-label={isRecording ? 'Aufnahme stoppen' : 'Aufnahme starten'}
              className={`
                relative flex items-center justify-center w-20 h-20 rounded-full
                transition-all duration-200 ease-in-out
                focus:outline-none focus:ring-2 focus:ring-offset-2
                ${isRecording
                  ? 'bg-red-500 hover:bg-red-600 focus:ring-red-500'
                  : 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500'
                }
                ${processingState === 'processing' ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {isRecording ? (
                <>
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                  <span
                    data-testid="recording-indicator"
                    className="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-75"
                  />
                </>
              ) : (
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
              )}
            </button>

            {/* Recording Duration */}
            {isRecording && (
              <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                {formatDuration(recordingDuration)}
              </span>
            )}

            {/* Processing Indicator */}
            {processingState === 'processing' && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                <span>Verarbeite...</span>
              </div>
            )}
          </div>

          {/* Transcription Area */}
          <div className="mt-6">
            <label
              htmlFor="transcription"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Transkription
            </label>
            <textarea
              id="transcription"
              value={transcription}
              onChange={handleTranscriptionChange}
              rows={4}
              placeholder="Hier erscheint die Transkription..."
              className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            {confidence !== null && (
              <div
                data-testid="confidence-score"
                className="mt-2 text-sm text-gray-500 dark:text-gray-400"
              >
                Konfidenz: {Math.round(confidence * 100)}%
              </div>
            )}
          </div>
        </div>

        {/* Invoice Preview Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Vorschau
            </h2>
            {invoice && !isEditing && (
              <button
                type="button"
                onClick={handleEditClick}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Bearbeiten
              </button>
            )}
          </div>

          {invoice ? (
            <div className="space-y-4">
              {/* Invoice Header */}
              <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  {invoice.number}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {invoice.customer.name}
                </p>
              </div>

              {/* Invoice Items */}
              {isEditing ? (
                <form role="form" aria-label="Rechnungsformular" className="space-y-4">
                  {invoice.items.map((item, index) => (
                    <div key={item.id} className="grid grid-cols-4 gap-2">
                      <input
                        type="text"
                        defaultValue={item.description}
                        className="col-span-2 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                        aria-label={`Position ${index + 1} Beschreibung`}
                      />
                      <input
                        type="number"
                        defaultValue={item.quantity}
                        className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                        aria-label={`Position ${index + 1} Menge`}
                      />
                      <input
                        type="number"
                        defaultValue={item.unitPrice}
                        className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                        aria-label={`Position ${index + 1} Preis`}
                      />
                    </div>
                  ))}
                </form>
              ) : (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400">
                      <th className="pb-2">Beschreibung</th>
                      <th className="pb-2 text-right">Menge</th>
                      <th className="pb-2 text-right">Preis</th>
                      <th className="pb-2 text-right">Gesamt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item) => (
                      <tr key={item.id} className="text-gray-900 dark:text-white">
                        <td className="py-1">{item.description}</td>
                        <td className="py-1 text-right">{item.quantity}</td>
                        <td className="py-1 text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="py-1 text-right">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Invoice Totals */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>Netto</span>
                  <span>{formatCurrency(invoice.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>MwSt ({invoice.taxRate}%)</span>
                  <span>{formatCurrency(invoice.taxAmount)}</span>
                </div>
                <div className="flex justify-between font-medium text-gray-900 dark:text-white">
                  <span>Brutto</span>
                  <span data-testid="invoice-total">{formatCurrency(invoice.total)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Keine Rechnung vorhanden. Starten Sie eine Sprachaufnahme.
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {invoice && (
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isExporting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            {isExporting ? 'Exportiert...' : 'PDF exportieren'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? 'Speichert...' : 'Speichern'}
          </button>
        </div>
      )}
    </div>
  );
}
