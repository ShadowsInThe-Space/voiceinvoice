/**
 * Next.js App Component with Enterprise Layout
 *
 * Wraps all pages with a professional sidebar navigation,
 * header, and theme support using the new design system.
 *
 * @module pages/_app
 */

import type { AppProps } from 'next/app';
import '../styles/globals.css';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { cn } from '../lib/utils';
import {
  LayoutDashboard,
  FilePlus,
  FileText,
  Settings,
  Menu,
  Moon,
  Sun,
  X,
  Search,
  Bell,
  User,
  Mic,
} from 'lucide-react';
import { AlertProvider } from '../contexts/AlertContext';
import { SystemAlerts } from '../components/SystemAlerts';

/**
 * Navigation items configuration.
 */
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/invoices/new', label: 'Neue Rechnung', icon: FilePlus },
  { href: '/invoices', label: 'Rechnungen', icon: FileText },
  { href: '/settings', label: 'Einstellungen', icon: Settings },
];

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
  const [isScrolled, setIsScrolled] = useState(false);

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
      try {
        const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
        setIsDarkMode(prefersDark);
        if (prefersDark) {
          document.documentElement.classList.add('dark');
        }
      } catch {
        setIsDarkMode(false);
      }
    }
  }, []);

  // Handle Scroll for Header Shadow
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
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
    };
    router.events?.on('routeChangeComplete', handleRouteChange);
    return () => {
      router.events?.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);

  return (
    <AlertProvider>
      <div className="min-h-screen bg-background font-sans antialiased text-foreground">
        {/* Skip to Main Content Link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-md focus:m-2"
        >
          Zum Inhalt springen
        </a>

        {/* Navigation Status for Screen Readers */}
        <div role="status" aria-live="polite" className="sr-only" aria-label="Navigation Status">
          Seite geladen
        </div>

        {/* Mobile Overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
            onClick={toggleSidebar}
          />
        )}

        {/* Sidebar Navigation */}
        <aside
          role="navigation"
          className={cn(
            'fixed top-0 left-0 z-50 h-screen w-72 bg-card border-r border-border transition-transform duration-300 ease-in-out md:translate-x-0',
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {/* Logo Area */}
          <div className="flex h-16 items-center border-b border-border px-6">
            <div
              data-testid="app-logo"
              className="flex items-center gap-2 font-bold text-xl tracking-tight"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Mic className="h-5 w-5" />
              </div>
              <span>VoiceInvoice</span>
            </div>
            <button
              onClick={toggleSidebar}
              className="ml-auto md:hidden text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Nav Links */}
          <div className="flex flex-col gap-1 p-4">
            <div className="px-2 py-2 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
              Menu
            </div>
            {NAV_ITEMS.map((item) => {
              const isActive =
                router.pathname === item.href || router.pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary hover:bg-primary/20'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <item.icon
                    className={cn('h-4 w-4', isActive ? 'text-primary' : 'text-muted-foreground')}
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* User Profile / Bottom Section */}
          <div className="mt-auto border-t border-border p-4">
            <div className="flex items-center gap-3 rounded-md bg-muted/50 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary">
                <User className="h-5 w-5" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium truncate">Max Mustermann</p>
                <p className="text-xs text-muted-foreground truncate">Enterprise Plan</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="md:ml-72 flex min-h-screen flex-col">
          {/* Header */}
          <header
            role="banner"
            className={cn(
              'sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/95 px-6 backdrop-blur transition-shadow',
              isScrolled && 'shadow-sm'
            )}
          >
            <button
              onClick={toggleSidebar}
              aria-label="Menue"
              className="md:hidden text-muted-foreground hover:text-foreground"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Breadcrumbs or Page Title could go here */}
            <div className="hidden md:flex items-center text-sm font-medium text-muted-foreground">
              <span className="text-foreground">Dashboard</span>
            </div>

            <div className="ml-auto flex items-center gap-4">
              {/* Search (Mock) */}
              <div className="relative hidden sm:block">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="search"
                  placeholder="Suche..."
                  className="h-9 w-64 rounded-md border border-input bg-background pl-9 pr-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Notifications */}
              <button className="relative text-muted-foreground hover:text-foreground">
                <Bell className="h-5 w-5" />
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-destructive" />
              </button>

              {/* Theme Toggle */}
              <button
                onClick={toggleDarkMode}
                aria-label="Modus wechseln"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {isDarkMode ? (
                  <Sun data-testid="sun-icon" className="h-4 w-4" />
                ) : (
                  <Moon data-testid="moon-icon" className="h-4 w-4" />
                )}
              </button>
            </div>
          </header>

          {/* Page Content */}
          <main id="main-content" className="flex-1 p-6 md:p-8">
            <SystemAlerts />
            <Component {...pageProps} />
          </main>
        </div>
      </div>
    </AlertProvider>
  );
}
