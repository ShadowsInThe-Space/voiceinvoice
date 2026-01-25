/**
 * KPI Cards component for workflow analytics.
 *
 * Displays key performance indicators as a grid of cards.
 *
 * @module components/workflows/WorkflowKPICards
 */

import React from 'react';
import type { LatestKPIs } from '@/lib/database';

/**
 * Props for WorkflowKPICards component.
 */
export interface WorkflowKPICardsProps {
  /** KPI values to display */
  kpis: LatestKPIs;
  /** Whether data is loading */
  loading?: boolean;
  /** Total overdue amount (from invoice timeline) */
  totalOverdueAmount?: number;
  /** Number of overdue invoices */
  overdueCount?: number;
}

/**
 * Single KPI card configuration.
 */
interface KPICardConfig {
  label: string;
  value: number;
  unit: string;
  format: 'currency' | 'number';
  color: string;
  icon: string;
}

/**
 * Formats a number as currency.
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Formats a number with thousand separators.
 */
function formatNumber(value: number): string {
  return new Intl.NumberFormat('de-DE').format(value);
}

/**
 * Single KPI card component.
 */
function KPICard({
  label,
  value,
  format,
  color,
  icon,
  loading,
}: KPICardConfig & { loading?: boolean }) {
  const displayValue = format === 'currency' ? formatCurrency(value) : formatNumber(value);

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${loading ? 'animate-pulse' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${color}`}>KPI</span>
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-gray-900">
          {loading ? <span className="bg-gray-200 rounded w-24 h-8 block" /> : displayValue}
        </p>
        <p className="text-sm text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  );
}

/**
 * Grid of KPI cards showing key metrics.
 *
 * @param props - Component props
 * @returns KPI cards grid
 *
 * @example
 * ```tsx
 * <WorkflowKPICards kpis={kpis} loading={false} />
 * ```
 */
export function WorkflowKPICards({
  kpis,
  loading = false,
  totalOverdueAmount = 0,
  overdueCount = 0,
}: WorkflowKPICardsProps): React.ReactElement {
  const cards: KPICardConfig[] = [
    {
      label: 'Offene Mahnungen',
      value: kpis.offeneMahnungenEuro || totalOverdueAmount,
      unit: 'EUR',
      format: 'currency',
      color: 'bg-red-100 text-red-800',
      icon: '⚠️',
    },
    {
      label: 'Rechnungen verarbeitet',
      value: kpis.verarbeiteteRechnungen,
      unit: '',
      format: 'number',
      color: 'bg-green-100 text-green-800',
      icon: '📧',
    },
    {
      label: 'Gematchte Zahlungen',
      value: kpis.gematchteZahlungen,
      unit: 'EUR',
      format: 'currency',
      color: 'bg-blue-100 text-blue-800',
      icon: '💰',
    },
    {
      label: 'Überfällige Verträge',
      value: kpis.ueberfaelligeVertraege || overdueCount,
      unit: '',
      format: 'number',
      color: 'bg-orange-100 text-orange-800',
      icon: '📋',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <KPICard key={card.label} {...card} loading={loading} />
      ))}
    </div>
  );
}
