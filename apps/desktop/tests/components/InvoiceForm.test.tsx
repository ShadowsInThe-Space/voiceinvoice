/**
 * Tests for InvoiceForm component.
 *
 * Tests the invoice creation and editing form with validation.
 *
 * @module tests/components/InvoiceForm
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InvoiceForm } from '../../src/components/InvoiceForm';
import type { Invoice, InvoiceStatus, TaxRate } from '@voiceinvoice/shared-types';

describe('InvoiceForm', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  const mockInvoice: Partial<Invoice> = {
    id: 'inv-123',
    invoiceNumber: 'RE-2024-001',
    customerId: 'cust-456',
    date: new Date('2024-01-15'),
    netAmount: 1000,
    taxRate: 19 as TaxRate,
    taxAmount: 190,
    grossAmount: 1190,
    currency: 'EUR',
    status: 'DRAFT' as InvoiceStatus,
    description: 'Consulting services',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render all required form fields', () => {
      render(<InvoiceForm onSubmit={mockOnSubmit} />);

      // Invoice number
      expect(screen.getByLabelText(/rechnungsnummer|invoice number/i)).toBeInTheDocument();

      // Date - be specific to avoid matching both date fields
      expect(screen.getByLabelText(/^datum$/i)).toBeInTheDocument();

      // Net amount
      expect(screen.getByLabelText(/nettobetrag|net amount/i)).toBeInTheDocument();

      // Tax rate
      expect(screen.getByLabelText(/steuersatz|tax rate/i)).toBeInTheDocument();

      // Description
      expect(screen.getByLabelText(/beschreibung|description/i)).toBeInTheDocument();
    });

    it('should render submit and cancel buttons', () => {
      render(<InvoiceForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      expect(screen.getByRole('button', { name: /speichern|save|submit/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /abbrechen|cancel/i })).toBeInTheDocument();
    });

    it('should not render cancel button when onCancel is not provided', () => {
      render(<InvoiceForm onSubmit={mockOnSubmit} />);

      expect(screen.queryByRole('button', { name: /abbrechen|cancel/i })).not.toBeInTheDocument();
    });
  });

  describe('editing mode', () => {
    it('should populate form fields with existing invoice data', () => {
      render(<InvoiceForm invoice={mockInvoice} onSubmit={mockOnSubmit} />);

      expect(screen.getByLabelText(/rechnungsnummer|invoice number/i)).toHaveValue('RE-2024-001');
      expect(screen.getByLabelText(/nettobetrag|net amount/i)).toHaveValue(1000);
      expect(screen.getByLabelText(/beschreibung|description/i)).toHaveValue('Consulting services');
    });

    it('should show correct tax rate when editing', () => {
      render(<InvoiceForm invoice={mockInvoice} onSubmit={mockOnSubmit} />);

      const taxRateSelect = screen.getByLabelText(/steuersatz|tax rate/i);
      expect(taxRateSelect).toHaveValue('19');
    });
  });

  describe('form submission', () => {
    it('should call onSubmit with form data when submitted', async () => {
      const user = userEvent.setup();
      render(<InvoiceForm onSubmit={mockOnSubmit} />);

      // Fill in required fields
      await user.type(screen.getByLabelText(/rechnungsnummer|invoice number/i), 'RE-2024-002');
      await user.type(screen.getByLabelText(/nettobetrag|net amount/i), '500');
      await user.type(screen.getByLabelText(/beschreibung|description/i), 'Test invoice');

      // Submit form
      await user.click(screen.getByRole('button', { name: /speichern|save|submit/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            invoiceNumber: 'RE-2024-002',
            netAmount: 500,
            description: 'Test invoice',
          })
        );
      });
    });

    it('should calculate tax and gross amount automatically', async () => {
      const user = userEvent.setup();
      render(<InvoiceForm onSubmit={mockOnSubmit} />);

      // Set net amount and tax rate
      await user.type(screen.getByLabelText(/nettobetrag|net amount/i), '100');

      // Should display calculated amounts
      await waitFor(() => {
        expect(screen.getByTestId('tax-amount')).toHaveTextContent(/19/); // 19% of 100
        expect(screen.getByTestId('gross-amount')).toHaveTextContent(/119/); // 100 + 19
      });
    });

    it('should update calculations when tax rate changes', async () => {
      const user = userEvent.setup();
      render(<InvoiceForm onSubmit={mockOnSubmit} />);

      // Set net amount
      await user.type(screen.getByLabelText(/nettobetrag|net amount/i), '100');

      // Change tax rate to 7%
      await user.selectOptions(screen.getByLabelText(/steuersatz|tax rate/i), '7');

      await waitFor(() => {
        expect(screen.getByTestId('tax-amount')).toHaveTextContent(/7/);
        expect(screen.getByTestId('gross-amount')).toHaveTextContent(/107/);
      });
    });
  });

  describe('validation', () => {
    it('should show error for empty invoice number', async () => {
      const user = userEvent.setup();
      render(<InvoiceForm onSubmit={mockOnSubmit} />);

      // Try to submit without filling invoice number
      await user.click(screen.getByRole('button', { name: /speichern|save|submit/i }));

      await waitFor(() => {
        expect(screen.getByText(/rechnungsnummer.*erforderlich|invoice number.*required/i)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should show error for invalid net amount', async () => {
      const user = userEvent.setup();
      render(<InvoiceForm onSubmit={mockOnSubmit} />);

      await user.type(screen.getByLabelText(/rechnungsnummer|invoice number/i), 'RE-001');
      await user.type(screen.getByLabelText(/nettobetrag|net amount/i), '-50');

      await user.click(screen.getByRole('button', { name: /speichern|save|submit/i }));

      await waitFor(() => {
        expect(screen.getByText(/betrag.*positiv|amount.*positive/i)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should show error for net amount of zero', async () => {
      const user = userEvent.setup();
      render(<InvoiceForm onSubmit={mockOnSubmit} />);

      await user.type(screen.getByLabelText(/rechnungsnummer|invoice number/i), 'RE-001');
      await user.type(screen.getByLabelText(/nettobetrag|net amount/i), '0');

      await user.click(screen.getByRole('button', { name: /speichern|save|submit/i }));

      await waitFor(() => {
        expect(screen.getByText(/betrag.*groesser|amount.*greater/i)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('cancel action', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<InvoiceForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      await user.click(screen.getByRole('button', { name: /abbrechen|cancel/i }));

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('status selection', () => {
    it('should allow selecting invoice status', async () => {
      const user = userEvent.setup();
      render(<InvoiceForm invoice={mockInvoice} onSubmit={mockOnSubmit} />);

      const statusSelect = screen.getByLabelText(/status/i);
      await user.selectOptions(statusSelect, 'PENDING');

      await user.click(screen.getByRole('button', { name: /speichern|save|submit/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'PENDING',
          })
        );
      });
    });
  });

  describe('accessibility', () => {
    it('should have proper form structure', () => {
      render(<InvoiceForm onSubmit={mockOnSubmit} />);

      const form = screen.getByRole('form');
      expect(form).toBeInTheDocument();
    });

    it('should have labels associated with inputs', () => {
      render(<InvoiceForm onSubmit={mockOnSubmit} />);

      const invoiceNumberInput = screen.getByLabelText(/rechnungsnummer|invoice number/i);
      expect(invoiceNumberInput).toHaveAttribute('id');

      const label = document.querySelector(`label[for="${invoiceNumberInput.id}"]`);
      expect(label).toBeInTheDocument();
    });
  });
});
