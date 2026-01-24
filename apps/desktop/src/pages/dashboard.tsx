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
 * Export data structure for JSON export.
 */
interface ExportInvoice {
  number: string;
  customerName: string;
  date: string;
  total: number;
  status: string;
}

interface ExportData {
  invoices: ExportInvoice[];
  exportedAt: string;
}

/**
 * Status configuration for display.
 * Uses theme-aware utility classes for consistent branding.
 */
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT: {
    label: 'Entwurf',
    className: 'bg-muted text-muted-foreground border-muted-foreground/20',
  },
  PENDING: { label: 'Offen', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  PAID: { label: 'Bezahlt', className: 'bg-primary/10 text-primary border-primary/20' },
  CANCELLED: {
    label: 'Storniert',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  OVERDUE: { label: 'Überfällig', className: 'bg-red-500 text-white border-transparent shadow-sm' },
};

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
 * Format date for German locale.
 *
 * @param {Date} date - The date object to format.
 * @returns {string} The formatted date string.
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
 * Enhanced with better visual hierarchy and theme-consistent styling.
 *
 * @param {object} props - Component properties.
 * @param {string} props.title - Title of the statistic.
 * @param {string | number} props.value - Primary value to display.
 * @param {string} [props.subtitle] - Optional descriptive subtitle.
 * @param {'up' | 'down' | 'stable'} [props.trend] - Direction of the trend.
 * @param {number} [props.trendPercent] - Percentage change for the trend.
 * @param {string} [props.testId] - ID for testing purposes.
 * @returns {React.ReactElement} The rendered StatCard.
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
      className="bg-card dark:bg-gray-800/50 rounded-xl border border-border/50 shadow-sm p-6 hover:border-primary/30 transition-all duration-300 group"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-primary transition-colors">
          {title}
        </h3>
        {trend && trendPercent !== undefined && (
          <span
            data-testid="trend-indicator"
            className={`flex items-center px-2 py-1 rounded-full text-xs font-bold ${
              trend === 'up'
                ? 'bg-green-500/10 text-green-600'
                : trend === 'down'
                  ? 'bg-red-500/10 text-red-600'
                  : 'bg-muted text-muted-foreground'
            }`}
          >
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '•'}
            {trendPercent}%
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <p data-testid={testId} className="text-3xl font-bold tracking-tight text-foreground">
          {value}
        </p>
      </div>
      {subtitle && (
        <p className="mt-2 text-xs font-medium text-muted-foreground italic">{subtitle}</p>
      )}
    </div>
  );
}

/**
 * Dashboard Page component.
 *
 * @returns {React.ReactElement} The rendered DashboardPage.
 */
export default function DashboardPage(): React.ReactElement {
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const exportDropdownRef = React.useRef<HTMLDivElement>(null);

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
   * Toggle export dropdown visibility.
   */
  const handleExportClick = useCallback(() => {
    setShowExportDropdown((prev) => !prev);
  }, []);

  /**
   * Convert invoices to CSV format.
   *
   * @param {RecentInvoice[]} invoices - Array of invoices to convert.
   * @returns {string} CSV formatted string.
   */
  const convertToCSV = useCallback((invoices: RecentInvoice[]): string => {
    const headers = ['Rechnungsnummer', 'Kunde', 'Datum', 'Betrag', 'Status'];
    const csvRows = [headers.join(',')];

    invoices.forEach((invoice) => {
      const row = [
        invoice.number,
        `"${invoice.customer.name}"`,
        formatDate(invoice.createdAt),
        invoice.total.toString(),
        STATUS_CONFIG[invoice.status]?.label ?? invoice.status,
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }, []);

  /**
   * Convert invoices to JSON export format.
   *
   * @param {RecentInvoice[]} invoices - Array of invoices to convert.
   * @returns {ExportData} JSON export data structure.
   */
  const convertToJSON = useCallback((invoices: RecentInvoice[]): ExportData => {
    return {
      invoices: invoices.map((invoice) => ({
        number: invoice.number,
        customerName: invoice.customer.name,
        date: formatDate(invoice.createdAt),
        total: invoice.total,
        status: STATUS_CONFIG[invoice.status]?.label ?? invoice.status,
      })),
      exportedAt: new Date().toISOString(),
    };
  }, []);

  /**
   * Trigger file download using browser API.
   *
   * @param {string} content - The file content.
   * @param {string} filename - The filename for download.
   * @param {string} mimeType - The MIME type of the file.
   */
  const downloadFile = useCallback((content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  /**
   * Export invoices as CSV.
   */
  const handleExportCSV = useCallback(() => {
    const csvContent = convertToCSV(recentInvoices);
    const timestamp = new Date().toISOString().split('T')[0];
    downloadFile(csvContent, `rechnungen-${timestamp}.csv`, 'text/csv;charset=utf-8;');
    setShowExportDropdown(false);
  }, [recentInvoices, convertToCSV, downloadFile]);

  /**
   * Export invoices as JSON.
   */
  const handleExportJSON = useCallback(() => {
    const jsonData = convertToJSON(recentInvoices);
    const jsonContent = JSON.stringify(jsonData, null, 2);
    const timestamp = new Date().toISOString().split('T')[0];
    downloadFile(jsonContent, `rechnungen-${timestamp}.json`, 'application/json');
    setShowExportDropdown(false);
  }, [recentInvoices, convertToJSON, downloadFile]);

  /**
   * Close export dropdown when clicking outside.
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false);
      }
    };

    if (showExportDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportDropdown]);

  /**
   * Retry loading data.
   */
  const handleRetry = useCallback(() => {
    loadData();
  }, [loadData]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-primary border-r-transparent mx-auto" />
          <p className="mt-6 text-lg font-medium text-muted-foreground animate-pulse">
            Dashboard wird vorbereitet...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="max-w-md text-center p-8 bg-card rounded-2xl border border-destructive/20 shadow-xl">
          <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
            !
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            Daten-Synchronisation fehlgeschlagen
          </h2>
          <p className="text-muted-foreground mb-8">
            Wir konnten Ihre Rechnungsdaten momentan nicht abrufen.
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-10 bg-background min-h-screen">
      {/* Page Header - Enterprise Hero Style */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border/50 pb-10">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-bold uppercase tracking-widest mb-2">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            Live System
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-foreground tracking-tight">
            Dashboard
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl">
            Willkommen zurück. Hier ist die Übersicht über Ihre finanziellen Aktivitäten und offenen
            Posten.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div ref={exportDropdownRef} className="relative">
            <button
              type="button"
              onClick={handleExportClick}
              className="px-6 py-3 text-sm font-bold text-foreground bg-card border border-border rounded-xl hover:bg-muted transition-all shadow-sm"
            >
              Exportieren
            </button>
            {showExportDropdown && (
              <div className="absolute top-full right-0 mt-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-10 min-w-[140px]">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="w-full px-4 py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors text-left"
                >
                  CSV exportieren
                </button>
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="w-full px-4 py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors text-left border-t border-border"
                >
                  JSON exportieren
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleNewInvoice}
            className="px-8 py-3 text-sm font-black text-white bg-accent rounded-xl hover:bg-accent/90 transition-all shadow-lg shadow-accent/25 transform active:scale-95"
          >
            Neue Rechnung erstellen
          </button>
        </div>
      </div>

      {/* Stats Grid - High Impact Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-8">
        <StatCard
          title="Gesamtumsatz"
          value={formatCurrency(summary?.revenue.total ?? 0)}
          trend={summary?.revenue.trend ?? undefined}
          trendPercent={summary?.revenue.trendPercent ?? undefined}
          testId="total-revenue"
          subtitle="Vergleich zum Vormonat"
        />
        <StatCard
          title="Aktive Kunden"
          value={summary?.customers.activeCustomers ?? 0}
          subtitle={`${summary?.customers.newCustomers ?? 0} Neuzugänge`}
          testId="active-customers"
        />
        <StatCard
          title="Offene Rechnungen"
          value={summary?.basicStats.totalInvoices ?? 0}
          subtitle={`${summary?.basicStats.pendingInvoices ?? 0} warten auf Zahlung`}
          testId="total-invoices"
        />
        <StatCard
          title="Durschn. Wert"
          value={formatCurrency(summary?.invoices.averageValue ?? 0)}
          subtitle={`${summary?.invoices.paymentTimeAverage ?? 0} Tage Ø Zahlungsziel`}
          testId="average-value"
        />
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Invoices Table - Professional Block */}
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border/50 shadow-xl overflow-hidden">
          <div className="px-8 py-6 border-b border-border/50 flex items-center justify-between bg-muted/30">
            <h2 className="text-xl font-bold text-foreground">Letzte Transaktionen</h2>
            <button className="text-xs font-bold text-primary hover:underline uppercase tracking-widest">
              Alle anzeigen
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border/50">
              <thead className="bg-muted/50">
                <tr>
                  <th
                    scope="col"
                    className="px-8 py-4 text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]"
                  >
                    Nummer
                  </th>
                  <th
                    scope="col"
                    className="px-8 py-4 text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]"
                  >
                    Kunde
                  </th>
                  <th
                    scope="col"
                    className="px-8 py-4 text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]"
                  >
                    Datum
                  </th>
                  <th
                    scope="col"
                    className="px-8 py-4 text-right text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]"
                  >
                    Betrag
                  </th>
                  <th
                    scope="col"
                    className="px-8 py-4 text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]"
                  >
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border/30">
                {recentInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer group"
                    onClick={() => router.push(`/invoices/${invoice.id}`)}
                  >
                    <td className="px-8 py-5 whitespace-nowrap text-sm font-bold text-foreground group-hover:text-primary">
                      {invoice.number}
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-sm text-muted-foreground">
                      {invoice.customer.name}
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-sm text-muted-foreground/70 font-mono">
                      {formatDate(invoice.createdAt)}
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-sm text-foreground text-right font-black">
                      {formatCurrency(invoice.total)}
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full border ${
                          STATUS_CONFIG[invoice.status]?.className ??
                          'bg-muted text-muted-foreground'
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
            <div className="px-8 py-16 text-center">
              <div className="text-4xl mb-4 opacity-20">📄</div>
              <p className="text-muted-foreground font-medium">Noch keine Rechnungen erstellt.</p>
            </div>
          )}
        </div>

        {/* Sidebar / Voice Quick Action */}
        <div className="space-y-8">
          <div className="bg-primary/5 rounded-2xl border-2 border-primary/10 p-8 flex flex-col items-center text-center space-y-6">
            <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-primary/20 transform group-hover:scale-110 transition-transform">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-foreground">Voice Command</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Erstellen Sie Rechnungen einfach durch Sprechen. Unsere KI übernimmt den Rest.
              </p>
            </div>
            <button
              onClick={handleNewInvoice}
              className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-bold hover:shadow-lg hover:shadow-primary/30 transition-all active:scale-95"
            >
              Sprachaufnahme starten
            </button>
          </div>

          {/* Quick Insights */}
          <div className="bg-card rounded-2xl border border-border/50 p-8 space-y-6">
            <h3 className="text-lg font-bold text-foreground">Quick Insights</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-muted/20 rounded-xl">
                <span className="text-sm text-muted-foreground font-medium">Zahlungseingang Ø</span>
                <span className="text-sm font-bold text-foreground">14 Tage</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-muted/20 rounded-xl">
                <span className="text-sm text-muted-foreground font-medium">Top Kunde</span>
                <span className="text-sm font-bold text-foreground">Kunde B</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
