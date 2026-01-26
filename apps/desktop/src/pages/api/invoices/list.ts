/**
 * List Invoices API Route
 *
 * Retrieves all invoices from SQLite database with customer information.
 *
 * @module api/invoices/list
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

interface InvoiceListItem {
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
  customerName: string;
  createdAt: string;
  updatedAt: string;
}

interface InvoiceListResponse {
  success: boolean;
  invoices?: InvoiceListItem[];
  count?: number;
  error?: string;
}

/**
 *
 * @param req
 * @param res
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<InvoiceListResponse>
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    // Parse query parameters
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    console.log('[List Invoices API] Fetching invoices from database...', { limit });

    // Fetch invoices with customer info, ordered by newest first
    const invoices = await prisma.invoice.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        items: true,
      },
      ...(limit && { take: limit }),
    });

    console.log('[List Invoices API] Found invoices:', invoices.length);

    // Transform to match frontend format
    const transformedInvoices: InvoiceListItem[] = invoices.map((invoice) => {
      // Get first item description as invoice description
      const description = invoice.items[0]?.description || 'Keine Beschreibung';

      return {
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
        description,
        customerId: invoice.customerId,
        customerName: invoice.customer.name,
        createdAt: invoice.createdAt.toISOString(),
        updatedAt: invoice.updatedAt.toISOString(),
      };
    });

    res.status(200).json({
      success: true,
      invoices: transformedInvoices,
      count: transformedInvoices.length,
    });
  } catch (error) {
    console.error('[List Invoices API] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch invoices';

    res.status(500).json({ success: false, error: errorMessage });
  }
}
