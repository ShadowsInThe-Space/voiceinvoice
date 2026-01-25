/**
 * Workflow Trigger List component.
 *
 * Displays a list of workflows with trigger buttons and status.
 *
 * @module components/workflows/WorkflowTriggerList
 */

import React, { useState, useCallback, useEffect } from 'react';
import type { WorkflowIntent } from '@voiceinvoice/ai-orchestrator';
import {
  getAvailableWorkflows,
  triggerWorkflowWithRecording,
  type WorkflowWebhookConfig,
  type WorkflowResult,
} from '@/lib/workflow';

/**
 * Props for WorkflowTriggerList component.
 */
export interface WorkflowTriggerListProps {
  /** Callback after workflow execution */
  onWorkflowComplete?: (intent: WorkflowIntent, result: WorkflowResult) => void;
  /** Maximum number of workflows to show */
  maxItems?: number;
}

/**
 * State for a single workflow.
 */
interface WorkflowState {
  loading: boolean;
  lastResult: WorkflowResult | null;
  lastRunAt: Date | null;
}

/**
 * Icons for different workflow types.
 */
const WORKFLOW_ICONS: Record<string, string> = {
  WORKFLOW_RECHNUNGSEINGANG: '📧',
  WORKFLOW_MAHNWESEN: '⚠️',
  WORKFLOW_ZAHLUNGSABGLEICH: '💰',
  WORKFLOW_AUSGABEN: '📊',
  WORKFLOW_MONATSREPORT: '📈',
  WORKFLOW_LEAD_QUALIFIZIERUNG: '🎯',
  WORKFLOW_FOLLOW_UP: '📬',
  WORKFLOW_KUNDENFEEDBACK: '💬',
  WORKFLOW_VERTRAGS_ERINNERUNG: '📋',
  WORKFLOW_KUNDENANFRAGEN: '🔀',
};

/**
 * Formats a date as relative time.
 * @param date
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'gerade eben';
  if (diffMins < 60) return `vor ${diffMins}m`;
  if (diffHours < 24) return `vor ${diffHours}h`;
  return `vor ${diffDays}d`;
}

/**
 * Single workflow item component.
 * @param root0
 * @param root0.workflow
 * @param root0.state
 * @param root0.onTrigger
 */
function WorkflowItem({
  workflow,
  state,
  onTrigger,
}: {
  workflow: WorkflowWebhookConfig;
  state: WorkflowState;
  onTrigger: () => void;
}) {
  const icon = WORKFLOW_ICONS[workflow.intent] || '🔧';

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="text-xl">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{workflow.name}</p>
          <p className="text-xs text-gray-500 truncate">{workflow.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 ml-4">
        {state.lastRunAt && (
          <div className="text-right hidden sm:block">
            <p className="text-xs text-gray-500">{formatRelativeTime(state.lastRunAt)}</p>
            {state.lastResult && (
              <span
                className={`text-xs ${state.lastResult.success ? 'text-green-600' : 'text-red-600'}`}
              >
                {state.lastResult.success ? '✓' : '✗'}
              </span>
            )}
          </div>
        )}

        <button
          onClick={onTrigger}
          disabled={state.loading}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            state.loading
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {state.loading ? (
            <span className="flex items-center gap-1">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Läuft...
            </span>
          ) : (
            'Starten'
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * List of workflows with trigger buttons.
 *
 * @param props - Component props
 * @param props.onWorkflowComplete
 * @param props.maxItems
 * @returns Workflow trigger list
 *
 * @example
 * ```tsx
 * <WorkflowTriggerList onWorkflowComplete={handleComplete} />
 * ```
 */
export function WorkflowTriggerList({
  onWorkflowComplete,
  maxItems = 10,
}: WorkflowTriggerListProps): React.ReactElement {
  const [workflowStates, setWorkflowStates] = useState<Record<string, WorkflowState>>({});
  const [workflows, setWorkflows] = useState<WorkflowWebhookConfig[]>([]);

  useEffect(() => {
    getAvailableWorkflows().then((list) => {
      setWorkflows(list.slice(0, maxItems));
    });
  }, [maxItems]);

  const handleTrigger = useCallback(
    async (workflow: WorkflowWebhookConfig) => {
      // Set loading state
      setWorkflowStates((prev) => ({
        ...prev,
        [workflow.intent]: {
          ...prev[workflow.intent],
          loading: true,
        },
      }));

      try {
        const result = await triggerWorkflowWithRecording(workflow.intent, {});

        setWorkflowStates((prev) => ({
          ...prev,
          [workflow.intent]: {
            loading: false,
            lastResult: result,
            lastRunAt: new Date(),
          },
        }));

        onWorkflowComplete?.(workflow.intent, result);
      } catch (error) {
        const errorResult: WorkflowResult = {
          success: false,
          message: error instanceof Error ? error.message : 'Unbekannter Fehler',
          executionTimeMs: 0,
          errorType: 'UNKNOWN',
        };

        setWorkflowStates((prev) => ({
          ...prev,
          [workflow.intent]: {
            loading: false,
            lastResult: errorResult,
            lastRunAt: new Date(),
          },
        }));

        onWorkflowComplete?.(workflow.intent, errorResult);
      }
    },
    [onWorkflowComplete]
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Workflows starten</h3>

      {workflows.length === 0 ? (
        <p className="text-gray-500 text-sm">Keine Workflows konfiguriert</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {workflows.map((workflow) => (
            <WorkflowItem
              key={workflow.intent}
              workflow={workflow}
              state={
                workflowStates[workflow.intent] || {
                  loading: false,
                  lastResult: null,
                  lastRunAt: null,
                }
              }
              onTrigger={() => handleTrigger(workflow)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
