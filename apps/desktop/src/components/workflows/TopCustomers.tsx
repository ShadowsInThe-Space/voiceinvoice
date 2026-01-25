/**
 * Top Customers component.
 *
 * Displays a ranked list of top customers by revenue.
 *
 * @module components/workflows/TopCustomers
 */

import React from 'react';
import type { TopCustomer } from '@/hooks';

/**
 * Props for TopCustomers component.
 */
export interface TopCustomersProps {
  /** List of top customers */
  customers: TopCustomer[];
  /** Whether data is loading */
  loading?: boolean;
  /** Callback when customer is clicked */
  onCustomerClick?: (customer: TopCustomer) => void;
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
 * Ranked list of top customers by revenue.
 *
 * @param props - Component props
 * @returns Top customers list
 *
 * @example
 * ```tsx
 * <TopCustomers customers={customers} />
 * ```
 */
export function TopCustomers({
  customers,
  loading = false,
  onCustomerClick,
}: TopCustomersProps): React.ReactElement {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Kunden</h3>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-6 h-6 bg-gray-200 rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-32" />
              </div>
              <div className="h-4 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Kunden</h3>
        <p className="text-gray-500 text-sm">Noch keine Kundendaten vorhanden</p>
      </div>
    );
  }

  // Calculate max revenue for progress bar
  const maxRevenue = Math.max(...customers.map((c) => c.totalRevenue), 1);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Kunden</h3>
      <div className="space-y-3">
        {customers.map((customer, index) => {
          const progressWidth = (customer.totalRevenue / maxRevenue) * 100;

          return (
            <div
              key={customer.id}
              className="group cursor-pointer hover:bg-gray-50 rounded-lg p-2 -mx-2 transition-colors"
              onClick={() => onCustomerClick?.(customer)}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    index === 0
                      ? 'bg-yellow-100 text-yellow-800'
                      : index === 1
                        ? 'bg-gray-100 text-gray-600'
                        : index === 2
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-gray-50 text-gray-500'
                  }`}
                >
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{customer.name}</p>
                  <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all group-hover:bg-blue-600"
                      style={{ width: `${progressWidth}%` }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(customer.totalRevenue)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {customer.paidCount}/{customer.invoiceCount} bezahlt
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
