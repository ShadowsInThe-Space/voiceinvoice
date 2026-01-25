/**
 * System Alert Component for Configuration Warnings
 *
 * Displays persistent alerts for missing API keys, credentials,
 * or license issues that need user attention.
 *
 * @module components/SystemAlert
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, X, Settings, ExternalLink, Key, Shield } from 'lucide-react';
import Link from 'next/link';
import { cn } from '../lib/utils';

/**
 * Types of system alerts.
 */
export type AlertType = 'credentials' | 'apikey' | 'license' | 'workflow' | 'warning';

/**
 * System alert configuration.
 */
export interface SystemAlertConfig {
  /** Unique identifier for the alert */
  id: string;
  /** Alert type for styling */
  type: AlertType;
  /** Alert title */
  title: string;
  /** Detailed message */
  message: string;
  /** Optional link to resolve the issue */
  actionLink?: string;
  /** Optional action label */
  actionLabel?: string;
  /** Whether the alert can be dismissed */
  dismissible?: boolean;
  /** Auto-dismiss after this many seconds (0 = never) */
  autoDismissSeconds?: number;
}

/**
 * LocalStorage key for dismissed alerts.
 */
const DISMISSED_ALERTS_KEY = 'voiceinvoice_dismissed_alerts';

/**
 * Gets the icon for an alert type.
 * @param type
 */
function getAlertIcon(type: AlertType): React.ReactNode {
  switch (type) {
    case 'credentials':
      return <Key className="h-5 w-5" />;
    case 'apikey':
      return <Key className="h-5 w-5" />;
    case 'license':
      return <Shield className="h-5 w-5" />;
    case 'workflow':
      return <AlertTriangle className="h-5 w-5" />;
    default:
      return <AlertTriangle className="h-5 w-5" />;
  }
}

/**
 * Gets the color classes for an alert type.
 * @param type
 */
function getAlertColors(type: AlertType): string {
  switch (type) {
    case 'credentials':
    case 'apikey':
      return 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-100';
    case 'license':
      return 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950 dark:border-red-800 dark:text-red-100';
    case 'workflow':
      return 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-100';
    default:
      return 'bg-yellow-50 border-yellow-200 text-yellow-900 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-100';
  }
}

/**
 * Gets the icon color for an alert type.
 * @param type
 */
function getIconColor(type: AlertType): string {
  switch (type) {
    case 'credentials':
    case 'apikey':
      return 'text-amber-600 dark:text-amber-400';
    case 'license':
      return 'text-red-600 dark:text-red-400';
    case 'workflow':
      return 'text-blue-600 dark:text-blue-400';
    default:
      return 'text-yellow-600 dark:text-yellow-400';
  }
}

/**
 * Props for the SystemAlert component.
 */
interface SystemAlertProps {
  /** Alert configuration */
  alert: SystemAlertConfig;
  /** Callback when alert is dismissed */
  onDismiss?: ((id: string) => void) | undefined;
}

/**
 * Single system alert display.
 * @param root0
 * @param root0.alert
 * @param root0.onDismiss
 */
export function SystemAlert({ alert, onDismiss }: SystemAlertProps): React.ReactElement {
  const [isVisible, setIsVisible] = useState(true);

  // Auto-dismiss timer
  useEffect(() => {
    if (alert.autoDismissSeconds && alert.autoDismissSeconds > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, alert.autoDismissSeconds * 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [alert.autoDismissSeconds]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    if (onDismiss) {
      onDismiss(alert.id);
    }
  }, [alert.id, onDismiss]);

  if (!isVisible) {
    return <></>;
  }

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4 shadow-sm transition-all',
        getAlertColors(alert.type)
      )}
    >
      <div className={cn('flex-shrink-0 mt-0.5', getIconColor(alert.type))}>
        {getAlertIcon(alert.type)}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm">{alert.title}</h3>
        <p className="text-sm mt-1 opacity-90">{alert.message}</p>
        {alert.actionLink && (
          <div className="mt-3">
            {alert.actionLink.startsWith('http') ? (
              <a
                href={alert.actionLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-2 hover:opacity-80"
              >
                {alert.actionLabel ?? 'Jetzt beheben'}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <Link
                href={alert.actionLink}
                className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-2 hover:opacity-80"
              >
                <Settings className="h-3.5 w-3.5" />
                {alert.actionLabel ?? 'Jetzt beheben'}
              </Link>
            )}
          </div>
        )}
      </div>
      {alert.dismissible !== false && (
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          aria-label="Schliessen"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/**
 * Props for SystemAlertContainer.
 */
interface SystemAlertContainerProps {
  /** Alerts to display */
  alerts: SystemAlertConfig[];
  /** Callback when an alert is dismissed */
  onDismiss?: (id: string) => void;
}

/**
 * Container for multiple system alerts.
 * @param root0
 * @param root0.alerts
 * @param root0.onDismiss
 */
export function SystemAlertContainer({
  alerts,
  onDismiss,
}: SystemAlertContainerProps): React.ReactElement | null {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mb-6">
      {alerts.map((alert) => (
        <SystemAlert key={alert.id} alert={alert} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

/**
 * Hook to manage system alerts with persistence.
 */
export function useSystemAlerts() {
  const [alerts, setAlerts] = useState<SystemAlertConfig[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Load dismissed alerts from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DISMISSED_ALERTS_KEY);
      if (stored) {
        setDismissedIds(new Set(JSON.parse(stored)));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Add an alert
  const addAlert = useCallback(
    (alert: SystemAlertConfig) => {
      setAlerts((prev) => {
        // Don't add if already dismissed
        if (dismissedIds.has(alert.id)) {
          return prev;
        }
        // Don't add duplicates
        if (prev.some((a) => a.id === alert.id)) {
          return prev;
        }
        return [...prev, alert];
      });
    },
    [dismissedIds]
  );

  // Remove an alert
  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Dismiss an alert (with persistence)
  const dismissAlert = useCallback(
    (id: string, persist: boolean = false) => {
      removeAlert(id);
      if (persist) {
        setDismissedIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          try {
            localStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify([...next]));
          } catch {
            // Ignore storage errors
          }
          return next;
        });
      }
    },
    [removeAlert]
  );

  // Clear all alerts
  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // Get visible alerts (excluding dismissed)
  const visibleAlerts = alerts.filter((a) => !dismissedIds.has(a.id));

  return {
    alerts: visibleAlerts,
    addAlert,
    removeAlert,
    dismissAlert,
    clearAlerts,
  };
}

/**
 * Pre-defined alert configurations for common issues.
 */
export const SYSTEM_ALERTS = {
  missingGoogleCredentials: {
    id: 'missing-google-credentials',
    type: 'credentials' as AlertType,
    title: 'Google Credentials fehlen',
    message:
      'Für die Workflow-Automatisierung werden Google OAuth Credentials (Gmail, Sheets) benötigt. Bitte richten Sie diese in n8n ein.',
    actionLink: 'http://localhost:5678/home/credentials',
    actionLabel: 'n8n Credentials einrichten',
    dismissible: true,
  },
  missingGeminiApiKey: {
    id: 'missing-gemini-apikey',
    type: 'apikey' as AlertType,
    title: 'Gemini API Key fehlt',
    message: 'Für die KI-gestützte Rechnungserstellung wird ein Google Gemini API Key benötigt.',
    actionLink: '/settings',
    actionLabel: 'API Key konfigurieren',
    dismissible: true,
  },
  workflowExecutionFailed: {
    id: 'workflow-execution-failed',
    type: 'workflow' as AlertType,
    title: 'Workflow-Ausführung fehlgeschlagen',
    message:
      'Der Workflow konnte nicht ausgeführt werden. Möglicherweise fehlen Credentials oder die Konfiguration ist unvollständig.',
    actionLink: 'http://localhost:5678/home/workflows',
    actionLabel: 'Workflows prüfen',
    dismissible: true,
    autoDismissSeconds: 30,
  },
  licenseExpired: {
    id: 'license-expired',
    type: 'license' as AlertType,
    title: 'Lizenz abgelaufen',
    message:
      'Ihre VoiceInvoice Enterprise Lizenz ist abgelaufen. Einige Funktionen sind eingeschränkt.',
    actionLink: '/settings',
    actionLabel: 'Lizenz erneuern',
    dismissible: false,
  },
  n8nNotConnected: {
    id: 'n8n-not-connected',
    type: 'workflow' as AlertType,
    title: 'n8n nicht erreichbar',
    message:
      'Die Verbindung zu n8n konnte nicht hergestellt werden. Stellen Sie sicher, dass n8n unter http://localhost:5678 läuft.',
    actionLink: 'http://localhost:5678',
    actionLabel: 'n8n öffnen',
    dismissible: true,
  },
};

export default SystemAlert;
