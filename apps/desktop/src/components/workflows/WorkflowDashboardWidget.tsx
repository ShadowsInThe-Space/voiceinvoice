/**
 * Workflow Dashboard Widget component.
 *
 * Compact widget for the main dashboard showing key workflow metrics.
 *
 * @module components/workflows/WorkflowDashboardWidget
 */

import React from 'react';
import Link from 'next/link';
import type { LatestKPIs } from '@/lib/database';
import type { TimelineInvoice } from '@/hooks';

/**
 * Props for WorkflowDashboardWidget component.
 */
export interface WorkflowDashboardWidgetProps {
  /** KPI values */
  kpis: LatestKPIs;
  /** Overdue invoices */
  overdueInvoices: TimelineInvoice[];
  /** Upcoming invoices (next 2) */
  upcomingInvoices: TimelineInvoice[];
  /** Whether data is loading */
  loading?: boolean;
  /** Total overdue amount */
  totalOverdueAmount?: number;
}

/**
 * Formats currency for display.
 */
function formatCurrency(value: number): string {
  if (value >= 1000) {
    return `€${(value / 1000).toFixed(1)}k`;
  }
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Mini KPI card for the widget.
 */
function MiniKPICard({
  value,
  label,
  icon,
  isAlert,
}: {
  value: string | number;
  label: string;
  icon: string;
  isAlert?: boolean;
}) {
  return (
    <div
      className={`flex-1 p-3 rounded-lg ${isAlert ? 'bg-red-50 border border-red-100' : 'bg-gray-50'}`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-lg">{icon}</span>
        {isAlert && <span className="text-red-500 text-xs">!</span>}
      </div>
      <p className={`text-lg font-bold ${isAlert ? 'text-red-700' : 'text-gray-900'}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

/**
 * Compact dashboard widget for workflow overview.
 *
 * @param props - Component props
 * @returns Dashboard widget
 *
 * @example
 * ```tsx
 * <WorkflowDashboardWidget
 *   kpis={kpis}
 *   overdueInvoices={overdueInvoices}
 *   upcomingInvoices={upcomingInvoices}
 * />
 * ```
 */
export function WorkflowDashboardWidget({
  kpis,
  overdueInvoices,
  upcomingInvoices,
  loading = false,
  totalOverdueAmount = 0,
}: WorkflowDashboardWidgetProps): React.ReactElement {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 bg-gray-200 rounded w-32 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
        </div>
        <div className="flex gap-3 mb-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 h-20 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-12 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  const overdueAmount = kpis.offeneMahnungenEuro || totalOverdueAmount;
  const overdueCount = overdueInvoices.length;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Workflow-Übersicht</h3>
        <Link
          href="/workflows"
          className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          Alle Details
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Mini KPI Cards */}
      <div className="flex gap-3 mb-4">
        <MiniKPICard
          value={formatCurrency(overdueAmount)}
          label="Offene Mahnungen"
          icon="⚠️"
          isAlert={overdueAmount > 0}
        />
        <MiniKPICard
          value={kpis.verarbeiteteRechnungen}
          label="Rechnungen heute"
          icon="📧"
        />
        <MiniKPICard
          value={`${overdueCount} 🔴`}
          label="Überfällig"
          icon=""
          isAlert={overdueCount > 0}
        />
      </div>

      {/* Upcoming payments */}
      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs text-gray-500 mb-2">Nächste Zahlungen:</p>
        {upcomingInvoices.length === 0 ? (
          <p className="text-sm text-gray-400">Keine anstehenden Zahlungen</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {upcomingInvoices.slice(0, 2).map((invoice) => (
              <span
                key={invoice.id}
                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 rounded-full text-xs"
              >
                <span className="font-medium text-gray-700">{invoice.customerName}</span>
                <span className="text-gray-500">({formatCurrency(invoice.total)})</span>
                <span className="text-green-600">
                  in {invoice.daysUntilDue} {invoice.daysUntilDue === 1 ? 'Tag' : 'Tagen'}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
