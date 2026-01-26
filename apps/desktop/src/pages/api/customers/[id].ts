/**
 * Single Customer API Route
 *
 * Handles operations on a single customer.
 *
 * GET /api/customers/[id] - Get customer details with invoices
 * PUT /api/customers/[id] - Update customer
 * DELETE /api/customers/[id] - Soft delete customer
 *
 * @module api/customers/[id]
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

/**
 * Invoice summary for customer.
 */
interface InvoiceSummary {
  id: string;
  number: string;
  total: number;
  status: string;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
}

/**
 * Customer with full details.
 */
interface CustomerDetails {
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
  updatedAt: string;
  totalRevenue: number;
  invoiceCount: number;
  paidInvoices: number;
  openInvoices: number;
  overdueInvoices: number;
  avgInvoiceValue: number;
  invoices: InvoiceSummary[];
  revenueByMonth: { month: string; revenue: number }[];
}

/**
 * API response types.
 */
interface SuccessResponse {
  success: true;
  data: CustomerDetails;
}

interface DeleteResponse {
  success: true;
  message: string;
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
 * Single Customer API handler.
 * @param req
 * @param res
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | DeleteResponse | ErrorResponse>
): Promise<void> {
  const { id } = req.query;

  if (typeof id !== 'string') {
    res.status(400).json({ success: false, error: 'Ungültige Kunden-ID' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const customer = await prisma.customer.findUnique({
        where: { id, deletedAt: null },
        include: {
          invoices: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              number: true,
              total: true,
              status: true,
              issuedAt: true,
              dueAt: true,
              paidAt: true,
              createdAt: true,
            },
          },
        },
      });

      if (!customer) {
        res.status(404).json({ success: false, error: 'Kunde nicht gefunden' });
        return;
      }

      const now = new Date();
      const paidInvoices = customer.invoices.filter((i) => i.status === 'PAID');
      const openInvoices = customer.invoices.filter(
        (i) => i.status === 'SENT' || i.status === 'OVERDUE'
      );
      const overdueInvoices = customer.invoices.filter((i) => i.status === 'OVERDUE');
      const totalRevenue = paidInvoices.reduce((sum, i) => sum + i.total, 0);
      const avgInvoiceValue =
        customer.invoices.length > 0 ? totalRevenue / paidInvoices.length || 0 : 0;

      // Calculate revenue by month (last 12 months)
      const revenueByMonth: { month: string; revenue: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = monthDate.toISOString().slice(0, 7); // YYYY-MM
        const monthName = monthDate.toLocaleDateString('de-DE', {
          month: 'short',
          year: '2-digit',
        });

        const monthRevenue = paidInvoices
          .filter((inv) => {
            if (!inv.paidAt) return false;
            const paidMonth = new Date(inv.paidAt).toISOString().slice(0, 7);
            return paidMonth === monthKey;
          })
          .reduce((sum, inv) => sum + inv.total, 0);

        revenueByMonth.push({ month: monthName, revenue: monthRevenue });
      }

      const invoiceSummaries: InvoiceSummary[] = customer.invoices.map((inv) => ({
        id: inv.id,
        number: inv.number,
        total: inv.total,
        status: inv.status,
        issuedAt: inv.issuedAt?.toISOString() || null,
        dueAt: inv.dueAt?.toISOString() || null,
        paidAt: inv.paidAt?.toISOString() || null,
      }));

      const customerDetails: CustomerDetails = {
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
        updatedAt: customer.updatedAt.toISOString(),
        totalRevenue,
        invoiceCount: customer.invoices.length,
        paidInvoices: paidInvoices.length,
        openInvoices: openInvoices.length,
        overdueInvoices: overdueInvoices.length,
        avgInvoiceValue,
        invoices: invoiceSummaries,
        revenueByMonth,
      };

      res.status(200).json({ success: true, data: customerDetails });
      return;
    }

    if (req.method === 'PUT') {
      const { name, email, phone, address, city, zipCode, country, taxId, notes } = req.body;

      const existingCustomer = await prisma.customer.findUnique({
        where: { id, deletedAt: null },
      });

      if (!existingCustomer) {
        res.status(404).json({ success: false, error: 'Kunde nicht gefunden' });
        return;
      }

      if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
        res.status(400).json({ success: false, error: 'Kundenname darf nicht leer sein' });
        return;
      }

      const updatedCustomer = await prisma.customer.update({
        where: { id },
        data: {
          name: name !== undefined ? name.trim() : undefined,
          email: email !== undefined ? email?.trim() || null : undefined,
          phone: phone !== undefined ? phone?.trim() || null : undefined,
          address: address !== undefined ? address?.trim() || null : undefined,
          city: city !== undefined ? city?.trim() || null : undefined,
          zipCode: zipCode !== undefined ? zipCode?.trim() || null : undefined,
          country: country !== undefined ? country?.trim() || 'DE' : undefined,
          taxId: taxId !== undefined ? taxId?.trim() || null : undefined,
          notes: notes !== undefined ? notes?.trim() || null : undefined,
        },
        include: {
          invoices: {
            where: { deletedAt: null },
            select: {
              id: true,
              number: true,
              total: true,
              status: true,
              issuedAt: true,
              dueAt: true,
              paidAt: true,
            },
          },
        },
      });

      const paidInvoices = updatedCustomer.invoices.filter((i) => i.status === 'PAID');
      const openInvoices = updatedCustomer.invoices.filter(
        (i) => i.status === 'SENT' || i.status === 'OVERDUE'
      );
      const overdueInvoices = updatedCustomer.invoices.filter((i) => i.status === 'OVERDUE');
      const totalRevenue = paidInvoices.reduce((sum, i) => sum + i.total, 0);
      const avgInvoiceValue =
        updatedCustomer.invoices.length > 0 ? totalRevenue / paidInvoices.length || 0 : 0;

      const customerDetails: CustomerDetails = {
        id: updatedCustomer.id,
        customerNumber: generateCustomerNumber(updatedCustomer.id, updatedCustomer.createdAt),
        name: updatedCustomer.name,
        email: updatedCustomer.email,
        phone: updatedCustomer.phone,
        address: updatedCustomer.address,
        city: updatedCustomer.city,
        zipCode: updatedCustomer.zipCode,
        country: updatedCustomer.country,
        taxId: updatedCustomer.taxId,
        notes: updatedCustomer.notes,
        createdAt: updatedCustomer.createdAt.toISOString(),
        updatedAt: updatedCustomer.updatedAt.toISOString(),
        totalRevenue,
        invoiceCount: updatedCustomer.invoices.length,
        paidInvoices: paidInvoices.length,
        openInvoices: openInvoices.length,
        overdueInvoices: overdueInvoices.length,
        avgInvoiceValue,
        invoices: updatedCustomer.invoices.map((inv) => ({
          id: inv.id,
          number: inv.number,
          total: inv.total,
          status: inv.status,
          issuedAt: inv.issuedAt?.toISOString() || null,
          dueAt: inv.dueAt?.toISOString() || null,
          paidAt: inv.paidAt?.toISOString() || null,
        })),
        revenueByMonth: [],
      };

      res.status(200).json({ success: true, data: customerDetails });
      return;
    }

    if (req.method === 'DELETE') {
      const existingCustomer = await prisma.customer.findUnique({
        where: { id, deletedAt: null },
      });

      if (!existingCustomer) {
        res.status(404).json({ success: false, error: 'Kunde nicht gefunden' });
        return;
      }

      await prisma.customer.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      res.status(200).json({ success: true, message: 'Kunde erfolgreich gelöscht' });
      return;
    }

    res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('[Customer API] Error:', error);
    res.status(500).json({ success: false, error: 'Interner Serverfehler' });
  }
}
