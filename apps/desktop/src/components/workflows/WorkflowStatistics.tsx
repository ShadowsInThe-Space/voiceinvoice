/**
 * Workflow Statistics component.
 *
 * Displays charts for workflow execution statistics.
 *
 * @module components/workflows/WorkflowStatistics
 */

import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts';
import type { DailyExecutionCount, WorkflowSuccessRate, ErrorTypeBreakdown } from '@/lib/database';

/**
 * Props for WorkflowStatistics component.
 */
export interface WorkflowStatisticsProps {
  /** Daily execution counts */
  dailyCounts: DailyExecutionCount[];
  /** Success rates per workflow */
  successRates: WorkflowSuccessRate[];
  /** Error type breakdown */
  errorBreakdown: ErrorTypeBreakdown[];
  /** Whether data is loading */
  loading?: boolean;
}

/**
 * Colors for charts.
 */
const COLORS = {
  success: '#22c55e',
  failure: '#ef4444',
  primary: '#3b82f6',
  secondary: '#8b5cf6',
  pie: ['#ef4444', '#f59e0b', '#3b82f6', '#6b7280', '#8b5cf6'],
};

/**
 * Loading skeleton for charts.
 * @param root0
 * @param root0.title
 */
function ChartSkeleton({ title }: { title: string }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h4 className="text-sm font-medium text-gray-700 mb-4">{title}</h4>
      <div className="h-48 bg-gray-100 animate-pulse rounded" />
    </div>
  );
}

/**
 * Executions over time line chart.
 * @param root0
 * @param root0.data
 * @param root0.loading
 */
function ExecutionsChart({ data, loading }: { data: DailyExecutionCount[]; loading?: boolean }) {
  if (loading) {
    return <ChartSkeleton title="Ausführungen über Zeit" />;
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-4">Ausführungen über Zeit</h4>
        <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
          Noch keine Ausführungsdaten
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h4 className="text-sm font-medium text-gray-700 mb-4">Ausführungen über Zeit</h4>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getDate()}.${date.getMonth() + 1}`;
              }}
            />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontSize: 12 }}
              labelFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString('de-DE');
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="successCount"
              name="Erfolgreich"
              stroke={COLORS.success}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="failureCount"
              name="Fehlgeschlagen"
              stroke={COLORS.failure}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Success rate per workflow bar chart.
 * @param root0
 * @param root0.data
 * @param root0.loading
 */
function SuccessRateChart({ data, loading }: { data: WorkflowSuccessRate[]; loading?: boolean }) {
  if (loading) {
    return <ChartSkeleton title="Erfolgsrate pro Workflow" />;
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-4">Erfolgsrate pro Workflow</h4>
        <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
          Noch keine Workflow-Daten
        </div>
      </div>
    );
  }

  // Shorten workflow names for display
  const chartData = data.map((d) => ({
    ...d,
    shortName: d.workflowName.replace('-Agent', '').substring(0, 15),
  }));

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h4 className="text-sm font-medium text-gray-700 mb-4">Erfolgsrate pro Workflow</h4>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 20, bottom: 5, left: 80 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
            <YAxis type="category" dataKey="shortName" tick={{ fontSize: 11 }} width={75} />
            <Tooltip
              contentStyle={{ fontSize: 12 }}
              formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Erfolgsrate']}
            />
            <Bar dataKey="successRate" fill={COLORS.primary} radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    entry.successRate >= 80
                      ? COLORS.success
                      : entry.successRate >= 50
                        ? COLORS.primary
                        : COLORS.failure
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Error type breakdown pie chart.
 * @param root0
 * @param root0.data
 * @param root0.loading
 */
function ErrorBreakdownChart({ data, loading }: { data: ErrorTypeBreakdown[]; loading?: boolean }) {
  if (loading) {
    return <ChartSkeleton title="Fehlertypen" />;
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-4">Fehlertypen</h4>
        <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
          Keine Fehler aufgetreten 🎉
        </div>
      </div>
    );
  }

  // Format error types for display
  const chartData = data.map((d) => ({
    ...d,
    displayName: d.errorType.replace(/_/g, ' ').replace('CREDENTIALS MISSING', 'Credentials'),
  }));

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h4 className="text-sm font-medium text-gray-700 mb-4">Fehlertypen</h4>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="displayName"
              cx="50%"
              cy="50%"
              outerRadius={60}
              label={({ name, percent }) => `${name} (${(Number(percent) * 100).toFixed(0)}%)`}
              labelLine={false}
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS.pie[index % COLORS.pie.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ fontSize: 12 }}
              formatter={(value, name) => [`${value} Fehler`, String(name)]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Workflow statistics dashboard with multiple charts.
 *
 * @param props - Component props
 * @param props.dailyCounts
 * @param props.successRates
 * @param props.errorBreakdown - Error counts grouped by error type for the breakdown chart.
 * @param props.loading
 * @returns Statistics charts
 *
 * @example
 * ```tsx
 * <WorkflowStatistics
 *   dailyCounts={dailyCounts}
 *   successRates={successRates}
 *   errorBreakdown={errorBreakdown}
 * />
 * ```
 */
export function WorkflowStatistics({
  dailyCounts,
  successRates,
  errorBreakdown,
  loading = false,
}: WorkflowStatisticsProps): React.ReactElement {
  return (
    <div className="space-y-6">
      <ExecutionsChart data={dailyCounts} loading={loading} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SuccessRateChart data={successRates} loading={loading} />
        <ErrorBreakdownChart data={errorBreakdown} loading={loading} />
      </div>
    </div>
  );
}
