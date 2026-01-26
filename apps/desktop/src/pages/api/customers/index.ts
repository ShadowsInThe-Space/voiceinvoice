/**
 * Customers API Route
 *
 * Handles listing all customers and creating new ones.
 *
 * GET /api/customers - List all customers with revenue stats
 * POST /api/customers - Create a new customer
 *
 * @module api/customers
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

/**
 * Customer with revenue statistics.
 */
interface CustomerWithStats {
  id: string;
  customerNumber: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  zipCode: string | null;
  country: string;
  taxId: string | null;
  notes: string | null;
  createdAt: string;
  totalRevenue: number;
  invoiceCount: number;
  paidInvoices: number;
  openInvoices: number;
}

/**
 * API response types.
 */
interface SuccessResponse {
  success: true;
  data: CustomerWithStats[] | CustomerWithStats;
}

interface ErrorResponse {
  success: false;
  error: string;
}

/**
 * Generate a customer number from ID and creation date.
 * @param id
 * @param createdAt
 */
function generateCustomerNumber(id: string, createdAt: Date): string {
  const year = createdAt.getFullYear().toString().slice(-2);
  const shortId = id.slice(-6).toUpperCase();
  return `KD-${year}${shortId}`;
}

/**
 * Customers API handler.
 * @param req
 * @param res
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
): Promise<void> {
  try {
    if (req.method === 'GET') {
      // Get all customers with invoice statistics
      const customers = await prisma.customer.findMany({
        where: { deletedAt: null },
        include: {
          invoices: {
            where: { deletedAt: null },
            select: {
              id: true,
              total: true,
              status: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      const customersWithStats: CustomerWithStats[] = customers.map((customer) => {
        const paidInvoices = customer.invoices.filter((i) => i.status === 'PAID');
        const openInvoices = customer.invoices.filter(
          (i) => i.status === 'SENT' || i.status === 'OVERDUE'
        );
        const totalRevenue = paidInvoices.reduce((sum, i) => sum + i.total, 0);

        return {
          id: customer.id,
          customerNumber: generateCustomerNumber(customer.id, customer.createdAt),
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          city: customer.city,
          zipCode: customer.zipCode,
          country: customer.country,
          taxId: customer.taxId,
          notes: customer.notes,
          createdAt: customer.createdAt.toISOString(),
          totalRevenue,
          invoiceCount: customer.invoices.length,
          paidInvoices: paidInvoices.length,
          openInvoices: openInvoices.length,
        };
      });

      res.status(200).json({ success: true, data: customersWithStats });
      return;
    }

    if (req.method === 'POST') {
      const { name, email, phone, address, city, zipCode, country, taxId, notes } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ success: false, error: 'Kundenname ist erforderlich' });
        return;
      }

      const customer = await prisma.customer.create({
        data: {
          name: name.trim(),
          email: email?.trim() || null,
          phone: phone?.trim() || null,
          address: address?.trim() || null,
          city: city?.trim() || null,
          zipCode: zipCode?.trim() || null,
          country: country?.trim() || 'DE',
          taxId: taxId?.trim() || null,
          notes: notes?.trim() || null,
        },
      });

      const customerWithStats: CustomerWithStats = {
        id: customer.id,
        customerNumber: generateCustomerNumber(customer.id, customer.createdAt),
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
        zipCode: customer.zipCode,
        country: customer.country,
        taxId: customer.taxId,
        notes: customer.notes,
        createdAt: customer.createdAt.toISOString(),
        totalRevenue: 0,
        invoiceCount: 0,
        paidInvoices: 0,
        openInvoices: 0,
      };

      res.status(201).json({ success: true, data: customerWithStats });
      return;
    }

    res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('[Customers API] Error:', error);
    res.status(500).json({ success: false, error: 'Interner Serverfehler' });
  }
}
