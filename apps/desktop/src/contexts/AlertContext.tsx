/**
 * Alert Context for global system alerts.
 *
 * Provides a way to show configuration warnings across the app.
 *
 * @module contexts/AlertContext
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { type SystemAlertConfig, SYSTEM_ALERTS } from '../components/SystemAlert';
import { getWorkflowConfig } from '../lib/workflow';

/**
 * Alert context value interface.
 */
interface AlertContextValue {
  /** Current alerts */
  alerts: SystemAlertConfig[];
  /** Add a new alert */
  addAlert: (alert: SystemAlertConfig) => void;
  /** Remove an alert by ID */
  removeAlert: (id: string) => void;
  /** Show a workflow error alert */
  showWorkflowError: (message: string) => void;
  /** Show a credentials missing alert */
  showCredentialsMissing: () => void;
  /** Check system configuration and show relevant alerts */
  checkSystemConfig: () => Promise<void>;
}

/**
 * LocalStorage key for dismissed alerts.
 */
const DISMISSED_ALERTS_KEY = 'voiceinvoice_dismissed_alerts';

/**
 * Alert context.
 */
const AlertContext = createContext<AlertContextValue | undefined>(undefined);

/**
 * Props for AlertProvider.
 */
interface AlertProviderProps {
  children: ReactNode;
}

/**
 * Alert provider component.
 * @param root0
 * @param root0.children
 */
export function AlertProvider({ children }: AlertProviderProps): React.ReactElement {
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
        // Don't add if already dismissed (unless it's not dismissible)
        if (dismissedIds.has(alert.id) && alert.dismissible !== false) {
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
    // Persist dismissal
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
  }, []);

  // Show workflow error alert
  const showWorkflowError = useCallback(
    (message: string) => {
      const alert: SystemAlertConfig = {
        ...SYSTEM_ALERTS.workflowExecutionFailed,
        id: `workflow-error-${Date.now()}`,
        message: message || SYSTEM_ALERTS.workflowExecutionFailed.message,
        autoDismissSeconds: 15,
      };
      addAlert(alert);
    },
    [addAlert]
  );

  // Show credentials missing alert
  const showCredentialsMissing = useCallback(() => {
    addAlert(SYSTEM_ALERTS.missingGoogleCredentials);
  }, [addAlert]);

  // Check system configuration
  const checkSystemConfig = useCallback(async () => {
    // Check if workflows are enabled but n8n is not reachable
    const workflowConfig = await getWorkflowConfig();
    if (workflowConfig.enabled) {
      try {
        const response = await fetch(`${workflowConfig.baseUrl}/healthz`, {
          method: 'GET',
          signal: AbortSignal.timeout(3000),
        });
        if (!response.ok) {
          addAlert(SYSTEM_ALERTS.n8nNotConnected);
        }
      } catch {
        addAlert(SYSTEM_ALERTS.n8nNotConnected);
      }
    }

    // Check for Gemini API key (localStorage OR environment)
    const geminiKey =
      localStorage.getItem('voiceinvoice_gemini_api_key') ||
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    if (!geminiKey) {
      addAlert(SYSTEM_ALERTS.missingGeminiApiKey);
    }
  }, [addAlert]);

  // Run system check on mount
  useEffect(() => {
    // Delay check to avoid blocking initial render
    const timer = setTimeout(() => {
      checkSystemConfig();
    }, 2000);
    return () => clearTimeout(timer);
  }, [checkSystemConfig]);

  const value: AlertContextValue = {
    alerts: alerts.filter((a) => !dismissedIds.has(a.id) || a.dismissible === false),
    addAlert,
    removeAlert,
    showWorkflowError,
    showCredentialsMissing,
    checkSystemConfig,
  };

  return <AlertContext.Provider value={value}>{children}</AlertContext.Provider>;
}

/**
 * Hook to use the alert context.
 */
export function useAlerts(): AlertContextValue {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlerts must be used within an AlertProvider');
  }
  return context;
}

export default AlertContext;
