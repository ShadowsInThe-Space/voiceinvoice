/**
 * Tests for CustomerSelect component.
 *
 * Tests the customer selection dropdown with search functionality.
 *
 * @module tests/components/CustomerSelect
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomerSelect } from '../../src/components/CustomerSelect';
import type { Customer, CustomerType } from '@voiceinvoice/shared-types';

describe('CustomerSelect', () => {
  const mockOnChange = vi.fn();

  const mockCustomers: Customer[] = [
    {
      id: 'cust-1',
      type: 'CUSTOMER' as CustomerType,
      companyName: 'Acme GmbH',
      contactPerson: 'Max Mustermann',
      email: 'kontakt@acme.de',
      country: 'DE',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'cust-2',
      type: 'CUSTOMER' as CustomerType,
      companyName: 'Tech Solutions AG',
      contactPerson: 'Lisa Mueller',
      email: 'info@techsolutions.de',
      country: 'DE',
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
    },
    {
      id: 'cust-3',
      type: 'SUPPLIER' as CustomerType,
      companyName: 'Supply Corp',
      contactPerson: 'Hans Schmidt',
      email: 'orders@supply.de',
      country: 'DE',
      createdAt: new Date('2024-01-03'),
      updatedAt: new Date('2024-01-03'),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render a combobox/select element', () => {
      render(<CustomerSelect onChange={mockOnChange} customers={mockCustomers} />);

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should render search input for filtering', async () => {
      const user = userEvent.setup();
      render(<CustomerSelect onChange={mockOnChange} customers={mockCustomers} />);

      // Search input is only visible when dropdown is open
      await user.click(screen.getByRole('combobox'));

      // Wait for animation/render
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/suchen|search/i)).toBeInTheDocument();
      });
    });

    it('should display all customers initially', async () => {
      const user = userEvent.setup();
      render(<CustomerSelect onChange={mockOnChange} customers={mockCustomers} />);

      // Click to open dropdown
      await user.click(screen.getByRole('combobox'));

      await waitFor(() => {
        expect(screen.getByText('Acme GmbH')).toBeInTheDocument();
        expect(screen.getByText('Tech Solutions AG')).toBeInTheDocument();
        expect(screen.getByText('Supply Corp')).toBeInTheDocument();
      });
    });

    it('should show selected customer when value is provided', () => {
      render(
        <CustomerSelect
          value="cust-1"
          onChange={mockOnChange}
          customers={mockCustomers}
        />
      );

      expect(screen.getByText('Acme GmbH')).toBeInTheDocument();
    });

    it('should show placeholder when no value selected', () => {
      render(<CustomerSelect onChange={mockOnChange} customers={mockCustomers} />);

      expect(screen.getByText(/kunde auswählen|select customer/i)).toBeInTheDocument();
    });
  });

  describe('search functionality', () => {
    it('should filter customers by company name', async () => {
      const user = userEvent.setup();
      render(<CustomerSelect onChange={mockOnChange} customers={mockCustomers} />);

      // Click to open and type in search
      await user.click(screen.getByRole('combobox'));
      await user.type(screen.getByPlaceholderText(/suchen|search/i), 'acme');

      await waitFor(() => {
        expect(screen.getByText('Acme GmbH')).toBeInTheDocument();
        expect(screen.queryByText('Tech Solutions AG')).not.toBeInTheDocument();
        expect(screen.queryByText('Supply Corp')).not.toBeInTheDocument();
      });
    });

    it('should filter customers by contact person', async () => {
      const user = userEvent.setup();
      render(<CustomerSelect onChange={mockOnChange} customers={mockCustomers} />);

      await user.click(screen.getByRole('combobox'));
      await user.type(screen.getByPlaceholderText(/suchen|search/i), 'Mueller');

      await waitFor(() => {
        expect(screen.queryByText('Acme GmbH')).not.toBeInTheDocument();
        expect(screen.getByText('Tech Solutions AG')).toBeInTheDocument();
      });
    });

    it('should be case-insensitive', async () => {
      const user = userEvent.setup();
      render(<CustomerSelect onChange={mockOnChange} customers={mockCustomers} />);

      await user.click(screen.getByRole('combobox'));
      await user.type(screen.getByPlaceholderText(/suchen|search/i), 'TECH');

      await waitFor(() => {
        expect(screen.getByText('Tech Solutions AG')).toBeInTheDocument();
      });
    });

    it('should show no results message when search has no matches', async () => {
      const user = userEvent.setup();
      render(<CustomerSelect onChange={mockOnChange} customers={mockCustomers} />);

      await user.click(screen.getByRole('combobox'));
      await user.type(screen.getByPlaceholderText(/suchen|search/i), 'nonexistent');

      await waitFor(() => {
        expect(screen.getByText(/keine.*gefunden|no.*found/i)).toBeInTheDocument();
      });
    });

    it('should clear search when selecting a customer', async () => {
      const user = userEvent.setup();
      render(<CustomerSelect onChange={mockOnChange} customers={mockCustomers} />);

      await user.click(screen.getByRole('combobox'));
      await user.type(screen.getByPlaceholderText(/suchen|search/i), 'acme');
      await user.click(screen.getByText('Acme GmbH'));

      // After selecting, dropdown closes - reopen to verify search was cleared
      await user.click(screen.getByRole('combobox'));
      const searchInput = screen.getByPlaceholderText(/suchen|search/i);
      expect(searchInput).toHaveValue('');
    });
  });

  describe('selection', () => {
    it('should call onChange with customer id when selected', async () => {
      const user = userEvent.setup();
      render(<CustomerSelect onChange={mockOnChange} customers={mockCustomers} />);

      await user.click(screen.getByRole('combobox'));
      await user.click(screen.getByText('Tech Solutions AG'));

      expect(mockOnChange).toHaveBeenCalledWith('cust-2');
    });

    it('should update displayed value after selection', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <CustomerSelect onChange={mockOnChange} customers={mockCustomers} />
      );

      await user.click(screen.getByRole('combobox'));
      await user.click(screen.getByText('Tech Solutions AG'));

      // Simulate parent component updating value prop
      rerender(
        <CustomerSelect
          value="cust-2"
          onChange={mockOnChange}
          customers={mockCustomers}
        />
      );

      expect(screen.getByText('Tech Solutions AG')).toBeInTheDocument();
    });

    it('should allow selecting a different customer', async () => {
      const user = userEvent.setup();
      render(
        <CustomerSelect
          value="cust-1"
          onChange={mockOnChange}
          customers={mockCustomers}
        />
      );

      await user.click(screen.getByRole('combobox'));
      await user.click(screen.getByText('Supply Corp'));

      expect(mockOnChange).toHaveBeenCalledWith('cust-3');
    });
  });

  describe('empty state', () => {
    it('should show empty message when no customers available', () => {
      render(<CustomerSelect onChange={mockOnChange} customers={[]} />);

      expect(screen.getByText(/keine kunden|no customers/i)).toBeInTheDocument();
    });
  });

  describe('customer display', () => {
    it('should display contact person if available', async () => {
      const user = userEvent.setup();
      render(<CustomerSelect onChange={mockOnChange} customers={mockCustomers} />);

      await user.click(screen.getByRole('combobox'));

      await waitFor(() => {
        expect(screen.getByText(/Max Mustermann/)).toBeInTheDocument();
      });
    });

    it('should indicate customer type', async () => {
      const user = userEvent.setup();
      render(<CustomerSelect onChange={mockOnChange} customers={mockCustomers} />);

      await user.click(screen.getByRole('combobox'));

      await waitFor(() => {
        // Should have visual indicator for supplier vs customer
        expect(screen.getByTestId('customer-type-cust-3')).toHaveTextContent(/lieferant|supplier/i);
      });
    });
  });

  describe('accessibility', () => {
    it('should have proper aria-label', () => {
      render(<CustomerSelect onChange={mockOnChange} customers={mockCustomers} />);

      const combobox = screen.getByRole('combobox');
      expect(combobox).toHaveAttribute('aria-label', expect.stringMatching(/kunde|customer/i));
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<CustomerSelect onChange={mockOnChange} customers={mockCustomers} />);

      const combobox = screen.getByRole('combobox');

      // Focus and open with Enter
      combobox.focus();
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Acme GmbH')).toBeInTheDocument();
      });

      // Navigate with arrow keys
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should close dropdown on Escape', async () => {
      const user = userEvent.setup();
      render(<CustomerSelect onChange={mockOnChange} customers={mockCustomers} />);

      await user.click(screen.getByRole('combobox'));

      await waitFor(() => {
        expect(screen.getByText('Acme GmbH')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByText('Tech Solutions AG')).not.toBeInTheDocument();
      });
    });
  });
});
