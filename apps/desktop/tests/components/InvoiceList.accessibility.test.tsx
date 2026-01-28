import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InvoiceList } from '../../src/components/InvoiceList';
import { Invoice, InvoiceStatus } from '@voiceinvoice/shared-types';
import { vi, describe, it, expect } from 'vitest';

const mockInvoices: Invoice[] = [
  {
    id: '1',
    invoiceNumber: 'INV-001',
    customerId: 'cust1',
    date: new Date('2023-01-01'),
    dueDate: new Date('2023-01-15'),
    netAmount: 100,
    taxRate: 19,
    taxAmount: 19,
    grossAmount: 119,
    currency: 'EUR',
    status: 'PENDING' as InvoiceStatus,
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe('InvoiceList Accessibility', () => {
  it('should have accessible delete dialog', async () => {
    const onSelect = vi.fn();
    const onDelete = vi.fn();

    render(
      <InvoiceList
        invoices={mockInvoices}
        onSelect={onSelect}
        onDelete={onDelete}
      />
    );

    // Open delete dialog
    const deleteButton = screen.getByTitle('Rechnung löschen');
    fireEvent.click(deleteButton);

    // Check for dialog role
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'delete-dialog-title');
    expect(dialog).toHaveAttribute('aria-describedby', 'delete-dialog-desc');

    // Check for initial focus on Cancel button
    const cancelButton = screen.getByText('Abbrechen');
    await waitFor(() => {
        expect(cancelButton).toHaveFocus();
    });

    // Check Escape key closes dialog
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
        expect(dialog).not.toBeInTheDocument();
    });
  });
});
