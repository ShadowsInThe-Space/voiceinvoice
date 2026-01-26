/**
 * VoiceInvoice Desktop Application - Root Page
 *
 * Redirects to the dashboard.
 *
 * @module pages/index
 */

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import type { ReactElement } from 'react';

/**
 * Root page component that redirects to dashboard.
 *
 * @returns {ReactElement} Loading spinner while redirecting
 */
export default function Home(): ReactElement {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  // Show loading spinner while redirect happens
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-primary border-r-transparent mx-auto" />
        <p className="mt-6 text-lg font-medium text-muted-foreground animate-pulse">
          VoiceInvoice wird geladen...
        </p>
      </div>
    </div>
  );
}
