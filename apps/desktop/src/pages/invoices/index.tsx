/**
 * Invoices List Page
 *
 * Displays list of all invoices with filtering and actions.
 *
 * @module pages/invoices/index
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { InvoiceList } from '../../components/InvoiceList';
import type { Invoice } from '@voiceinvoice/shared-types';

/**
 * Mock invoice data for demonstration.
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
 * Invoices List Page component.
 */
export default function InvoicesPage(): React.ReactElement {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load invoices on mount
  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const response = await fetch('/api/invoices/list');
        if (!response.ok) {
          throw new Error('Failed to fetch invoices');
        }
        const data = await response.json();

        if (data.success && data.invoices) {
          // Transform API response to match Invoice type
          const transformedInvoices: Invoice[] = data.invoices.map((inv: any) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            date: new Date(inv.date),
            dueDate: inv.dueDate ? new Date(inv.dueDate) : undefined,
            netAmount: inv.netAmount,
            taxRate: inv.taxRate,
            taxAmount: inv.taxAmount,
            grossAmount: inv.grossAmount,
            currency: inv.currency,
            status: inv.status as any,
            description: inv.description,
            customerId: inv.customerId,
            createdAt: new Date(inv.createdAt),
            updatedAt: new Date(inv.updatedAt),
          }));
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
   * Handle invoice selection.
   * @param invoice
   */
  const handleSelect = (invoice: Invoice) => {
    router.push(`/invoices/${invoice.id}`);
  };

  /**
   * Handle invoice deletion.
   * @param id
   */
  const handleDelete = (id: string) => {
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
  };

  /**
   * Navigate to new invoice page.
   */
  const handleNewInvoice = () => {
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
