/**
 * App Layout Tests
 *
 * TDD tests for the main application layout.
 * Tests navigation sidebar, header, and dark/light mode toggle.
 *
 * @module tests/pages/_app.test
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock next/router
const mockPush = vi.fn();
vi.mock('next/router', () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
    pathname: '/',
    events: {
      on: vi.fn(),
      off: vi.fn(),
    },
  })),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Import after mocks
import App from '../../src/pages/_app';

// Test component for page content
const TestPage = () => <div data-testid="test-page">Test Content</div>;

describe('App Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render the app wrapper', () => {
      render(<App Component={TestPage} pageProps={{}} router={{} as any} />);

      expect(screen.getByTestId('test-page')).toBeInTheDocument();
    });

    it('should render the application header', () => {
      render(<App Component={TestPage} pageProps={{}} router={{} as any} />);

      expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    it('should display app name in header', () => {
      render(<App Component={TestPage} pageProps={{}} router={{} as any} />);

      expect(screen.getByText(/voiceinvoice/i)).toBeInTheDocument();
    });

    it('should render navigation sidebar', () => {
      render(<App Component={TestPage} pageProps={{}} router={{} as any} />);

      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });
  });

  describe('Navigation Sidebar', () => {
    it('should display Dashboard link', () => {
      render(<App Component={TestPage} pageProps={{}} router={{} as any} />);

      expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    });

    it('should display New Invoice link', () => {
      render(<App Component={TestPage} pageProps={{}} router={{} as any} />);

      expect(screen.getByRole('link', { name: /neue rechnung/i })).toBeInTheDocument();
    });

    it('should display Invoices link', () => {
      render(<App Component={TestPage} pageProps={{}} router={{} as any} />);

      expect(screen.getByRole('link', { name: /rechnungen/i })).toBeInTheDocument();
    });

    it('should display Settings link', () => {
      render(<App Component={TestPage} pageProps={{}} router={{} as any} />);

      expect(screen.getByRole('link', { name: /einstellungen/i })).toBeInTheDocument();
    });

    it('should have correct href for Dashboard link', () => {
      render(<App Component={TestPage} pageProps={{}} router={{} as any} />);

      const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
      expect(dashboardLink).toHaveAttribute('href', '/dashboard');
    });

    it('should have correct href for New Invoice link', () => {
      render(<App Component={TestPage} pageProps={{}} router={{} as any} />);

      const newInvoiceLink = screen.getByRole('link', { name: /neue rechnung/i });
      expect(newInvoiceLink).toHaveAttribute('href', '/invoices/new');
    });

    it('should have correct href for Settings link', () => {
      render(<App Component={TestPage} pageProps={{}} router={{} as any} />);

      const settingsLink = screen.getByRole('link', { name: /einstellungen/i });
      expect(settingsLink).toHaveAttribute('href', '/settings');
    });
  });

  describe('Header', () => {
    it('should display app logo area', () => {
      render(<App Component={TestPage} pageProps={{}} router={{} as any} />);

      expect(screen.getByTestId('app-logo')).toBeInTheDocument();
    });

    it('should display dark/light mode toggle', () => {
      render(<App Component={TestPage} pageProps={{}} router={{} as any} />);

      expect(screen.getByRole('button', { name: /modus wechseln/i })).toBeInTheDocument();
    });
  });

  describe('Dark/Light Mode Toggle', () => {
    it('should toggle theme when clicking toggle button', async () => {
      const user = userEvent.setup();
      render(<App Component={TestPage} pageProps={{}} router={{} as any} />);

      const toggleButton = screen.getByRole('button', { name: /modus wechseln/i });

      // Click to switch mode
      await user.click(toggleButton);

      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should display moon icon initially (light mode)', () => {
      render(<App Component={TestPage} pageProps={{}} router={{} as any} />);

      expect(screen.getByTestId('moon-icon')).toBeInTheDocument();
    });

    it('should display sun icon in dark mode', async () => {
      localStorageMock.getItem.mockReturnValue('dark');

      render(<App Component={TestPage} pageProps={{}} router={{} as any} />);

      await waitFor(() => {
        expect(screen.getByTestId('sun-icon')).toBeInTheDocument();
      });
    });
  });

  describe('Layout Structure', () => {
    it('should have main content area', () => {
      render(<App Component={TestPage} pageProps={{}} router={{} as any} />);

      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('should render page content inside main area', () => {
      render(<App Component={TestPage} pageProps={{}} router={{} as any} />);

      const main = screen.getByRole('main');
      expect(main).toContainElement(screen.getByTestId('test-page'));
    });

    it('should have proper ARIA landmarks', () => {
      render(<App Component={TestPage} pageProps={{}} router={{} as any} />);

      expect(screen.getByRole('banner')).toBeInTheDocument(); // header
      expect(screen.getByRole('navigation')).toBeInTheDocument(); // nav
      expect(screen.getByRole('main')).toBeInTheDocument(); // main content
    });
  });

  describe('Responsive Behavior', () => {
    it('should have mobile menu button', () => {
      render(<App Component={TestPage} pageProps={{}} router={{} as any} />);

      const menuButton = screen.getByRole('button', { name: /menue/i });
      expect(menuButton).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have skip to main content link', () => {
      render(<App Component={TestPage} pageProps={{}} router={{} as any} />);

      const skipLink = screen.getByRole('link', { name: /zum inhalt springen/i });
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveAttribute('href', '#main-content');
    });

    it('should have navigation status for screen readers', () => {
      render(<App Component={TestPage} pageProps={{}} router={{} as any} />);

      const statusElement = screen.getByRole('status', { name: /navigation status/i });
      expect(statusElement).toBeInTheDocument();
    });
  });
});
