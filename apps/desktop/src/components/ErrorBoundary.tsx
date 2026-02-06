/**
 * @file React Error Boundary für globales Error Handling
 * @module components/ErrorBoundary
 */

import React from 'react';
import * as Sentry from '@sentry/nextjs';

/**
 * Props für die ErrorBoundary Komponente
 */
interface ErrorBoundaryProps {
  /** Zu überwachende Child-Komponenten */
  children: React.ReactNode;
}

/**
 * State der ErrorBoundary
 */
interface ErrorBoundaryState {
  /** Ob ein Fehler aufgetreten ist */
  hasError: boolean;
  /** Der aufgetretene Fehler (falls vorhanden) */
  error: Error | null;
}

/**
 * React Error Boundary zur globalen Fehlerbehandlung.
 *
 * @description
 * Fängt Fehler in der gesamten React-Komponentenhierarchie ab und zeigt ein
 * benutzerfreundliches Fehler-UI an. Im Production-Modus werden Fehler an
 * Sentry gesendet.
 *
 * Features:
 * - Zeigt deutschen Fehlertext an
 * - "Neu laden" Button zum Neuladen der Seite
 * - "Fehler melden" Button zum Kopieren der Fehlerdetails
 * - Sendet Fehler an Sentry (nur Production)
 *
 * @example
 * ```tsx
 * // In _app.tsx
 * import { ErrorBoundary } from '@/components/ErrorBoundary';
 *
 * function MyApp({ Component, pageProps }) {
 *   return (
 *     <ErrorBoundary>
 *       <Component {...pageProps} />
 *     </ErrorBoundary>
 *   );
 * }
 * ```
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  /**
   * Erstellt eine neue ErrorBoundary Instanz.
   *
   * @param props - Component Props
   */
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  /**
   * Static Lifecycle-Method: Wird aufgerufen wenn ein Error auftritt.
   * Aktualisiert den State um das Error-UI anzuzeigen.
   *
   * @param error - Der aufgetretene Fehler
   * @returns Neuer State mit Fehlerinformation
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  /**
   * Lifecycle-Method: Wird nach einem Fehler aufgerufen.
   * Sendet den Fehler an Sentry im Production-Modus.
   *
   * @param error - Der aufgetretene Fehler
   * @param errorInfo - React Error Info mit Component Stack
   */
  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    if (process.env.NODE_ENV === 'production') {
      Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
    } else {
      console.error('[ErrorBoundary]', error, errorInfo);
    }
  }

  /**
   * Handler für "Neu laden" Button.
   * Lädt die komplette Seite neu.
   */
  handleReload = (): void => {
    window.location.reload();
  };

  /**
   * Handler für "Fehler melden" Button.
   * Kopiert Fehlerdetails in die Zwischenablage.
   */
  handleCopyError = (): void => {
    const errorText = `Fehler: ${this.state.error?.message}\n\nStack: ${this.state.error?.stack}`;
    navigator.clipboard.writeText(errorText);
    alert('Fehlerdetails in Zwischenablage kopiert');
  };

  /**
   * Rendert entweder die Children oder das Error-UI.
   *
   * @returns React Element
   */
  override render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h1>Etwas ist schiefgelaufen</h1>
          <p>Die Anwendung hat einen unerwarteten Fehler festgestellt.</p>
          <div style={{ marginTop: '1rem' }}>
            <button onClick={this.handleReload} style={{ marginRight: '1rem' }}>
              Neu laden
            </button>
            <button onClick={this.handleCopyError}>Fehler melden (kopieren)</button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
