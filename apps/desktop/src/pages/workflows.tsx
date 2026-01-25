/**
 * Workflow Analytics Page.
 *
 * Displays workflow execution statistics, KPIs, timeline,
 * and allows manual workflow triggering.
 *
 * @module pages/workflows
 */

import React, { useState, useCallback } from 'react';
import Head from 'next/head';
import { useWorkflowAnalytics } from '@/hooks/use-workflow-analytics';
import { useInvoiceTimeline } from '@/hooks/use-invoice-timeline';
import {
  WorkflowKPICards,
  PaymentTimeline,
  TopCustomers,
  WorkflowTriggerList,
  WorkflowStatistics,
  WorkflowHistory,
} from '@/components/workflows';
import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';

/**
 * Tab configuration.
 */
const TABS = [
  { id: 'overview', label: 'Übersicht' },
  { id: 'statistics', label: 'Statistiken' },
  { id: 'history', label: 'Verlauf' },
  { id: 'triggers', label: 'Workflows auslösen' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * Workflows analytics page component.
 *
 * @returns The workflows page
 */
export default function WorkflowsPage(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch analytics data
  const {
    state: analyticsState,
    refresh: refreshAnalytics,
    triggerAggregation,
  } = useWorkflowAnalytics({ days: 30 });

  // Fetch timeline data
  const { state: timelineState, refresh: refreshTimeline } = useInvoiceTimeline({
    daysAhead: 30,
    topCustomerLimit: 5,
  });

  /**
   * Refreshes all data.
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refreshAnalytics(), refreshTimeline(), triggerAggregation()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshAnalytics, refreshTimeline, triggerAggregation]);

  const isLoading = analyticsState.loading || timelineState.loading;

  return (
    <>
      <Head>
        <title>Workflow-Analyse | VoiceInvoice</title>
      </Head>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Workflow-Analyse</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Überwachen Sie Ihre automatisierten Workflows und KPIs
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md',
              'bg-primary text-white hover:bg-primary/90',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors'
            )}
          >
            <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
            Aktualisieren
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex gap-4" aria-label="Tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="min-h-[500px]">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* KPI Cards */}
              <WorkflowKPICards
                kpis={analyticsState.kpis}
                loading={isLoading}
                totalOverdueAmount={timelineState.totalOverdueAmount}
                overdueCount={timelineState.overdueCount}
              />

              {/* Timeline and Top Customers Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PaymentTimeline
                  invoices={timelineState.timelineInvoices}
                  loading={timelineState.loading}
                />
                <TopCustomers
                  customers={timelineState.topCustomers}
                  loading={timelineState.loading}
                />
              </div>
            </div>
          )}

          {activeTab === 'statistics' && (
            <WorkflowStatistics
              dailyCounts={analyticsState.dailyCounts}
              successRates={analyticsState.successRates}
              errorBreakdown={analyticsState.errorBreakdown}
              loading={analyticsState.loading}
            />
          )}

          {activeTab === 'history' && (
            <WorkflowHistory
              executions={analyticsState.recentExecutions}
              loading={analyticsState.loading}
            />
          )}

          {activeTab === 'triggers' && <WorkflowTriggerList onWorkflowComplete={handleRefresh} />}
        </div>

        {/* Error Display */}
        {(analyticsState.error || timelineState.error) && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 dark:bg-red-900/20 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-300">
              {analyticsState.error || timelineState.error}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
