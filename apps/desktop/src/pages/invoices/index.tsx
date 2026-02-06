/**
 * Rechnungsuebersicht (Liste)
 *
 * Zeigt alle Rechnungen als Liste inkl. Aktionen (Auswaehlen, Loeschen, Neu anlegen).
 *
 * @module pages/invoices/index
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { InvoiceList } from '../../components/InvoiceList';
import type { Invoice, InvoiceStatus, TaxRate } from '@voiceinvoice/shared-types';

interface InvoiceListItemApi {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate: string | null;
  netAmount: number;
  taxRate: number;
  taxAmount: number;
  grossAmount: number;
  currency: string;
  status: string;
  description: string;
  customerId: string;
  createdAt: string;
  updatedAt: string;
}

interface InvoiceListResponseSuccessApi {
  success: true;
  invoices: InvoiceListItemApi[];
  count?: number;
}

interface InvoiceListResponseErrorApi {
  success: false;
  error?: string;
}

type InvoiceListResponseApi = InvoiceListResponseSuccessApi | InvoiceListResponseErrorApi;

/**
 * Prueft, ob ein Wert ein "plain object" ist.
 *
 * @param {unknown} value - Der zu pruefende Wert.
 * @returns {value is Record<string, unknown>} `true`, wenn es sich um ein Objekt handelt.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Laufzeit-Check fuer das Invoice-List-Item aus der API.
 *
 * @param {unknown} value - Der zu pruefende Wert.
 * @returns {value is InvoiceListItemApi} `true`, wenn die Struktur dem erwarteten API-Format entspricht.
 */
function isInvoiceListItemApi(value: unknown): value is InvoiceListItemApi {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === 'string' &&
    typeof value.invoiceNumber === 'string' &&
    typeof value.date === 'string' &&
    (typeof value.dueDate === 'string' || value.dueDate === null) &&
    typeof value.netAmount === 'number' &&
    typeof value.taxRate === 'number' &&
    typeof value.taxAmount === 'number' &&
    typeof value.grossAmount === 'number' &&
    typeof value.currency === 'string' &&
    typeof value.status === 'string' &&
    typeof value.description === 'string' &&
    typeof value.customerId === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

/**
 * Laufzeit-Check fuer die Antwort von `/api/invoices/list`.
 *
 * @param {unknown} value - Die geparste JSON-Antwort.
 * @returns {value is InvoiceListResponseApi} `true`, wenn die Antwort dem erwarteten Format entspricht.
 */
function isInvoiceListResponseApi(value: unknown): value is InvoiceListResponseApi {
  if (!isRecord(value)) return false;
  if (typeof value.success !== 'boolean') return false;

  if (value.success === true) {
    if (!Array.isArray(value.invoices)) return false;
    return value.invoices.every(isInvoiceListItemApi);
  }

  return value.error === undefined || typeof value.error === 'string';
}

/**
 * Wandelt eine number in eine gueltige `TaxRate` um (0, 7 oder 19).
 *
 * @param {number} value - Der Steuersatz aus der API.
 * @returns {TaxRate | null} Die gueltige TaxRate oder `null`, falls ungueltig.
 */
function parseTaxRate(value: number): TaxRate | null {
  if (value === 0 || value === 7 || value === 19) return value;
  return null;
}

/**
 * Wandelt einen Status-String in einen gueltigen `InvoiceStatus` um.
 *
 * @param {string} value - Der Status aus der API.
 * @returns {InvoiceStatus | null} Der gueltige Status oder `null`, falls ungueltig.
 */
function parseInvoiceStatus(value: string): InvoiceStatus | null {
  const allowed: Record<InvoiceStatus, true> = {
    DRAFT: true,
    SENT: true,
    PENDING: true,
    PAID: true,
    CANCELLED: true,
    OVERDUE: true,
  };

  if (value in allowed) return value as InvoiceStatus;
  return null;
}

/**
 * Mock-Rechnungen fuer die Demo (Fallback, wenn die API nicht verfuegbar ist).
 */
const MOCK_INVOICES: Invoice[] = [
  {
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
    createdAt: new Date('2025-01-20'),
    updatedAt: new Date('2025-01-20'),
  },
  {
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
    createdAt: new Date('2025-01-22'),
    updatedAt: new Date('2025-01-22'),
  },
  {
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
    createdAt: new Date('2025-01-10'),
    updatedAt: new Date('2025-01-10'),
  },
];

/**
 * React Page fuer die Rechnungsuebersicht.
 *
 * @returns {React.ReactElement} Die gerenderte Seite.
 */
export default function InvoicesPage(): React.ReactElement {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load invoices on mount
  useEffect((): void => {
    /**
     * Laedt Rechnungen von der API und setzt den State.
     *
     * @returns {Promise<void>} Kein Rueckgabewert; der State wird aktualisiert.
     */
    const fetchInvoices = async (): Promise<void> => {
      try {
        const response = await fetch('/api/invoices/list');
        if (!response.ok) {
          throw new Error('Failed to fetch invoices');
        }

        const rawData: unknown = await response.json();
        if (!isInvoiceListResponseApi(rawData)) {
          // Fallback, wenn das Payload-Format nicht passt
          setInvoices(MOCK_INVOICES);
          return;
        }

        if (rawData.success) {
          // Transform API response to match Invoice type
          const transformedInvoices: Invoice[] = rawData.invoices.map((inv): Invoice => {
            const taxRate = parseTaxRate(inv.taxRate) ?? 19;
            const status = parseInvoiceStatus(inv.status) ?? 'PENDING';

            return {
              id: inv.id,
              invoiceNumber: inv.invoiceNumber,
              date: new Date(inv.date),
              dueDate: inv.dueDate ? new Date(inv.dueDate) : undefined,
              netAmount: inv.netAmount,
              taxRate,
              taxAmount: inv.taxAmount,
              grossAmount: inv.grossAmount,
              currency: inv.currency,
              status,
              description: inv.description,
              customerId: inv.customerId,
              createdAt: new Date(inv.createdAt),
              updatedAt: new Date(inv.updatedAt),
            };
          });
          setInvoices(transformedInvoices);
        } else {
          // Fallback to mock data if API fails
          setInvoices(MOCK_INVOICES);
        }
      } catch (error) {
        console.error('Failed to fetch invoices:', error);
        // Fallback to mock data on error
        setInvoices(MOCK_INVOICES);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvoices();
  }, []);

  /**
   * Navigiert zur Detailseite der ausgewaehlten Rechnung.
   *
   * @param {Invoice} invoice - Die ausgewaehlte Rechnung.
   * @returns {void} Es wird kein Wert zurueckgegeben.
   */
  const handleSelect = (invoice: Invoice): void => {
    router.push(`/invoices/${invoice.id}`);
  };

  /**
   * Loescht eine Rechnung aus der Liste (nur im UI-State).
   *
   * @param {string} id - Die ID der zu loeschenden Rechnung.
   * @returns {void} Es wird kein Wert zurueckgegeben.
   */
  const handleDelete = (id: string): void => {
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
  };

  /**
   * Navigiert zur Seite fuer eine neue Rechnung.
   *
   * @returns {void} Es wird kein Wert zurueckgegeben.
   */
  const handleNewInvoice = (): void => {
    router.push('/invoices/new');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Wird geladen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rechnungen</h1>
        <button
          type="button"
          onClick={handleNewInvoice}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
        >
          Neue Rechnung
        </button>
      </div>

      {/* Invoice List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <InvoiceList invoices={invoices} onSelect={handleSelect} onDelete={handleDelete} />
      </div>
    </div>
  );
}
