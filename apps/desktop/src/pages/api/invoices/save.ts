/**
 * Save Invoice API Route
 *
 * Saves a voice-generated invoice to SQLite database.
 *
 * @module api/invoices/save
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

interface SaveInvoiceRequest {
  invoice: {
    number: string;
    customerId: string;
    customer: { id: string; name: string };
    items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    total: number;
    status: string;
  };
  transcription?: string;
}

interface SaveInvoiceResponse {
  success: boolean;
  invoiceId?: string;
  error?: string;
}

/**
 *
 * @param req
 * @param res
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SaveInvoiceResponse>
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const { invoice, transcription }: SaveInvoiceRequest = req.body;

    if (!invoice) {
      res.status(400).json({ success: false, error: 'Missing invoice data' });
      return;
    }

    console.log('[Save Invoice API] Saving invoice:', invoice.number);

    // Step 1: Create or find customer
    let customer = await prisma.customer.findFirst({
      where: { name: invoice.customer.name },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: invoice.customer.name,
          email: null,
          phone: null,
          address: null,
          city: null,
          zipCode: null,
          country: 'Deutschland',
        },
      });
      console.log('[Save Invoice API] Created customer:', customer.id);
    } else {
      console.log('[Save Invoice API] Found existing customer:', customer.id);
    }

    // Step 2: Create invoice
    const savedInvoice = await prisma.invoice.create({
      data: {
        number: invoice.number,
        customerId: customer.id,
        subtotal: invoice.subtotal,
        taxRate: invoice.taxRate,
        taxAmount: invoice.taxAmount,
        total: invoice.total,
        currency: 'EUR',
        status: invoice.status,
        issuedAt: new Date(),
        dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        notes: transcription || null,
      },
    });

    console.log('[Save Invoice API] Invoice saved:', savedInvoice.id);

    // Step 3: Create invoice items
    for (const item of invoice.items) {
      await prisma.invoiceItem.create({
        data: {
          invoiceId: savedInvoice.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          category: null,
        },
      });
    }

    console.log('[Save Invoice API] Items saved:', invoice.items.length);

    res.status(200).json({
      success: true,
      invoiceId: savedInvoice.id,
    });
  } catch (error) {
    console.error('[Save Invoice API] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to save invoice';

    res.status(500).json({ success: false, error: errorMessage });
  }
}
