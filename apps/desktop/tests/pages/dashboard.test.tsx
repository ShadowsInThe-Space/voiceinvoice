/**
 * Dashboard Page Tests
 *
 * TDD tests for the Dashboard page component.
 * Tests analytics display, recent invoices, and quick actions.
 *
 * @module tests/pages/dashboard.test
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
    pathname: '/dashboard',
  })),
}));

// Import after mocks are set up
import DashboardPage from '../../src/pages/dashboard';

describe('Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render the dashboard title', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
      });
    });

    it('should show content after loading', async () => {
      render(<DashboardPage />);

      // Wait for content to be loaded
      await waitFor(() => {
        expect(screen.getByText(/umsatz/i)).toBeInTheDocument();
      });
    });
  });

  describe('Analytics Display', () => {
    it('should display total revenue', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/umsatz/i)).toBeInTheDocument();
      });

      expect(screen.getByTestId('total-revenue')).toBeInTheDocument();
    });

    it('should display customer count', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/kunden/i)).toBeInTheDocument();
      });

      expect(screen.getByTestId('active-customers')).toBeInTheDocument();
    });

    it('should display invoice statistics', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        // Check for the stat card with "Rechnungen" title
        expect(screen.getByTestId('total-invoices')).toBeInTheDocument();
      });
    });

    it('should display trend indicator', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId('trend-indicator')).toBeInTheDocument();
      });
    });
  });

  describe('Recent Invoices', () => {
    it('should display recent invoices section', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/letzte rechnungen/i)).toBeInTheDocument();
      });
    });

    it('should display invoice numbers', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('RE-2025-001')).toBeInTheDocument();
        expect(screen.getByText('RE-2025-002')).toBeInTheDocument();
      });
    });

    it('should display invoice status badges', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        // Status badges with exact text
        expect(screen.getByText('Bezahlt')).toBeInTheDocument();
        expect(screen.getByText('Offen')).toBeInTheDocument();
      });
    });
  });

  describe('Quick Actions', () => {
    it('should display quick action buttons', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /neue rechnung/i })).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /exportieren/i })).toBeInTheDocument();
    });

    it('should navigate to new invoice page when clicking new invoice button', async () => {
      const user = userEvent.setup();

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /neue rechnung/i })).toBeInTheDocument();
      });

      const newInvoiceButton = screen.getByRole('button', { name: /neue rechnung/i });
      await user.click(newInvoiceButton);

      expect(mockPush).toHaveBeenCalledWith('/invoices/new');
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        const h1 = screen.getByRole('heading', { level: 1 });
        expect(h1).toBeInTheDocument();
      });

      const h2Elements = screen.getAllByRole('heading', { level: 2 });
      expect(h2Elements.length).toBeGreaterThan(0);
    });

    it('should have accessible stat cards', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        const statCards = screen.getAllByRole('region');
        expect(statCards.length).toBeGreaterThan(0);
      });
    });
  });
});
