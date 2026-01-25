/**
 * Payment Timeline component.
 *
 * Visualizes upcoming and overdue invoice payments on a timeline.
 *
 * @module components/workflows/PaymentTimeline
 */

import React, { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import type { TimelineInvoice } from '@/hooks';

/**
 * Props for PaymentTimeline component.
 */
export interface PaymentTimelineProps {
  /** Invoices to display on timeline */
  invoices: TimelineInvoice[];
  /** Number of days to show ahead (default: 30) */
  daysAhead?: number;
  /** Number of days to show behind for overdue (default: 30) */
  daysBehind?: number;
  /** Whether data is loading */
  loading?: boolean;
  /** Callback when invoice is clicked */
  onInvoiceClick?: (invoice: TimelineInvoice) => void;
}

/**
 * Data point for the scatter chart.
 */
interface TimelinePoint {
  x: number; // days from today
  y: number; // amount
  invoice: TimelineInvoice;
}

/**
 * Formats currency for display.
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
 * Custom tooltip for the timeline.
 */
function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: TimelinePoint }>;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0].payload;
  const invoice = data.invoice;
  const daysText =
    data.x === 0
      ? 'Heute'
      : data.x > 0
        ? `in ${data.x} Tagen`
        : `${Math.abs(data.x)} Tage überfällig`;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <p className="font-semibold text-gray-900">{invoice.customerName}</p>
      <p className="text-sm text-gray-600">{invoice.number}</p>
      <p className="text-lg font-bold mt-1">{formatCurrency(invoice.total)}</p>
      <p className={`text-sm mt-1 ${invoice.isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
        {daysText}
      </p>
    </div>
  );
}

/**
 * Payment timeline visualization showing upcoming and overdue payments.
 *
 * @param props - Component props
 * @returns Timeline chart
 *
 * @example
 * ```tsx
 * <PaymentTimeline invoices={invoices} daysAhead={30} />
 * ```
 */
export function PaymentTimeline({
  invoices,
  daysAhead = 30,
  daysBehind = 30,
  loading = false,
  onInvoiceClick,
}: PaymentTimelineProps): React.ReactElement {
  // Transform invoices to chart data
  const chartData = useMemo<TimelinePoint[]>(() => {
    return invoices
      .filter((inv) => inv.daysUntilDue >= -daysBehind && inv.daysUntilDue <= daysAhead)
      .map((inv) => ({
        x: inv.daysUntilDue,
        y: inv.total,
        invoice: inv,
      }))
      .sort((a, b) => a.x - b.x);
  }, [invoices, daysAhead, daysBehind]);

  // Calculate domain for Y axis
  const maxAmount = useMemo(() => {
    if (chartData.length === 0) return 10000;
    return Math.max(...chartData.map((d) => d.y)) * 1.1;
  }, [chartData]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Zahlungszeitstrahl</h3>
        </div>
        <div className="h-48 bg-gray-100 animate-pulse rounded" />
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Zahlungszeitstrahl</h3>
        </div>
        <div className="h-48 flex items-center justify-center text-gray-500">
          Keine offenen Rechnungen im Zeitraum
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Zahlungszeitstrahl</h3>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            Überfällig
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-green-500" />
            Fällig
          </span>
        </div>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 60 }}>
            <XAxis
              dataKey="x"
              type="number"
              domain={[-daysBehind, daysAhead]}
              tickFormatter={(value) =>
                value === 0 ? 'Heute' : value > 0 ? `+${value}d` : `${value}d`
              }
              tick={{ fontSize: 12 }}
            />
            <YAxis
              dataKey="y"
              type="number"
              domain={[0, maxAmount]}
              tickFormatter={(value) => formatCurrency(value)}
              tick={{ fontSize: 12 }}
              width={80}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine x={0} stroke="#6b7280" strokeDasharray="3 3" label="Heute" />
            <Scatter
              data={chartData}
              onClick={(data) => onInvoiceClick?.(data.invoice)}
              cursor="pointer"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.invoice.isOverdue ? '#ef4444' : '#22c55e'}
                  r={Math.max(6, Math.min(12, entry.y / 1000))}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Legend with overdue invoices */}
      <div className="mt-4 flex flex-wrap gap-2">
        {chartData
          .filter((d) => d.invoice.isOverdue)
          .slice(0, 5)
          .map((d) => (
            <span
              key={d.invoice.id}
              className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 rounded-full text-xs cursor-pointer hover:bg-red-100"
              onClick={() => onInvoiceClick?.(d.invoice)}
            >
              <span className="font-medium">{d.invoice.customerName}</span>
              <span>{formatCurrency(d.invoice.total)}</span>
              <span className="text-red-500">({d.x}d)</span>
            </span>
          ))}
      </div>
    </div>
  );
}
