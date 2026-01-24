/**
 * Dashboard Page
 *
 * Displays analytics overview, recent invoices, and quick actions.
 *
 * @module pages/dashboard
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';

/**
 * Dashboard summary data types.
 */
interface RevenueStats {
  total: number;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
}

interface CustomerInsights {
  activeCustomers: number;
  newCustomers: number;
}

interface InvoiceInsights {
  averageValue: number;
  paymentTimeAverage: number;
}

interface BasicStats {
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
  overdueInvoices: number;
  totalRevenue: number;
}

interface DashboardSummary {
  revenue: RevenueStats;
  customers: CustomerInsights;
  invoices: InvoiceInsights;
  basicStats: BasicStats;
}

interface RecentInvoice {
  id: string;
  number: string;
  customer: { id: string; name: string };
  total: number;
  status: string;
  createdAt: Date;
}

/**
 * Status configuration for display.
 */
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Entwurf', className: 'bg-gray-100 text-gray-800' },
  PENDING: { label: 'Offen', className: 'bg-yellow-100 text-yellow-800' },
  PAID: { label: 'Bezahlt', className: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Storniert', className: 'bg-red-100 text-red-800' },
  OVERDUE: { label: 'Ueberfaellig', className: 'bg-red-200 text-red-900' },
};

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
 * Format date for German locale.
 */
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Stat Card component.
 */
function StatCard({
  title,
  value,
  subtitle,
  trend,
  trendPercent,
  testId,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'stable' | undefined;
  trendPercent?: number | undefined;
  testId?: string;
}): React.ReactElement {
  return (
    <div
      role="region"
      aria-label={title}
      className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
    >
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
      <div className="mt-2 flex items-baseline gap-2">
        <p data-testid={testId} className="text-2xl font-semibold text-gray-900 dark:text-white">
          {value}
        </p>
        {trend && trendPercent !== undefined && (
          <span
            data-testid="trend-indicator"
            className={`text-sm font-medium ${
              trend === 'up'
                ? 'text-green-600'
                : trend === 'down'
                ? 'text-red-600'
                : 'text-gray-500'
            }`}
          >
            {trend === 'up' ? '+' : trend === 'down' ? '-' : ''}
            {trendPercent}%
          </span>
        )}
      </div>
      {subtitle && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
      )}
    </div>
  );
}

/**
 * Dashboard Page component.
 */
export default function DashboardPage(): React.ReactElement {
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load dashboard data.
   */
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // In production, these would be real API calls
      // For now, we use mock data
      const mockSummary: DashboardSummary = {
        revenue: {
          total: 15000,
          trend: 'up',
          trendPercent: 15,
        },
        customers: {
          activeCustomers: 12,
          newCustomers: 5,
        },
        invoices: {
          averageValue: 1250,
          paymentTimeAverage: 14,
        },
        basicStats: {
          totalInvoices: 50,
          paidInvoices: 35,
          pendingInvoices: 10,
          overdueInvoices: 5,
          totalRevenue: 15000,
        },
      };

      const mockRecentInvoices: RecentInvoice[] = [
        {
          id: 'inv-1',
          number: 'RE-2025-001',
          customer: { id: 'c1', name: 'Kunde A' },
          total: 1190,
          status: 'PAID',
          createdAt: new Date('2025-01-20'),
        },
        {
          id: 'inv-2',
          number: 'RE-2025-002',
          customer: { id: 'c2', name: 'Kunde B' },
          total: 2380,
          status: 'PENDING',
          createdAt: new Date('2025-01-22'),
        },
      ];

      setSummary(mockSummary);
      setRecentInvoices(mockRecentInvoices);
    } catch (err) {
      setError('Fehler beim Laden der Dashboard-Daten');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Navigate to new invoice page.
   */
  const handleNewInvoice = useCallback(() => {
    router.push('/invoices/new');
  }, [router]);

  /**
   * Export invoices (placeholder).
   */
  const handleExport = useCallback(() => {
    // Placeholder for export functionality
    console.log('Export clicked');
  }, []);

  /**
   * Retry loading data.
   */
  const handleRetry = useCallback(() => {
    loadData();
  }, [loadData]);

  // Loading state
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

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-4">Fehler beim Laden der Daten</p>
          <button
            type="button"
            onClick={handleRetry}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
          >
            Exportieren
          </button>
          <button
            type="button"
            onClick={handleNewInvoice}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
          >
            Neue Rechnung
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Umsatz"
          value={formatCurrency(summary?.revenue.total ?? 0)}
          trend={summary?.revenue.trend ?? undefined}
          trendPercent={summary?.revenue.trendPercent ?? undefined}
          testId="total-revenue"
        />
        <StatCard
          title="Kunden"
          value={summary?.customers.activeCustomers ?? 0}
          subtitle={`${summary?.customers.newCustomers ?? 0} neue diesen Monat`}
          testId="active-customers"
        />
        <StatCard
          title="Rechnungen"
          value={summary?.basicStats.totalInvoices ?? 0}
          subtitle={`${summary?.basicStats.pendingInvoices ?? 0} offen`}
          testId="total-invoices"
        />
        <StatCard
          title="Durchschnitt"
          value={formatCurrency(summary?.invoices.averageValue ?? 0)}
          subtitle={`${summary?.invoices.paymentTimeAverage ?? 0} Tage Zahlungsziel`}
          testId="average-value"
        />
      </div>

      {/* Recent Invoices */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            Letzte Rechnungen
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  Nummer
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  Kunde
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  Datum
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  Betrag
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {recentInvoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => router.push(`/invoices/${invoice.id}`)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {invoice.number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {invoice.customer.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(invoice.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right font-medium">
                    {formatCurrency(invoice.total)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        STATUS_CONFIG[invoice.status]?.className ?? 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {STATUS_CONFIG[invoice.status]?.label ?? invoice.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {recentInvoices.length === 0 && (
          <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
            Keine Rechnungen vorhanden
          </div>
        )}
      </div>
    </div>
  );
}
