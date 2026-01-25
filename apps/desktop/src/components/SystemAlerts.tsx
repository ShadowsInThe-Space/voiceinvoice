/**
 * System Alerts Display Component
 *
 * Renders all active system alerts from the AlertContext.
 *
 * @module components/SystemAlerts
 */

import React from 'react';
import { useAlerts } from '../contexts/AlertContext';
import { SystemAlertContainer } from './SystemAlert';

/**
 * Displays all active system alerts.
 *
 * Uses the AlertContext to get and manage alerts.
 */
export function SystemAlerts(): React.ReactElement | null {
  const { alerts, removeAlert } = useAlerts();

  if (alerts.length === 0) {
    return null;
  }

  return <SystemAlertContainer alerts={alerts} onDismiss={removeAlert} />;
}

export default SystemAlerts;
