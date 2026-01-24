/**
 * VoiceInvoice Desktop Application - Root Page
 *
 * Redirects to the dashboard.
 *
 * @module pages/index
 */

import { useEffect } from 'react';
import { useRouter } from 'next/router';

/**
 * Root page component that redirects to dashboard.
 *
 * @returns {null} No visible content, redirects immediately
 */
export default function Home(): null {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return null;
}
