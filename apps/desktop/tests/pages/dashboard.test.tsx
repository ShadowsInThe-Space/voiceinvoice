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
        expect(screen.getByText(/gesamtumsatz|umsatz/i)).toBeInTheDocument();
      });
    });
  });

  describe('Analytics Display', () => {
    it('should display total revenue', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/gesamtumsatz|umsatz/i)).toBeInTheDocument();
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
        expect(screen.getByText(/letzte transaktionen|letzte rechnungen/i)).toBeInTheDocument();
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
        expect(
          screen.getByRole('button', { name: /neue rechnung|erstellen/i })
        ).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /exportieren/i })).toBeInTheDocument();
    });

    it('should navigate to new invoice page when clicking new invoice button', async () => {
      const user = userEvent.setup();

      render(<DashboardPage />);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /neue rechnung|erstellen/i })
        ).toBeInTheDocument();
      });

      const newInvoiceButton = screen.getByRole('button', { name: /neue rechnung|erstellen/i });
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

  describe('Export Functionality', () => {
    let createObjectURLMock: ReturnType<typeof vi.fn>;
    let revokeObjectURLMock: ReturnType<typeof vi.fn>;
    let mockAnchor: {
      href: string;
      download: string;
      click: ReturnType<typeof vi.fn>;
      style: Record<string, string>;
    };
    const originalCreateElement = document.createElement.bind(document);

    beforeEach(() => {
      // Mock URL.createObjectURL and URL.revokeObjectURL
      createObjectURLMock = vi.fn(() => 'blob:mock-url');
      revokeObjectURLMock = vi.fn();
      global.URL.createObjectURL = createObjectURLMock;
      global.URL.revokeObjectURL = revokeObjectURLMock;

      // Create mock anchor element
      mockAnchor = {
        href: '',
        download: '',
        click: vi.fn(),
        style: {},
      };

      // Mock createElement only for anchor elements
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          return mockAnchor as unknown as HTMLAnchorElement;
        }
        return originalCreateElement(tagName);
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should display export dropdown with CSV and JSON options when clicking export button', async () => {
      const user = userEvent.setup();
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /exportieren/i })).toBeInTheDocument();
      });

      const exportButton = screen.getByRole('button', { name: /exportieren/i });
      await user.click(exportButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /csv/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /json/i })).toBeInTheDocument();
      });
    });

    it('should export invoices as CSV when clicking CSV option', async () => {
      const user = userEvent.setup();
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /exportieren/i })).toBeInTheDocument();
      });

      // Open export dropdown
      const exportButton = screen.getByRole('button', { name: /exportieren/i });
      await user.click(exportButton);

      // Click CSV option
      const csvButton = await screen.findByRole('button', { name: /csv/i });
      await user.click(csvButton);

      // Verify Blob was created with CSV content
      expect(createObjectURLMock).toHaveBeenCalled();
      const blobCall = createObjectURLMock.mock.calls[0][0];
      expect(blobCall).toBeInstanceOf(Blob);
      expect(blobCall.type).toBe('text/csv;charset=utf-8;');

      // Verify download was triggered
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');
    });

    it('should export invoices as JSON when clicking JSON option', async () => {
      const user = userEvent.setup();
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /exportieren/i })).toBeInTheDocument();
      });

      // Open export dropdown
      const exportButton = screen.getByRole('button', { name: /exportieren/i });
      await user.click(exportButton);

      // Click JSON option
      const jsonButton = await screen.findByRole('button', { name: /json/i });
      await user.click(jsonButton);

      // Verify Blob was created with JSON content
      expect(createObjectURLMock).toHaveBeenCalled();
      const blobCall = createObjectURLMock.mock.calls[0][0];
      expect(blobCall).toBeInstanceOf(Blob);
      expect(blobCall.type).toBe('application/json');

      // Verify download was triggered
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');
    });

    it('should include correct invoice data in CSV export', async () => {
      const user = userEvent.setup();
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /exportieren/i })).toBeInTheDocument();
      });

      // Open export dropdown and click CSV
      const exportButton = screen.getByRole('button', { name: /exportieren/i });
      await user.click(exportButton);
      const csvButton = await screen.findByRole('button', { name: /csv/i });
      await user.click(csvButton);

      // Get the Blob content - use FileReader to read the Blob
      const blobCall = createObjectURLMock.mock.calls[0][0] as Blob;
      const csvContent = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(blobCall);
      });

      // Check CSV headers
      expect(csvContent).toContain('Rechnungsnummer');
      expect(csvContent).toContain('Kunde');
      expect(csvContent).toContain('Datum');
      expect(csvContent).toContain('Betrag');
      expect(csvContent).toContain('Status');

      // Check invoice data
      expect(csvContent).toContain('RE-2025-001');
      expect(csvContent).toContain('Kunde A');
      expect(csvContent).toContain('RE-2025-002');
      expect(csvContent).toContain('Kunde B');
    });

    it('should include correct invoice data in JSON export', async () => {
      const user = userEvent.setup();
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /exportieren/i })).toBeInTheDocument();
      });

      // Open export dropdown and click JSON
      const exportButton = screen.getByRole('button', { name: /exportieren/i });
      await user.click(exportButton);
      const jsonButton = await screen.findByRole('button', { name: /json/i });
      await user.click(jsonButton);

      // Get the Blob content - use FileReader to read the Blob
      const blobCall = createObjectURLMock.mock.calls[0][0] as Blob;
      const jsonContent = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(blobCall);
      });
      const parsedData = JSON.parse(jsonContent);

      // Check JSON structure
      expect(parsedData).toHaveProperty('invoices');
      expect(parsedData).toHaveProperty('exportedAt');
      expect(Array.isArray(parsedData.invoices)).toBe(true);

      // Check invoice data
      expect(parsedData.invoices).toHaveLength(2);
      expect(parsedData.invoices[0]).toHaveProperty('number', 'RE-2025-001');
      expect(parsedData.invoices[0]).toHaveProperty('customerName', 'Kunde A');
      expect(parsedData.invoices[1]).toHaveProperty('number', 'RE-2025-002');
      expect(parsedData.invoices[1]).toHaveProperty('customerName', 'Kunde B');
    });

    it('should close export dropdown after selecting an option', async () => {
      const user = userEvent.setup();
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /exportieren/i })).toBeInTheDocument();
      });

      // Open export dropdown
      const exportButton = screen.getByRole('button', { name: /exportieren/i });
      await user.click(exportButton);

      // Verify dropdown is open
      const csvButton = await screen.findByRole('button', { name: /csv/i });
      expect(csvButton).toBeInTheDocument();

      // Click CSV option
      await user.click(csvButton);

      // Verify dropdown is closed
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /csv/i })).not.toBeInTheDocument();
      });
    });

    it('should close export dropdown when clicking outside', async () => {
      const user = userEvent.setup();
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /exportieren/i })).toBeInTheDocument();
      });

      // Open export dropdown
      const exportButton = screen.getByRole('button', { name: /exportieren/i });
      await user.click(exportButton);

      // Verify dropdown is open
      const csvButton = await screen.findByRole('button', { name: /csv/i });
      expect(csvButton).toBeInTheDocument();

      // Click outside (on the document body / main heading)
      const heading = screen.getByRole('heading', { name: /dashboard/i });
      await user.click(heading);

      // Verify dropdown is closed
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /csv/i })).not.toBeInTheDocument();
      });
    });
  });
});
