/**
 * Workflow Trigger Service for n8n Integration
 *
 * Triggers n8n workflows based on voice commands via webhook calls.
 * Maps workflow intents to webhook URLs and handles responses.
 *
 * @module lib/workflow/workflow-trigger
 */

import type { WorkflowIntent } from '@voiceinvoice/ai-orchestrator';

/**
 * LocalStorage keys for workflow configuration.
 */
export const WORKFLOW_STORAGE_KEYS = {
  enabled: 'voiceinvoice_workflows_enabled',
  baseUrl: 'voiceinvoice_workflows_base_url',
  webhooks: 'voiceinvoice_workflows_webhooks',
} as const;

/**
 * Configuration for a single workflow webhook.
 */
export interface WorkflowWebhookConfig {
  /** Workflow intent this webhook handles */
  intent: WorkflowIntent;
  /** Webhook URL path (appended to base URL) */
  path: string;
  /** Whether this workflow is enabled */
  enabled: boolean;
  /** Human-readable workflow name */
  name: string;
  /** Description of what the workflow does */
  description: string;
}

/**
 * Full workflow configuration.
 */
export interface WorkflowConfig {
  /** Whether workflow triggers are enabled globally */
  enabled: boolean;
  /** Base URL for n8n webhooks (e.g., http://localhost:5678/webhook) */
  baseUrl: string;
  /** Individual workflow webhook configurations */
  webhooks: WorkflowWebhookConfig[];
}

/**
 * Parameters that can be passed to a workflow.
 */
export interface WorkflowParams {
  /** Original voice transcription */
  transcription?: string;
  /** Extracted customer name */
  customerName?: string;
  /** Extracted amount */
  amount?: number;
  /** Start date for date-range queries */
  startDate?: string;
  /** End date for date-range queries */
  endDate?: string;
  /** Any additional extracted entities */
  entities?: Record<string, unknown>;
}

/**
 * Error types for workflow failures.
 */
export type WorkflowErrorType =
  | 'WORKFLOW_NOT_CONFIGURED'
  | 'N8N_NOT_REACHABLE'
  | 'CREDENTIALS_MISSING'
  | 'EXECUTION_FAILED'
  | 'TIMEOUT'
  | 'UNKNOWN';

/**
 * Result returned from a workflow execution.
 */
export interface WorkflowResult {
  /** Whether the workflow executed successfully */
  success: boolean;
  /** Human-readable message for voice output */
  message: string;
  /** Structured data returned by the workflow */
  data?: Record<string, unknown>;
  /** Error details if failed */
  error?: string;
  /** Error type for programmatic handling */
  errorType?: WorkflowErrorType;
  /** Execution time in milliseconds */
  executionTimeMs: number;
  /** Whether credentials are missing (convenience flag) */
  credentialsMissing?: boolean;
}

/**
 * Retry configuration for workflow calls.
 */
const WORKFLOW_RETRY_CONFIG = {
  maxRetries: 2,
  baseDelayMs: 500,
  timeoutMs: 30000, // Workflows may take longer
} as const;

/**
 * Default webhook configurations for all workflow intents.
 */
const DEFAULT_WORKFLOW_WEBHOOKS: WorkflowWebhookConfig[] = [
  {
    intent: 'WORKFLOW_RECHNUNGSEINGANG',
    path: '/webhook/rechnungseingang',
    enabled: true,
    name: 'Rechnungseingangs-Agent',
    description: 'Prüft eingehende E-Mails nach Rechnungen und extrahiert Daten',
  },
  {
    intent: 'WORKFLOW_MAHNWESEN',
    path: '/webhook/mahnwesen',
    enabled: true,
    name: 'Mahnwesen-Agent',
    description: 'Prüft überfällige Rechnungen und erstellt Mahnungen',
  },
  {
    intent: 'WORKFLOW_ZAHLUNGSABGLEICH',
    path: '/webhook/zahlungsabgleich',
    enabled: true,
    name: 'Zahlungsabgleich-Agent',
    description: 'Vergleicht Kontoauszüge mit offenen Rechnungen',
  },
  {
    intent: 'WORKFLOW_AUSGABEN',
    path: '/webhook/ausgaben',
    enabled: true,
    name: 'Ausgaben-Kategorisierung',
    description: 'Kategorisiert Ausgaben automatisch für die Buchhaltung',
  },
  {
    intent: 'WORKFLOW_MONATSREPORT',
    path: '/webhook/monatsreport',
    enabled: true,
    name: 'Monatsabschluss-Report',
    description: 'Erstellt monatliche Finanzübersicht',
  },
  {
    intent: 'WORKFLOW_LEAD_QUALIFIZIERUNG',
    path: '/webhook/lead-qualifizierung',
    enabled: true,
    name: 'Lead-Qualifizierung',
    description: 'Bewertet neue Leads anhand von Kriterien',
  },
  {
    intent: 'WORKFLOW_FOLLOW_UP',
    path: '/webhook/follow-up',
    enabled: true,
    name: 'Follow-up-Agent',
    description: 'Sendet automatische Follow-up-E-Mails',
  },
  {
    intent: 'WORKFLOW_KUNDENFEEDBACK',
    path: '/webhook/kundenfeedback',
    enabled: true,
    name: 'Kundenfeedback-Sammler',
    description: 'Sammelt und analysiert Kundenfeedback',
  },
  {
    intent: 'WORKFLOW_VERTRAGS_ERINNERUNG',
    path: '/webhook/vertrags-erinnerung',
    enabled: true,
    name: 'Vertrags-Erinnerung',
    description: 'Erinnert vor Vertragsablauf',
  },
  {
    intent: 'WORKFLOW_KUNDENANFRAGEN',
    path: '/webhook/kundenanfragen',
    enabled: true,
    name: 'Kundenanfragen-Router',
    description: 'Klassifiziert und verteilt eingehende Anfragen',
  },
];

/**
 * Delays execution for a specified number of milliseconds.
 * @param ms
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Validates a base URL for webhooks.
 * @param url
 */
export function isValidBaseUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Retrieves the workflow configuration.
 * Prefers backend settings if available (Electron context), falls back to localStorage.
 */
export async function getWorkflowConfig(): Promise<WorkflowConfig> {
  let enabled = false;
  let baseUrl = 'http://localhost:5678';
  let webhooks: WorkflowWebhookConfig[] = [...DEFAULT_WORKFLOW_WEBHOOKS];

  // Try to load from backend if in Electron
  if (typeof window !== 'undefined' && window.voiceinvoice?.settings) {
    try {
      const settings = (await window.voiceinvoice.settings.get()) as Record<string, string>;

      if (settings[WORKFLOW_STORAGE_KEYS.enabled] !== undefined) {
        enabled = settings[WORKFLOW_STORAGE_KEYS.enabled] === 'true';
      } else {
        enabled = localStorage.getItem(WORKFLOW_STORAGE_KEYS.enabled) === 'true';
      }

      if (settings[WORKFLOW_STORAGE_KEYS.baseUrl]) {
        baseUrl = settings[WORKFLOW_STORAGE_KEYS.baseUrl];
      } else {
        baseUrl = localStorage.getItem(WORKFLOW_STORAGE_KEYS.baseUrl) ?? baseUrl;
      }

      if (settings[WORKFLOW_STORAGE_KEYS.webhooks]) {
        try {
          webhooks = JSON.parse(settings[WORKFLOW_STORAGE_KEYS.webhooks]);
        } catch (e) {
          console.error('[Workflow] Failed to parse webhooks from backend:', e);
        }
      } else {
        const stored = localStorage.getItem(WORKFLOW_STORAGE_KEYS.webhooks);
        if (stored) {
          try {
            webhooks = JSON.parse(stored);
          } catch (e) {
            console.error('[Workflow] Failed to parse webhooks from localStorage:', e);
          }
        }
      }

      return { enabled, baseUrl, webhooks };
    } catch (err) {
      console.error('[Workflow] Failed to load settings from backend:', err);
    }
  }

  // Fallback to localStorage only
  enabled = localStorage.getItem(WORKFLOW_STORAGE_KEYS.enabled) === 'true';
  baseUrl = localStorage.getItem(WORKFLOW_STORAGE_KEYS.baseUrl) ?? baseUrl;

  const stored = localStorage.getItem(WORKFLOW_STORAGE_KEYS.webhooks);
  if (stored) {
    try {
      webhooks = JSON.parse(stored);
    } catch {
      webhooks = DEFAULT_WORKFLOW_WEBHOOKS;
    }
  }

  return { enabled, baseUrl, webhooks };
}

/**
 * Saves the workflow configuration.
 * Saves to both backend (if available) and localStorage.
 * @param config
 */
export async function saveWorkflowConfig(config: WorkflowConfig): Promise<void> {
  // Save to localStorage
  localStorage.setItem(WORKFLOW_STORAGE_KEYS.enabled, String(config.enabled));
  localStorage.setItem(WORKFLOW_STORAGE_KEYS.baseUrl, config.baseUrl);
  localStorage.setItem(WORKFLOW_STORAGE_KEYS.webhooks, JSON.stringify(config.webhooks));

  // Save to backend if in Electron
  if (typeof window !== 'undefined' && window.voiceinvoice?.settings) {
    try {
      await window.voiceinvoice.settings.update({
        [WORKFLOW_STORAGE_KEYS.enabled]: String(config.enabled),
        [WORKFLOW_STORAGE_KEYS.baseUrl]: config.baseUrl,
        [WORKFLOW_STORAGE_KEYS.webhooks]: JSON.stringify(config.webhooks),
      });
    } catch (err) {
      console.error('[Workflow] Failed to save settings to backend:', err);
    }
  }
}

/**
 * Gets the webhook URL for a specific workflow intent.
 * @param intent
 */
export async function getWebhookUrl(intent: WorkflowIntent): Promise<string | null> {
  const config = await getWorkflowConfig();

  if (!config.enabled || !isValidBaseUrl(config.baseUrl)) {
    return null;
  }

  const webhook = config.webhooks.find((w) => w.intent === intent && w.enabled);
  if (!webhook) {
    return null;
  }

  // Combine base URL with webhook path
  const baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
  const path = webhook.path.startsWith('/') ? webhook.path : `/${webhook.path}`;
  return `${baseUrl}${path}`;
}

/**
 * Triggers a workflow via webhook call.
 *
 * @param intent - The workflow intent to trigger
 * @param params - Parameters to pass to the workflow
 * @returns Workflow execution result
 */
export async function triggerWorkflow(
  intent: WorkflowIntent,
  params: WorkflowParams = {}
): Promise<WorkflowResult> {
  const startTime = Date.now();

  const url = await getWebhookUrl(intent);
  if (!url) {
    return {
      success: false,
      message: 'Workflow ist nicht konfiguriert oder deaktiviert.',
      error: 'Workflow nicht konfiguriert',
      errorType: 'WORKFLOW_NOT_CONFIGURED',
      executionTimeMs: Date.now() - startTime,
    };
  }

  const config = await getWorkflowConfig();
  const webhook = config.webhooks.find((w: WorkflowWebhookConfig) => w.intent === intent);

  // Build payload
  const payload = {
    intent,
    workflowName: webhook?.name ?? intent,
    triggeredAt: new Date().toISOString(),
    params,
  };

  // Try to call the webhook with retries
  for (let attempt = 0; attempt <= WORKFLOW_RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), WORKFLOW_RETRY_CONFIG.timeoutMs);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json().catch(() => ({}));

        return {
          success: true,
          message: data.message ?? `${webhook?.name ?? 'Workflow'} wurde erfolgreich ausgeführt.`,
          data,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // HTTP error
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    } catch (error) {
      // If this was the last attempt, return failure
      if (attempt === WORKFLOW_RETRY_CONFIG.maxRetries) {
        const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
        console.error(`[Workflow] Failed to trigger ${intent}:`, errorMessage);

        // Detect error type
        const { errorType, credentialsMissing, userMessage } = detectErrorType(errorMessage);

        return {
          success: false,
          message: userMessage,
          error: errorMessage,
          errorType,
          credentialsMissing,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Wait before retry
      const delayMs = WORKFLOW_RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
      await delay(delayMs);
    }
  }

  // Should not reach here, but just in case
  return {
    success: false,
    message: 'Workflow-Ausführung fehlgeschlagen.',
    error: 'Unerwarteter Fehler',
    errorType: 'UNKNOWN',
    executionTimeMs: Date.now() - startTime,
  };
}

/**
 * Detects the error type from an error message.
 *
 * @param errorMessage - The error message to analyze
 * @returns Error type information
 */
function detectErrorType(errorMessage: string): {
  errorType: WorkflowErrorType;
  credentialsMissing: boolean;
  userMessage: string;
} {
  const lowerError = errorMessage.toLowerCase();

  // Check for credentials issues
  if (
    lowerError.includes('credential') ||
    lowerError.includes('authentication') ||
    lowerError.includes('unauthorized') ||
    lowerError.includes('401') ||
    lowerError.includes('oauth') ||
    lowerError.includes('token')
  ) {
    return {
      errorType: 'CREDENTIALS_MISSING',
      credentialsMissing: true,
      userMessage:
        'Workflow fehlgeschlagen: API-Zugangsdaten oder Credentials fehlen. Bitte in n8n konfigurieren.',
    };
  }

  // Check for connection issues
  if (
    lowerError.includes('econnrefused') ||
    lowerError.includes('network') ||
    lowerError.includes('fetch failed') ||
    lowerError.includes('not reachable')
  ) {
    return {
      errorType: 'N8N_NOT_REACHABLE',
      credentialsMissing: false,
      userMessage: 'n8n ist nicht erreichbar. Bitte prüfen Sie, ob n8n läuft.',
    };
  }

  // Check for timeout
  if (lowerError.includes('timeout') || lowerError.includes('aborted')) {
    return {
      errorType: 'TIMEOUT',
      credentialsMissing: false,
      userMessage: 'Workflow-Ausführung hat zu lange gedauert. Bitte erneut versuchen.',
    };
  }

  // Check for execution errors (often contain "problem executing")
  if (lowerError.includes('problem executing') || lowerError.includes('execution failed')) {
    // Could still be credentials
    if (
      lowerError.includes('sheet') ||
      lowerError.includes('gmail') ||
      lowerError.includes('drive')
    ) {
      return {
        errorType: 'CREDENTIALS_MISSING',
        credentialsMissing: true,
        userMessage:
          'Workflow fehlgeschlagen: Google API Credentials (Sheets/Gmail/Drive) fehlen. Bitte in n8n einrichten.',
      };
    }
    return {
      errorType: 'EXECUTION_FAILED',
      credentialsMissing: false,
      userMessage: `Workflow-Ausführung fehlgeschlagen: ${errorMessage}`,
    };
  }

  // Default
  return {
    errorType: 'UNKNOWN',
    credentialsMissing: false,
    userMessage: `Workflow konnte nicht ausgeführt werden: ${errorMessage}`,
  };
}

/**
 * Gets information about all available workflows.
 */
export async function getAvailableWorkflows(): Promise<WorkflowWebhookConfig[]> {
  const config = await getWorkflowConfig();
  return config.webhooks.filter((w: WorkflowWebhookConfig) => w.enabled);
}

/**
 * Gets the human-readable name for a workflow intent.
 * @param intent
 */
export async function getWorkflowName(intent: WorkflowIntent): Promise<string> {
  const config = await getWorkflowConfig();
  const webhook = config.webhooks.find((w: WorkflowWebhookConfig) => w.intent === intent);
  return webhook?.name ?? intent.replace('WORKFLOW_', '').replace(/_/g, ' ');
}

/**
 * Gets the description for a workflow intent.
 * @param intent
 */
export async function getWorkflowDescription(intent: WorkflowIntent): Promise<string> {
  const config = await getWorkflowConfig();
  const webhook = config.webhooks.find((w: WorkflowWebhookConfig) => w.intent === intent);
  return webhook?.description ?? '';
}

/**
 * Callback type for recording workflow executions.
 * This allows decoupling from the database service.
 */
export type WorkflowRecordCallback = (
  intent: WorkflowIntent,
  workflowName: string,
  result: WorkflowResult,
  params?: WorkflowParams
) => Promise<void>;

/**
 * Global callback for recording workflow executions.
 * Set this from the app initialization to enable automatic recording.
 */
let recordCallback: WorkflowRecordCallback | null = null;

/**
 * Sets the callback for recording workflow executions.
 *
 * @param callback - The callback function to use for recording
 */
export function setWorkflowRecordCallback(callback: WorkflowRecordCallback | null): void {
  recordCallback = callback;
}

/**
 * Triggers a workflow and automatically records the execution.
 *
 * @param intent - The workflow intent to trigger
 * @param params - Parameters to pass to the workflow
 * @returns Workflow execution result
 */
export async function triggerWorkflowWithRecording(
  intent: WorkflowIntent,
  params: WorkflowParams = {}
): Promise<WorkflowResult> {
  const result = await triggerWorkflow(intent, params);
  const workflowName = await getWorkflowName(intent);

  // Record the execution if callback is set
  if (recordCallback) {
    try {
      await recordCallback(intent, workflowName, result, params);
    } catch (error) {
      console.error('[Workflow] Failed to record execution:', error);
    }
  }

  return result;
}
