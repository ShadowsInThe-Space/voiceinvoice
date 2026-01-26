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

    // Step 1: Create or find customer with fuzzy matching
    const customerName = invoice.customer.name?.trim() || 'Unbekannter Kunde';

    // First try exact match
    let customer = await prisma.customer.findFirst({
      where: {
        name: customerName,
        deletedAt: null,
      },
    });

    // If no exact match, try fuzzy search (contains)
    if (!customer) {
      // Get all customers and find best match
      const allCustomers = await prisma.customer.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
      });

      // Normalize search name (lowercase, remove common suffixes)
      const normalizedSearch = customerName
        .toLowerCase()
        .replace(/\s*(gmbh|ag|ohg|kg|e\.k\.|ug|gbr|inc\.|ltd\.?|co\.?)\s*/gi, '')
        .trim();

      // Find best matching customer
      let bestMatch: { id: string; name: string; score: number } | null = null;

      for (const c of allCustomers) {
        const normalizedName = c.name
          .toLowerCase()
          .replace(/\s*(gmbh|ag|ohg|kg|e\.k\.|ug|gbr|inc\.|ltd\.?|co\.?)\s*/gi, '')
          .trim();

        // Check if one contains the other
        if (
          normalizedName.includes(normalizedSearch) ||
          normalizedSearch.includes(normalizedName)
        ) {
          const score =
            Math.min(normalizedName.length, normalizedSearch.length) /
            Math.max(normalizedName.length, normalizedSearch.length);

          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { id: c.id, name: c.name, score };
          }
        }
      }

      // Use match if score is good enough (> 60%)
      if (bestMatch && bestMatch.score > 0.6) {
        customer = await prisma.customer.findUnique({
          where: { id: bestMatch.id },
        });
        console.log(
          '[Save Invoice API] Fuzzy matched customer:',
          customer?.name,
          '(score:',
          bestMatch.score.toFixed(2),
          ')'
        );
      }
    }

    // If still no match, create new customer
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: customerName,
          email: null,
          phone: null,
          address: null,
          city: null,
          zipCode: null,
          country: 'DE',
        },
      });
      console.log('[Save Invoice API] Created new customer:', customer.id, customer.name);
    } else {
      console.log('[Save Invoice API] Found existing customer:', customer.id, customer.name);
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
