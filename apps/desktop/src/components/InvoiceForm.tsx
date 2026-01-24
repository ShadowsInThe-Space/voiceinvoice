/**
 * InvoiceForm component.
 *
 * A form component for creating and editing invoices with
 * automatic tax calculations.
 *
 * @module components/InvoiceForm
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { Invoice, InvoiceStatus, TaxRate } from '@voiceinvoice/shared-types';

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
  { value: 'OVERDUE', label: 'Ueberfaellig' },
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
 * Features:
 * - Automatic tax and gross amount calculation
 * - Form validation
 * - Support for all German tax rates
 * - Status management
 *
 * @param {InvoiceFormProps} props - Component props
 * @returns {JSX.Element} Rendered form
 *
 * @example
 * <InvoiceForm
 *   invoice={existingInvoice}
 *   onSubmit={(data) => saveInvoice(data)}
 *   onCancel={() => closeModal()}
 * />
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

    if (!invoiceNumber.trim()) {
      newErrors.invoiceNumber = 'Rechnungsnummer ist erforderlich';
    }

    if (netAmount === '' || netAmount === 0) {
      newErrors.netAmount = 'Betrag muss groesser als 0 sein';
    } else if (typeof netAmount === 'number' && netAmount < 0) {
      newErrors.netAmount = 'Betrag muss positiv sein';
    }

    if (!date) {
      newErrors.date = 'Datum ist erforderlich';
    }

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

      // Mark all fields as touched on submit to show validation errors
      setTouched({
        invoiceNumber: true,
        netAmount: true,
        date: true,
      });

      if (Object.keys(validationErrors).length > 0) {
        return;
      }

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
    [
      invoiceNumber,
      date,
      dueDate,
      netAmount,
      taxRate,
      taxAmount,
      grossAmount,
      status,
      description,
      invoice?.customerId,
      onSubmit,
      validate,
    ]
  );

  /**
   * Marks a field as touched on blur.
   */
  const handleBlur = useCallback((field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  // Validate on change when fields are touched
  useEffect(() => {
    if (Object.keys(touched).length > 0) {
      setErrors(validate());
    }
  }, [invoiceNumber, netAmount, date, touched, validate]);

  return (
    <form
      role="form"
      onSubmit={handleSubmit}
      className="space-y-6 max-w-lg"
      aria-label="Rechnungsformular"
    >
      {/* Invoice Number */}
      <div>
        <label
          htmlFor="invoiceNumber"
          className="block text-sm font-medium text-gray-700"
        >
          Rechnungsnummer
        </label>
        <input
          type="text"
          id="invoiceNumber"
          value={invoiceNumber}
          onChange={(e) => setInvoiceNumber(e.target.value)}
          onBlur={() => handleBlur('invoiceNumber')}
          className={`
            mt-1 block w-full rounded-md shadow-sm
            ${errors.invoiceNumber && touched.invoiceNumber
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
            }
          `}
          aria-invalid={!!errors.invoiceNumber}
          aria-describedby={errors.invoiceNumber ? 'invoiceNumber-error' : undefined}
        />
        {errors.invoiceNumber && touched.invoiceNumber && (
          <p id="invoiceNumber-error" className="mt-1 text-sm text-red-600">
            {errors.invoiceNumber}
          </p>
        )}
      </div>

      {/* Date */}
      <div>
        <label
          htmlFor="date"
          className="block text-sm font-medium text-gray-700"
        >
          Datum
        </label>
        <input
          type="date"
          id="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          onBlur={() => handleBlur('date')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      {/* Due Date */}
      <div>
        <label
          htmlFor="dueDate"
          className="block text-sm font-medium text-gray-700"
        >
          Faelligkeitsdatum
        </label>
        <input
          type="date"
          id="dueDate"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      {/* Net Amount */}
      <div>
        <label
          htmlFor="netAmount"
          className="block text-sm font-medium text-gray-700"
        >
          Nettobetrag (EUR)
        </label>
        <input
          type="number"
          id="netAmount"
          value={netAmount}
          onChange={(e) => setNetAmount(e.target.value ? parseFloat(e.target.value) : '')}
          onBlur={() => handleBlur('netAmount')}
          step="0.01"
          min="0"
          className={`
            mt-1 block w-full rounded-md shadow-sm
            ${errors.netAmount && touched.netAmount
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
            }
          `}
          aria-invalid={!!errors.netAmount}
          aria-describedby={errors.netAmount ? 'netAmount-error' : undefined}
        />
        {errors.netAmount && touched.netAmount && (
          <p id="netAmount-error" className="mt-1 text-sm text-red-600">
            {errors.netAmount}
          </p>
        )}
      </div>

      {/* Tax Rate */}
      <div>
        <label
          htmlFor="taxRate"
          className="block text-sm font-medium text-gray-700"
        >
          Steuersatz
        </label>
        <select
          id="taxRate"
          value={taxRate}
          onChange={(e) => setTaxRate(parseInt(e.target.value, 10) as TaxRate)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          {TAX_RATES.map((rate) => (
            <option key={rate} value={rate}>
              {rate}%
            </option>
          ))}
        </select>
      </div>

      {/* Calculated Amounts Display */}
      <div className="bg-gray-50 p-4 rounded-md space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Netto:</span>
          <span className="font-medium">
            {typeof netAmount === 'number' ? netAmount.toFixed(2) : '0.00'} EUR
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">MwSt ({taxRate}%):</span>
          <span data-testid="tax-amount" className="font-medium">
            {taxAmount.toFixed(2)} EUR
          </span>
        </div>
        <div className="flex justify-between text-sm border-t pt-2">
          <span className="text-gray-900 font-semibold">Brutto:</span>
          <span data-testid="gross-amount" className="font-semibold text-blue-600">
            {grossAmount.toFixed(2)} EUR
          </span>
        </div>
      </div>

      {/* Status */}
      <div>
        <label
          htmlFor="status"
          className="block text-sm font-medium text-gray-700"
        >
          Status
        </label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          {INVOICE_STATUSES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700"
        >
          Beschreibung
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Abbrechen
          </button>
        )}
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Speichern
        </button>
      </div>
    </form>
  );
}
