import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { Invoice, InvoiceStatus, TaxRate } from '@voiceinvoice/shared-types';
import { FileText, Calendar, DollarSign, Tag, Info, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * Form data structure for invoice submission.
 */
export interface InvoiceFormData {
  invoiceNumber: string;
  customerId?: string | undefined;
  date: Date;
  dueDate?: Date | undefined;
  netAmount: number;
  taxRate: TaxRate;
  taxAmount: number;
  grossAmount: number;
  currency: string;
  status: InvoiceStatus;
  description?: string | undefined;
}

/**
 * Props for InvoiceForm component.
 */
export interface InvoiceFormProps {
  /** Existing invoice data for editing mode */
  invoice?: Partial<Invoice>;
  /** Callback when form is submitted */
  onSubmit: (data: InvoiceFormData) => void;
  /** Callback when form is cancelled */
  onCancel?: () => void;
}

/**
 * Validation errors type.
 */
interface ValidationErrors {
  invoiceNumber?: string;
  netAmount?: string;
  date?: string;
}

/**
 * Available tax rates in Germany.
 */
const TAX_RATES: TaxRate[] = [0, 7, 19];

/**
 * Available invoice statuses.
 */
const INVOICE_STATUSES: { value: InvoiceStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Entwurf' },
  { value: 'PENDING', label: 'Offen' },
  { value: 'PAID', label: 'Bezahlt' },
  { value: 'CANCELLED', label: 'Storniert' },
  { value: 'OVERDUE', label: 'Überfällig' },
];

/**
 * Formats a date to YYYY-MM-DD for input fields.
 *
 * @param {Date | undefined} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDateForInput(date: Date | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

/**
 * Invoice creation and editing form.
 *
 * @param {InvoiceFormProps} props - The component props.
 * @param {object} [props.invoice] - Initial invoice data for editing.
 * @param {Function} props.onSubmit - Submission handler.
 * @param {Function} [props.onCancel] - Cancellation handler.
 * @returns {JSX.Element} The rendered form component.
 */
export function InvoiceForm({
  invoice,
  onSubmit,
  onCancel,
}: InvoiceFormProps): JSX.Element {
  // Form state
  const [invoiceNumber, setInvoiceNumber] = useState(invoice?.invoiceNumber || '');
  const [date, setDate] = useState(formatDateForInput(invoice?.date) || formatDateForInput(new Date()));
  const [dueDate, setDueDate] = useState(formatDateForInput(invoice?.dueDate) || '');
  const [netAmount, setNetAmount] = useState<number | ''>(invoice?.netAmount ?? '');
  const [taxRate, setTaxRate] = useState<TaxRate>(invoice?.taxRate ?? 19);
  const [status, setStatus] = useState<InvoiceStatus>(invoice?.status ?? 'DRAFT');
  const [description, setDescription] = useState(invoice?.description || '');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Calculate tax and gross amounts
  const { taxAmount, grossAmount } = useMemo(() => {
    const net = typeof netAmount === 'number' ? netAmount : 0;
    const tax = (net * taxRate) / 100;
    return {
      taxAmount: Math.round(tax * 100) / 100,
      grossAmount: Math.round((net + tax) * 100) / 100,
    };
  }, [netAmount, taxRate]);

  /**
   * Validates the form and returns validation errors.
   */
  const validate = useCallback((): ValidationErrors => {
    const newErrors: ValidationErrors = {};
    if (!invoiceNumber.trim()) newErrors.invoiceNumber = 'Erforderlich';
    if (netAmount === '' || netAmount === 0) newErrors.netAmount = '> 0 erforderlich';
    else if (typeof netAmount === 'number' && netAmount < 0) newErrors.netAmount = 'Muss positiv sein';
    if (!date) newErrors.date = 'Erforderlich';
    return newErrors;
  }, [invoiceNumber, netAmount, date]);

  /**
   * Handles form submission.
   */
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const validationErrors = validate();
      setErrors(validationErrors);
      setTouched({ invoiceNumber: true, netAmount: true, date: true });

      if (Object.keys(validationErrors).length > 0) return;

      const formData: InvoiceFormData = {
        invoiceNumber: invoiceNumber.trim(),
        date: new Date(date),
        dueDate: dueDate ? new Date(dueDate) : undefined,
        netAmount: typeof netAmount === 'number' ? netAmount : 0,
        taxRate,
        taxAmount,
        grossAmount,
        currency: 'EUR',
        status,
        description: description.trim() || undefined,
        customerId: invoice?.customerId,
      };
      onSubmit(formData);
    },
    [invoiceNumber, date, dueDate, netAmount, taxRate, taxAmount, grossAmount, status, description, invoice?.customerId, onSubmit, validate]
  );

  const handleBlur = useCallback((field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  useEffect(() => {
    if (Object.keys(touched).length > 0) setErrors(validate());
  }, [invoiceNumber, netAmount, date, touched, validate]);

  return (
    <form
      role="form"
      onSubmit={handleSubmit}
      className="max-w-4xl mx-auto space-y-8"
      aria-label="Rechnungsformular"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Core Details */}
        <div className="space-y-8">
          <section className="bg-card rounded-2xl border border-border/50 shadow-xl p-8 space-y-6">
            <div className="flex items-center gap-3 border-b border-border/50 pb-4 mb-2">
              <FileText className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Rechnungsdetails</h2>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {/* Invoice Number */}
              <div className="space-y-2">
                <label htmlFor="invoiceNumber" className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                  Rechnungsnummer
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="invoiceNumber"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    onBlur={() => handleBlur('invoiceNumber')}
                    placeholder="RE-2025-001"
                    className={cn(
                      "w-full px-4 py-3 bg-muted/20 rounded-xl border-2 transition-all focus:outline-none focus:ring-4 focus:ring-primary/10",
                      errors.invoiceNumber && touched.invoiceNumber ? "border-destructive/50" : "border-transparent focus:border-primary"
                    )}
                  />
                  {errors.invoiceNumber && touched.invoiceNumber && (
                    <span data-testid="error-invoiceNumber" className="absolute right-3 top-3 text-destructive text-xs font-bold">{errors.invoiceNumber}</span>
                  )}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="date" className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> Ausstellungsdatum
                  </label>
                  <input
                    type="date"
                    id="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-4 py-3 bg-muted/20 rounded-xl border-2 border-transparent focus:border-primary transition-all focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="dueDate" className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> Fälligkeit
                  </label>
                  <input
                    type="date"
                    id="dueDate"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-4 py-3 bg-muted/20 rounded-xl border-2 border-transparent focus:border-primary transition-all focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="bg-card rounded-2xl border border-border/50 shadow-xl p-8 space-y-6">
            <div className="flex items-center gap-3 border-b border-border/50 pb-4 mb-2">
              <Tag className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Status & Beschreibung</h2>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="status" className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                  Zahlungsstatus
                </label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
                  className="w-full px-4 py-3 bg-muted/20 rounded-xl border-2 border-transparent focus:border-primary transition-all focus:outline-none appearance-none cursor-pointer"
                >
                  {INVOICE_STATUSES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                  Beschreibung / Notiz
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Details zur Leistung..."
                  className="w-full px-4 py-3 bg-muted/20 rounded-xl border-2 border-transparent focus:border-primary transition-all focus:outline-none resize-none"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Financials */}
        <div className="space-y-8">
          <section className="bg-primary text-white rounded-2xl shadow-xl shadow-primary/20 p-8 space-y-8 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <DollarSign size={120} />
            </div>
            
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-3 border-b border-white/20 pb-4">
                <CheckCircle2 className="w-5 h-5 text-white" />
                <h2 className="text-xl font-bold">Beträge & Kalkulation</h2>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="netAmount" className="text-sm font-black uppercase tracking-widest opacity-80">
                    Nettobetrag (EUR)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      id="netAmount"
                      value={netAmount}
                      onChange={(e) => setNetAmount(e.target.value ? parseFloat(e.target.value) : '')}
                      onBlur={() => handleBlur('netAmount')}
                      step="0.01"
                      className={cn(
                        "w-full bg-white/10 border-2 rounded-xl px-4 py-4 text-2xl font-black focus:outline-none transition-all placeholder:text-white/30",
                        errors.netAmount && touched.netAmount ? "border-red-400" : "border-white/20 focus:border-white"
                      )}
                      placeholder="0,00"
                    />
                    {errors.netAmount && touched.netAmount && (
                      <span className="absolute right-3 top-4 text-red-300 text-xs font-bold">{errors.netAmount}</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="taxRate" className="text-sm font-black uppercase tracking-widest opacity-80">
                    Mehrwertsteuer
                  </label>
                  <div className="flex gap-2">
                    {TAX_RATES.map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setTaxRate(rate)}
                        className={cn(
                          "flex-1 py-3 rounded-xl font-bold transition-all border-2",
                          taxRate === rate 
                            ? "bg-white text-primary border-white" 
                            : "bg-white/5 border-white/10 hover:bg-white/10"
                        )}
                      >
                        {rate}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-white/20 space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium opacity-80">Netto Summe:</span>
                  <span className="font-bold">{(typeof netAmount === 'number' ? netAmount : 0).toFixed(2)} €</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium opacity-80">MwSt ({taxRate}%):</span>
                  <span className="font-bold">{taxAmount.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between items-center pt-4">
                  <span className="text-lg font-black uppercase tracking-tighter">Gesamtbetrag</span>
                  <div className="text-right">
                    <span className="text-4xl font-black block tracking-tighter">{grossAmount.toFixed(2)} €</span>
                    <span className="text-[10px] font-bold opacity-60 uppercase tracking-widest">Inkl. MwSt</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Tips / Info */}
          <div className="bg-accent/5 border-2 border-accent/10 rounded-2xl p-6 flex gap-4">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Info className="w-5 h-5 text-accent" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-foreground">Pro-Tipp</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Verwenden Sie Sprachbefehle wie <span className="font-bold text-accent italic">"Netto einhundert Euro"</span> um Felder automatisch zu füllen.
              </p>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-col gap-3">
            <button
              type="submit"
              className="w-full py-4 bg-accent text-white rounded-xl font-black text-lg shadow-xl shadow-accent/25 hover:bg-accent/90 transition-all transform active:scale-95 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-6 h-6" />
              Rechnung speichern
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="w-full py-3 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
              >
                Abbrechen & Verwerfen
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}

