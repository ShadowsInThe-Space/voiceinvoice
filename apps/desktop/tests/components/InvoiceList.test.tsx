/**
 * Tests for InvoiceList component.
 *
 * Tests the invoice list with filtering and selection.
 *
 * @module tests/components/InvoiceList
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InvoiceList } from '../../src/components/InvoiceList';
import type { Invoice, InvoiceStatus, TaxRate } from '@voiceinvoice/shared-types';

describe('InvoiceList', () => {
  const mockOnSelect = vi.fn();
  const mockOnDelete = vi.fn();

  const mockInvoices: Invoice[] = [
    {
      id: 'inv-1',
      invoiceNumber: 'RE-2024-001',
      customerId: 'cust-1',
      date: new Date('2024-01-15'),
      netAmount: 1000,
      taxRate: 19 as TaxRate,
      taxAmount: 190,
      grossAmount: 1190,
      currency: 'EUR',
      status: 'PAID' as InvoiceStatus,
      description: 'Consulting services',
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-15'),
    },
    {
      id: 'inv-2',
      invoiceNumber: 'RE-2024-002',
      customerId: 'cust-2',
      date: new Date('2024-02-01'),
      netAmount: 500,
      taxRate: 19 as TaxRate,
      taxAmount: 95,
      grossAmount: 595,
      currency: 'EUR',
      status: 'PENDING' as InvoiceStatus,
      description: 'Development work',
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-02-01'),
    },
    {
      id: 'inv-3',
      invoiceNumber: 'RE-2024-003',
      customerId: 'cust-1',
      date: new Date('2024-02-15'),
      netAmount: 2000,
      taxRate: 19 as TaxRate,
      taxAmount: 380,
      grossAmount: 2380,
      currency: 'EUR',
      status: 'DRAFT' as InvoiceStatus,
      description: 'Project management',
      createdAt: new Date('2024-02-15'),
      updatedAt: new Date('2024-02-15'),
    },
    {
      id: 'inv-4',
      invoiceNumber: 'RE-2024-004',
      customerId: 'cust-3',
      date: new Date('2024-01-01'),
      dueDate: new Date('2024-01-15'),
      netAmount: 750,
      taxRate: 7 as TaxRate,
      taxAmount: 52.5,
      grossAmount: 802.5,
      currency: 'EUR',
      status: 'OVERDUE' as InvoiceStatus,
      description: 'Training session',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-20'),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render a list of invoices', () => {
      render(<InvoiceList invoices={mockInvoices} onSelect={mockOnSelect} />);

      expect(screen.getByText('RE-2024-001')).toBeInTheDocument();
      expect(screen.getByText('RE-2024-002')).toBeInTheDocument();
      expect(screen.getByText('RE-2024-003')).toBeInTheDocument();
      expect(screen.getByText('RE-2024-004')).toBeInTheDocument();
    });

    it('should display invoice amounts', () => {
      render(<InvoiceList invoices={mockInvoices} onSelect={mockOnSelect} />);

      // Should display gross amounts formatted
      expect(screen.getByText(/1[.,]190/)).toBeInTheDocument(); // EUR formatting
      expect(screen.getByText(/595/)).toBeInTheDocument();
    });

    it('should display invoice status with appropriate styling', () => {
      render(<InvoiceList invoices={mockInvoices} onSelect={mockOnSelect} />);

      const paidStatus = screen.getByTestId('status-inv-1');
      const pendingStatus = screen.getByTestId('status-inv-2');
      const overdueStatus = screen.getByTestId('status-inv-4');

      expect(paidStatus).toHaveTextContent(/bezahlt|paid/i);
      expect(pendingStatus).toHaveTextContent(/offen|pending/i);
      expect(overdueStatus).toHaveTextContent(/ueberfaellig|overdue|Überfällig/i);
    });

    it('should display formatted dates', () => {
      render(<InvoiceList invoices={mockInvoices} onSelect={mockOnSelect} />);

      // German date format DD.MM.YYYY
      expect(screen.getByText(/15\.01\.2024|15\/01\/2024|Jan.*15/i)).toBeInTheDocument();
    });

    it('should show empty state when no invoices', () => {
      render(<InvoiceList invoices={[]} onSelect={mockOnSelect} />);

      expect(screen.getByText(/keine rechnungen|no invoices/i)).toBeInTheDocument();
    });
  });

  describe('filtering', () => {
    it('should render filter controls', () => {
      render(<InvoiceList invoices={mockInvoices} onSelect={mockOnSelect} />);

      expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
    });

    it('should filter by status', async () => {
      const user = userEvent.setup();
      render(<InvoiceList invoices={mockInvoices} onSelect={mockOnSelect} />);

      const statusFilter = screen.getByLabelText(/status/i);
      await user.selectOptions(statusFilter, 'PAID');

      await waitFor(() => {
        expect(screen.getByText('RE-2024-001')).toBeInTheDocument();
        expect(screen.queryByText('RE-2024-002')).not.toBeInTheDocument();
        expect(screen.queryByText('RE-2024-003')).not.toBeInTheDocument();
      });
    });

    it('should show all invoices when filter is cleared', async () => {
      const user = userEvent.setup();
      render(<InvoiceList invoices={mockInvoices} onSelect={mockOnSelect} />);

      const statusFilter = screen.getByLabelText(/status/i);

      // Filter first
      await user.selectOptions(statusFilter, 'PAID');

      // Then clear
      await user.selectOptions(statusFilter, '');

      await waitFor(() => {
        expect(screen.getByText('RE-2024-001')).toBeInTheDocument();
        expect(screen.getByText('RE-2024-002')).toBeInTheDocument();
        expect(screen.getByText('RE-2024-003')).toBeInTheDocument();
      });
    });

    it('should have search input for text filtering', () => {
      render(<InvoiceList invoices={mockInvoices} onSelect={mockOnSelect} />);

      expect(screen.getByPlaceholderText(/suchen|search/i)).toBeInTheDocument();
    });

    it('should filter by invoice number when searching', async () => {
      const user = userEvent.setup();
      render(<InvoiceList invoices={mockInvoices} onSelect={mockOnSelect} />);

      const searchInput = screen.getByPlaceholderText(/suchen|search/i);
      await user.type(searchInput, '003');

      await waitFor(() => {
        expect(screen.queryByText('RE-2024-001')).not.toBeInTheDocument();
        expect(screen.getByText('RE-2024-003')).toBeInTheDocument();
      });
    });

    it('should filter by description when searching', async () => {
      const user = userEvent.setup();
      render(<InvoiceList invoices={mockInvoices} onSelect={mockOnSelect} />);

      const searchInput = screen.getByPlaceholderText(/suchen|search/i);
      await user.type(searchInput, 'Development');

      await waitFor(() => {
        expect(screen.queryByText('RE-2024-001')).not.toBeInTheDocument();
        expect(screen.getByText('RE-2024-002')).toBeInTheDocument();
      });
    });
  });

  describe('selection', () => {
    it('should call onSelect when invoice is clicked', async () => {
      const user = userEvent.setup();
      render(<InvoiceList invoices={mockInvoices} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('RE-2024-002'));

      expect(mockOnSelect).toHaveBeenCalledWith(mockInvoices[1]);
    });

    it('should highlight selected invoice row', async () => {
      const user = userEvent.setup();
      render(<InvoiceList invoices={mockInvoices} onSelect={mockOnSelect} />);

      const row = screen.getByTestId('invoice-row-inv-2');
      await user.click(row);

      // Check for visual indicator of selection (border-l-primary)
      expect(row).toHaveClass('border-l-primary');
    });
  });

  describe('deletion', () => {
    it('should render delete button when onDelete is provided', () => {
      render(
        <InvoiceList
          invoices={mockInvoices}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      const deleteButtons = screen.getAllByRole('button', { name: /loeschen|delete/i });
      expect(deleteButtons).toHaveLength(mockInvoices.length);
    });

    it('should not render delete button when onDelete is not provided', () => {
      render(<InvoiceList invoices={mockInvoices} onSelect={mockOnSelect} />);

      expect(screen.queryByRole('button', { name: /loeschen|delete/i })).not.toBeInTheDocument();
    });

    it('should call onDelete with invoice id when delete is clicked', async () => {
      const user = userEvent.setup();
      render(
        <InvoiceList
          invoices={mockInvoices}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      const row = screen.getByTestId('invoice-row-inv-2');
      const deleteButton = within(row).getByRole('button', { name: /loeschen|delete/i });

      await user.click(deleteButton);

      // Confirmation dialog should appear - confirm deletion
      const confirmButton = screen.getByTestId('confirm-delete-button');
      await user.click(confirmButton);

      expect(mockOnDelete).toHaveBeenCalledWith('inv-2');
    });

    it('should show confirmation before deletion', async () => {
      const user = userEvent.setup();
      render(
        <InvoiceList
          invoices={mockInvoices}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      const row = screen.getByTestId('invoice-row-inv-2');
      const deleteButton = within(row).getByRole('button', { name: /loeschen|delete/i });

      await user.click(deleteButton);

      // Should show confirmation dialog - target the actual button
      expect(screen.getByRole('button', { name: /endgültig löschen|confirm/i })).toBeInTheDocument();
    });

    it('should not call onDelete if confirmation is cancelled', async () => {
      const user = userEvent.setup();
      render(
        <InvoiceList
          invoices={mockInvoices}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      const row = screen.getByTestId('invoice-row-inv-2');
      const deleteButton = within(row).getByRole('button', { name: /loeschen|delete/i });

      await user.click(deleteButton);

      // Cancel confirmation
      const cancelButton = screen.getByRole('button', { name: /abbrechen|cancel/i });
      await user.click(cancelButton);

      expect(mockOnDelete).not.toHaveBeenCalled();
    });

    it('should not trigger onSelect when clicking delete button', async () => {
      const user = userEvent.setup();
      render(
        <InvoiceList
          invoices={mockInvoices}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      const row = screen.getByTestId('invoice-row-inv-2');
      const deleteButton = within(row).getByRole('button', { name: /loeschen|delete/i });

      await user.click(deleteButton);

      expect(mockOnSelect).not.toHaveBeenCalled();
    });
  });

  describe('sorting', () => {
    it('should sort by date by default (newest first)', () => {
      render(<InvoiceList invoices={mockInvoices} onSelect={mockOnSelect} />);

      const rows = screen.getAllByTestId(/invoice-row/);

      // Check order: newest first
      expect(within(rows[0]).getByText('RE-2024-003')).toBeInTheDocument();
      expect(within(rows[1]).getByText('RE-2024-002')).toBeInTheDocument();
    });

    it('should allow sorting by amount', async () => {
      const user = userEvent.setup();
      render(<InvoiceList invoices={mockInvoices} onSelect={mockOnSelect} />);

      const sortSelect = screen.getByLabelText(/sortierung|sort/i);
      await user.selectOptions(sortSelect, 'amount');

      const rows = screen.getAllByTestId(/invoice-row/);

      // Highest amount first
      expect(within(rows[0]).getByText('RE-2024-003')).toBeInTheDocument(); // 2380
    });

    it('should allow sorting by invoice number', async () => {
      const user = userEvent.setup();
      render(<InvoiceList invoices={mockInvoices} onSelect={mockOnSelect} />);

      const sortSelect = screen.getByLabelText(/sortierung|sort/i);
      await user.selectOptions(sortSelect, 'invoiceNumber');

      const rows = screen.getAllByTestId(/invoice-row/);

      // Alphabetical order
      expect(within(rows[0]).getByText('RE-2024-001')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should use table or list semantics', () => {
      render(<InvoiceList invoices={mockInvoices} onSelect={mockOnSelect} />);

      // Either table or list is acceptable
      const table = screen.queryByRole('table');
      const list = screen.queryByRole('list');

      expect(table || list).toBeInTheDocument();
    });

    it('should have column headers if using table', () => {
      render(<InvoiceList invoices={mockInvoices} onSelect={mockOnSelect} />);

      const table = screen.queryByRole('table');
      if (table) {
        expect(screen.getByRole('columnheader', { name: /dokument|document|nummer|number/i })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: /bruttobetrag|amount|betrag/i })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: /status/i })).toBeInTheDocument();
      }
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      render(<InvoiceList invoices={mockInvoices} onSelect={mockOnSelect} />);

      const firstRow = screen.getByTestId('invoice-row-inv-3'); // First by date
      firstRow.focus();

      await user.keyboard('{Enter}');

      expect(mockOnSelect).toHaveBeenCalled();
    });
  });

  describe('summary', () => {
    it('should display total count of invoices', () => {
      render(<InvoiceList invoices={mockInvoices} onSelect={mockOnSelect} />);

      expect(screen.getByText(/4 dokumente|4 documents|4 rechnungen|4 invoices/i)).toBeInTheDocument();
    });

    it('should update count when filtered', async () => {
      const user = userEvent.setup();
      render(<InvoiceList invoices={mockInvoices} onSelect={mockOnSelect} />);

      const statusFilter = screen.getByLabelText(/status/i);
      await user.selectOptions(statusFilter, 'PAID');

      await waitFor(() => {
        expect(screen.getByText(/1 dokument|1 document|1 rechnung|1 invoice/i)).toBeInTheDocument();
      });
    });
  });
});
