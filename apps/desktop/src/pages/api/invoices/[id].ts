/**
 * Get Invoice by ID API Route
 *
 * Retrieves a single invoice from SQLite database by ID.
 *
 * @module api/invoices/[id]
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate: string | null;
  netAmount: number;
  taxRate: number;
  taxAmount: number;
  grossAmount: number;
  currency: string;
  status: string;
  description: string;
  customerId: string;
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    category: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface InvoiceDetailResponse {
  success: boolean;
  invoice?: InvoiceDetail;
  error?: string;
}

/**
 *
 * @param req
 * @param res
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<InvoiceDetailResponse>
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, error: 'Invalid invoice ID' });
      return;
    }

    console.log('[Get Invoice API] Fetching invoice:', id);

    // Fetch invoice with customer and items
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        items: true,
      },
    });

    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    console.log('[Get Invoice API] Found invoice:', invoice.number);

    // Transform to match frontend format
    const transformedInvoice: InvoiceDetail = {
      id: invoice.id,
      invoiceNumber: invoice.number,
      date: invoice.issuedAt?.toISOString() || invoice.createdAt.toISOString(),
      dueDate: invoice.dueAt?.toISOString() || null,
      netAmount: invoice.subtotal,
      taxRate: invoice.taxRate,
      taxAmount: invoice.taxAmount,
      grossAmount: invoice.total,
      currency: invoice.currency,
      status: invoice.status,
      description: invoice.items[0]?.description || 'Keine Beschreibung',
      customerId: invoice.customerId,
      customer: {
        id: invoice.customer.id,
        name: invoice.customer.name,
        email: invoice.customer.email,
        phone: invoice.customer.phone,
        address: invoice.customer.address,
      },
      items: invoice.items.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
        category: item.category,
      })),
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
    };

    res.status(200).json({
      success: true,
      invoice: transformedInvoice,
    });
  } catch (error) {
    console.error('[Get Invoice API] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch invoice';

    res.status(500).json({ success: false, error: errorMessage });
  }
}
