/**
 * Next.js App Component with Layout
 *
 * Wraps all pages with navigation sidebar, header, and theme support.
 *
 * @module pages/_app
 */

import type { AppProps } from 'next/app';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

/**
 * Navigation items configuration.
 */
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: 'chart' },
  { href: '/invoices/new', label: 'Neue Rechnung', icon: 'plus' },
  { href: '/invoices', label: 'Rechnungen', icon: 'document' },
  { href: '/settings', label: 'Einstellungen', icon: 'cog' },
];

/**
 * Icon component for navigation items.
 */
function NavIcon({ name }: { name: string }): React.ReactElement {
  switch (name) {
    case 'chart':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    case 'plus':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      );
    case 'document':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'cog':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    default:
      return <span />;
  }
}

/**
 * Sun icon for light mode toggle.
 */
function SunIcon(): React.ReactElement {
  return (
    <svg data-testid="sun-icon" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

/**
 * Moon icon for dark mode toggle.
 */
function MoonIcon(): React.ReactElement {
  return (
    <svg data-testid="moon-icon" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
}

/**
 * Application wrapper component with layout.
 *
 * @param {AppProps} props - Next.js app props
 * @returns {React.ReactElement} The wrapped application
 */
export default function App({ Component, pageProps }: AppProps): React.ReactElement {
  const router = useRouter();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [navStatus, setNavStatus] = useState('');

  // Initialize theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('voiceinvoice_theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else if (savedTheme === 'light') {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    } else {
      // Check system preference (with fallback for test environment)
      try {
        const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
        setIsDarkMode(prefersDark);
        if (prefersDark) {
          document.documentElement.classList.add('dark');
        }
      } catch {
        // Fallback for environments without matchMedia
        setIsDarkMode(false);
      }
    }
  }, []);

  // Toggle dark mode
  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => {
      const newValue = !prev;
      if (newValue) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('voiceinvoice_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('voiceinvoice_theme', 'light');
      }
      return newValue;
    });
  }, []);

  // Toggle sidebar for mobile
  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  // Close sidebar on navigation
  useEffect(() => {
    const handleRouteChange = () => {
      setIsSidebarOpen(false);
      setNavStatus('Navigation abgeschlossen');
    };

    router.events?.on('routeChangeComplete', handleRouteChange);

    return () => {
      router.events?.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Skip to main content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded"
      >
        Zum Inhalt springen
      </a>

      {/* Navigation status for screen readers */}
      <div
        role="status"
        aria-label="Navigation Status"
        aria-live="polite"
        className="sr-only"
      >
        {navStatus}
      </div>

      {/* Header */}
      <header role="banner" className="fixed top-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 shadow-sm">
        <div className="flex items-center justify-between h-16 px-4">
          {/* Mobile menu button */}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Menue"
            className="md:hidden p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* App logo and name */}
          <div data-testid="app-logo" className="flex items-center">
            <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">
              VoiceInvoice
            </span>
          </div>

          {/* Dark mode toggle */}
          <button
            type="button"
            onClick={toggleDarkMode}
            aria-label="Modus wechseln"
            className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {isDarkMode ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </header>

      {/* Sidebar Navigation */}
      <nav
        role="navigation"
        className={`
          fixed top-16 left-0 bottom-0 z-30 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
          transform transition-transform duration-200 ease-in-out
          ${isSidebarOpen ? 'translate-x-0 block' : '-translate-x-full hidden md:translate-x-0 md:block'}
        `}
      >
        <div className="py-4">
          <ul className="space-y-1">
            {NAV_ITEMS.map(({ href, label, icon }) => {
              const isActive = router.pathname === href || router.pathname.startsWith(href + '/');
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`
                      flex items-center gap-3 px-4 py-3 text-sm font-medium
                      transition-colors duration-150
                      ${isActive
                        ? 'active bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-r-2 border-blue-600'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }
                    `}
                  >
                    <NavIcon name={icon} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* Sidebar overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 md:hidden"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      {/* Main content area */}
      <main
        id="main-content"
        role="main"
        className="pt-16 md:ml-64 min-h-screen"
      >
        <div className="p-6">
          <Component {...pageProps} />
        </div>
      </main>
    </div>
  );
}
