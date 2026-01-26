/**
 * Analytics KPIs API Route
 *
 * Provides KPIs for the dashboard.
 * Works in both browser and Electron contexts.
 *
 * @module api/analytics/kpis
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

/**
 * KPI data structure for dashboard.
 */
interface KPIData {
  totalRevenue: number;
  revenueTrend: number;
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
  overdueInvoices: number;
  activeCustomers: number;
  newCustomers: number;
  averageInvoiceValue: number;
  avgPaymentDays: number;
  topCustomerName: string | null;
  topCustomerRevenue: number;
}

/**
 * KPI response structure.
 */
interface KPIResponse {
  success: boolean;
  data: KPIData;
}

/**
 * GET /api/analytics/kpis
 *
 * Returns KPIs calculated from the database for the dashboard.
 *
 * @param req - Next.js API request
 * @param res - Next.js API response
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<KPIResponse>
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({
      success: false,
      data: {
        totalRevenue: 0,
        revenueTrend: 0,
        totalInvoices: 0,
        paidInvoices: 0,
        pendingInvoices: 0,
        overdueInvoices: 0,
        activeCustomers: 0,
        newCustomers: 0,
        averageInvoiceValue: 0,
        avgPaymentDays: 14,
        topCustomerName: null,
        topCustomerRevenue: 0,
      },
    });
    return;
  }

  try {
    // Get invoice statistics from database with customer info
    const invoices = await prisma.invoice.findMany({
      select: {
        status: true,
        total: true,
        dueAt: true,
        createdAt: true,
        customerId: true,
        customer: {
          select: {
            name: true,
          },
        },
      },
    });

    // Get customer statistics
    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    // Calculate invoice statistics
    const paidInvoices = invoices.filter((inv) => inv.status === 'PAID');
    const pendingInvoices = invoices.filter((inv) =>
      inv.status === 'PENDING' || inv.status === 'SENT' || inv.status === 'DRAFT'
    );
    const overdueInvoices = invoices.filter((inv) => {
      if (inv.status === 'PAID') return false;
      if (!inv.dueAt) return false;
      const dueDate = new Date(inv.dueAt);
      return dueDate < new Date();
    });

    // Calculate total revenue (from paid invoices)
    const totalRevenue = paidInvoices.reduce(
      (sum, inv) => sum + (inv.total || 0),
      0
    );

    // Calculate average invoice value
    const averageInvoiceValue = invoices.length > 0
      ? invoices.reduce((sum, inv) => sum + (inv.total || 0), 0) / invoices.length
      : 0;

    // Calculate active customers (customers with invoices)
    const activeCustomerIds = new Set(invoices.map((inv) => inv.customerId));
    const activeCustomers = activeCustomerIds.size;

    // Calculate new customers (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newCustomers = customers.filter(
      (c) => new Date(c.createdAt) >= thirtyDaysAgo
    ).length;

    // Calculate revenue trend (compare this month to last month)
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const thisMonthRevenue = paidInvoices
      .filter((inv) => new Date(inv.createdAt) >= thisMonthStart)
      .reduce((sum, inv) => sum + (inv.total || 0), 0);

    const lastMonthRevenue = paidInvoices
      .filter((inv) => {
        const date = new Date(inv.createdAt);
        return date >= lastMonthStart && date <= lastMonthEnd;
      })
      .reduce((sum, inv) => sum + (inv.total || 0), 0);

    const revenueTrend = lastMonthRevenue > 0
      ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : 0;

    // Calculate top customer by revenue
    const customerRevenue = new Map<string, { name: string; revenue: number }>();
    for (const inv of invoices) {
      const customerId = inv.customerId;
      const customerName = inv.customer?.name || 'Unbekannt';
      const current = customerRevenue.get(customerId) || { name: customerName, revenue: 0 };
      current.revenue += inv.total || 0;
      customerRevenue.set(customerId, current);
    }

    let topCustomerName: string | null = null;
    let topCustomerRevenue = 0;
    for (const [, data] of customerRevenue) {
      if (data.revenue > topCustomerRevenue) {
        topCustomerRevenue = data.revenue;
        topCustomerName = data.name;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        revenueTrend,
        totalInvoices: invoices.length,
        paidInvoices: paidInvoices.length,
        pendingInvoices: pendingInvoices.length,
        overdueInvoices: overdueInvoices.length,
        activeCustomers,
        newCustomers,
        averageInvoiceValue: Math.round(averageInvoiceValue * 100) / 100,
        avgPaymentDays: 14, // TODO: Calculate from actual payment data
        topCustomerName,
        topCustomerRevenue: Math.round(topCustomerRevenue * 100) / 100,
      },
    });
  } catch (error) {
    console.warn('[Analytics API] Database not available:', error);
    // Return empty data when database is not available
    res.status(200).json({
      success: true,
      data: {
        totalRevenue: 0,
        revenueTrend: 0,
        totalInvoices: 0,
        paidInvoices: 0,
        pendingInvoices: 0,
        overdueInvoices: 0,
        activeCustomers: 0,
        newCustomers: 0,
        averageInvoiceValue: 0,
        avgPaymentDays: 14,
        topCustomerName: null,
        topCustomerRevenue: 0,
      },
    });
  }
}
