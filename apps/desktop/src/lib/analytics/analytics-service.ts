/**
 * Analytics service for VoiceInvoice Enterprise Dashboard.
 *
 * Provides extended analytics beyond basic statistics:
 * - Revenue statistics with trends
 * - Customer insights
 * - Invoice insights
 * - Time-based analysis
 *
 * @module lib/analytics/analytics-service
 */

import { PrismaClient, Customer, Invoice, InvoiceItem } from '@prisma/client';
import { DatabaseService, InvoiceStatistics } from '../database/database-service';

/**
 * Date range for filtering analytics data.
 */
export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * Revenue statistics with trend analysis.
 */
export interface RevenueStats {
  /** Total revenue from paid invoices */
  total: number;
  /** Revenue grouped by month */
  byMonth: { month: string; amount: number }[];
  /** Revenue grouped by customer */
  byCustomer: { customerId: string; customerName: string; amount: number }[];
  /** Trend direction compared to previous period */
  trend: 'up' | 'down' | 'stable';
  /** Trend percentage change */
  trendPercent: number;
}

/**
 * Customer insights with activity metrics.
 */
export interface CustomerInsights {
  /** Top customers by revenue */
  topCustomers: { customer: Customer; totalRevenue: number; invoiceCount: number }[];
  /** Number of new customers in period */
  newCustomers: number;
  /** Number of customers with paid invoices */
  activeCustomers: number;
}

/**
 * Invoice insights with patterns.
 */
export interface InvoiceInsights {
  /** Average invoice value */
  averageValue: number;
  /** Average number of items per invoice */
  averageItemCount: number;
  /** Most frequently used item descriptions */
  mostCommonItems: { description: string; count: number }[];
  /** Average time from issued to paid (days) */
  paymentTimeAverage: number;
}

/**
 * Combined dashboard summary.
 */
export interface DashboardSummary {
  /** Revenue statistics */
  revenue: RevenueStats;
  /** Customer insights */
  customers: CustomerInsights;
  /** Invoice insights */
  invoices: InvoiceInsights;
  /** Basic statistics from DatabaseService */
  basicStats: InvoiceStatistics;
}

/**
 * Invoice with customer data for analytics.
 */
interface InvoiceWithCustomer extends Invoice {
  customer: Customer;
}

/**
 * Analytics service providing dashboard metrics.
 */
export class AnalyticsService {
  private db: DatabaseService;
  private prisma: PrismaClient;

  /**
   * Creates analytics service instance.
   * @param db - Database service instance
   * @param prisma - Prisma client for direct queries
   */
  constructor(db: DatabaseService, prisma: PrismaClient) {
    this.db = db;
    this.prisma = prisma;
  }

  /**
   * Gets revenue statistics with optional date range filter.
   * @param range - Optional date range to filter data
   */
  async getRevenueStats(range?: DateRange): Promise<RevenueStats> {
    const invoices = await this.getPaidInvoicesInRange(range);

    if (invoices.length === 0) {
      return {
        total: 0,
        byMonth: [],
        byCustomer: [],
        trend: 'stable',
        trendPercent: 0,
      };
    }

    // Calculate total revenue
    const total = invoices.reduce((sum, inv) => sum + inv.total, 0);

    // Group by month
    const byMonthMap = new Map<string, number>();
    for (const inv of invoices) {
      const date = new Date(inv.paidAt || inv.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      byMonthMap.set(monthKey, (byMonthMap.get(monthKey) || 0) + inv.total);
    }
    const byMonth = Array.from(byMonthMap.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Group by customer
    const byCustomerMap = new Map<string, { customerId: string; customerName: string; amount: number }>();
    for (const inv of invoices) {
      const existing = byCustomerMap.get(inv.customerId);
      if (existing) {
        existing.amount += inv.total;
      } else {
        byCustomerMap.set(inv.customerId, {
          customerId: inv.customerId,
          customerName: inv.customer?.name || 'Unknown',
          amount: inv.total,
        });
      }
    }
    const byCustomer = Array.from(byCustomerMap.values())
      .sort((a, b) => b.amount - a.amount);

    // Calculate trend
    const { trend, trendPercent } = await this.calculateTrend(range);

    return {
      total,
      byMonth,
      byCustomer,
      trend,
      trendPercent,
    };
  }

  /**
   * Gets customer insights with optional date range filter.
   * @param range - Optional date range to filter data
   */
  async getCustomerInsights(range?: DateRange): Promise<CustomerInsights> {
    const customers = await this.getCustomersInRange(range);
    const invoices = await this.getPaidInvoicesInRange(range);

    // Count new customers in range
    const newCustomers = customers.length;

    // Calculate active customers (those with paid invoices)
    const activeCustomerIds = new Set(invoices.map(inv => inv.customerId));
    const activeCustomers = activeCustomerIds.size;

    // Calculate top customers
    const customerStatsMap = new Map<string, { customer: Customer; totalRevenue: number; invoiceCount: number }>();

    for (const inv of invoices) {
      const existing = customerStatsMap.get(inv.customerId);
      if (existing) {
        existing.totalRevenue += inv.total;
        existing.invoiceCount += 1;
      } else if (inv.customer) {
        customerStatsMap.set(inv.customerId, {
          customer: inv.customer,
          totalRevenue: inv.total,
          invoiceCount: 1,
        });
      }
    }

    const topCustomers = Array.from(customerStatsMap.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10); // Top 10

    return {
      topCustomers,
      newCustomers,
      activeCustomers,
    };
  }

  /**
   * Gets invoice insights with optional date range filter.
   * @param range - Optional date range to filter data
   */
  async getInvoiceInsights(range?: DateRange): Promise<InvoiceInsights> {
    const invoices = await this.getInvoicesInRange(range);

    if (invoices.length === 0) {
      return {
        averageValue: 0,
        averageItemCount: 0,
        mostCommonItems: [],
        paymentTimeAverage: 0,
      };
    }

    // Calculate average invoice value
    const totalValue = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const averageValue = totalValue / invoices.length;

    // Get all items for invoices
    const invoiceIds = invoices.map(inv => inv.id);
    const items = await this.getItemsForInvoices(invoiceIds);

    // Calculate average item count
    const itemCountMap = new Map<string, number>();
    for (const item of items) {
      itemCountMap.set(item.invoiceId, (itemCountMap.get(item.invoiceId) || 0) + 1);
    }
    const totalItemCount = Array.from(itemCountMap.values()).reduce((sum, count) => sum + count, 0);
    const averageItemCount = invoices.length > 0 ? Math.round(totalItemCount / invoices.length) : 0;

    // Find most common items
    const descriptionCountMap = new Map<string, number>();
    for (const item of items) {
      descriptionCountMap.set(item.description, (descriptionCountMap.get(item.description) || 0) + 1);
    }
    const mostCommonItems = Array.from(descriptionCountMap.entries())
      .map(([description, count]) => ({ description, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10

    // Calculate average payment time
    const paymentTimeAverage = await this.calculateAveragePaymentTime(invoices);

    return {
      averageValue,
      averageItemCount,
      mostCommonItems,
      paymentTimeAverage,
    };
  }

  /**
   * Gets combined dashboard summary.
   */
  async getDashboardSummary(): Promise<DashboardSummary> {
    const [revenue, customers, invoices, basicStats] = await Promise.all([
      this.getRevenueStats(),
      this.getCustomerInsights(),
      this.getInvoiceInsights(),
      this.db.getInvoiceStatistics(),
    ]);

    return {
      revenue,
      customers,
      invoices,
      basicStats,
    };
  }

  // ==================== Private Helper Methods ====================

  /**
   * Gets paid invoices within date range.
   */
  private async getPaidInvoicesInRange(range?: DateRange): Promise<InvoiceWithCustomer[]> {
    let query = `
      SELECT i.*, c.id as c_id, c.name as c_name, c.email as c_email,
             c.phone as c_phone, c.address as c_address, c.city as c_city,
             c.zipCode as c_zipCode, c.country as c_country, c.taxId as c_taxId,
             c.notes as c_notes, c.createdAt as c_createdAt, c.updatedAt as c_updatedAt,
             c.syncVersion as c_syncVersion, c.deletedAt as c_deletedAt
      FROM Invoice i
      LEFT JOIN Customer c ON i.customerId = c.id
      WHERE i.status = 'PAID' AND i.deletedAt IS NULL
    `;

    const params: unknown[] = [];

    if (range) {
      query += ` AND i.paidAt >= ? AND i.paidAt <= ?`;
      params.push(range.from.toISOString(), range.to.toISOString());
    }

    query += ` ORDER BY i.paidAt DESC`;

    const results = await this.prisma.$queryRawUnsafe<
      (Invoice & {
        c_id: string;
        c_name: string;
        c_email: string | null;
        c_phone: string | null;
        c_address: string | null;
        c_city: string | null;
        c_zipCode: string | null;
        c_country: string | null;
        c_taxId: string | null;
        c_notes: string | null;
        c_createdAt: string;
        c_updatedAt: string;
        c_syncVersion: number;
        c_deletedAt: string | null;
      })[]
    >(query, ...params);

    return results.map(row => ({
      id: row.id,
      number: row.number,
      customerId: row.customerId,
      subtotal: row.subtotal,
      taxRate: row.taxRate,
      taxAmount: row.taxAmount,
      total: row.total,
      currency: row.currency,
      status: row.status,
      issuedAt: row.issuedAt,
      dueAt: row.dueAt,
      paidAt: row.paidAt,
      voiceRecordingId: row.voiceRecordingId,
      transcription: row.transcription,
      notes: row.notes,
      paymentTerms: row.paymentTerms,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      syncVersion: row.syncVersion,
      deletedAt: row.deletedAt,
      customer: {
        id: row.c_id,
        name: row.c_name,
        email: row.c_email,
        phone: row.c_phone,
        address: row.c_address,
        city: row.c_city,
        zipCode: row.c_zipCode,
        country: row.c_country,
        taxId: row.c_taxId,
        notes: row.c_notes,
        createdAt: new Date(row.c_createdAt),
        updatedAt: new Date(row.c_updatedAt),
        syncVersion: row.c_syncVersion,
        deletedAt: row.c_deletedAt ? new Date(row.c_deletedAt) : null,
      } as Customer,
    }));
  }

  /**
   * Gets all invoices within date range.
   */
  private async getInvoicesInRange(range?: DateRange): Promise<Invoice[]> {
    let query = `SELECT * FROM Invoice WHERE deletedAt IS NULL`;
    const params: unknown[] = [];

    if (range) {
      query += ` AND createdAt >= ? AND createdAt <= ?`;
      params.push(range.from.toISOString(), range.to.toISOString());
    }

    query += ` ORDER BY createdAt DESC`;

    return this.prisma.$queryRawUnsafe<Invoice[]>(query, ...params);
  }

  /**
   * Gets customers created within date range.
   */
  private async getCustomersInRange(range?: DateRange): Promise<Customer[]> {
    let query = `SELECT * FROM Customer WHERE deletedAt IS NULL`;
    const params: unknown[] = [];

    if (range) {
      query += ` AND createdAt >= ? AND createdAt <= ?`;
      params.push(range.from.toISOString(), range.to.toISOString());
    }

    query += ` ORDER BY createdAt DESC`;

    return this.prisma.$queryRawUnsafe<Customer[]>(query, ...params);
  }

  /**
   * Gets invoice items for given invoice IDs.
   */
  private async getItemsForInvoices(invoiceIds: string[]): Promise<InvoiceItem[]> {
    if (invoiceIds.length === 0) {
      return [];
    }

    const placeholders = invoiceIds.map(() => '?').join(',');
    const query = `SELECT * FROM InvoiceItem WHERE invoiceId IN (${placeholders})`;

    return this.prisma.$queryRawUnsafe<InvoiceItem[]>(query, ...invoiceIds);
  }

  /**
   * Calculates trend by comparing current period to previous period.
   */
  private async calculateTrend(range?: DateRange): Promise<{ trend: 'up' | 'down' | 'stable'; trendPercent: number }> {
    const now = new Date();
    let currentStart: Date;
    let currentEnd: Date;
    let previousStart: Date;
    let previousEnd: Date;

    if (range) {
      // Use the same duration for previous period
      const duration = range.to.getTime() - range.from.getTime();
      currentStart = range.from;
      currentEnd = range.to;
      previousStart = new Date(range.from.getTime() - duration);
      previousEnd = new Date(range.from.getTime() - 1);
    } else {
      // Default: compare current month to previous month
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
      currentEnd = now;
      previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    }

    const currentInvoices = await this.getPaidInvoicesInRange({ from: currentStart, to: currentEnd });
    const previousInvoices = await this.getPaidInvoicesInRange({ from: previousStart, to: previousEnd });

    const currentTotal = currentInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const previousTotal = previousInvoices.reduce((sum, inv) => sum + inv.total, 0);

    if (previousTotal === 0 && currentTotal === 0) {
      return { trend: 'stable', trendPercent: 0 };
    }

    if (previousTotal === 0) {
      return { trend: 'up', trendPercent: 100 };
    }

    const percentChange = ((currentTotal - previousTotal) / previousTotal) * 100;

    if (percentChange > 5) {
      return { trend: 'up', trendPercent: Math.round(percentChange) };
    } else if (percentChange < -5) {
      return { trend: 'down', trendPercent: Math.round(Math.abs(percentChange)) };
    } else {
      return { trend: 'stable', trendPercent: Math.round(Math.abs(percentChange)) };
    }
  }

  /**
   * Calculates average payment time in days.
   */
  private async calculateAveragePaymentTime(invoices: Invoice[]): Promise<number> {
    const paidInvoices = invoices.filter(inv => inv.status === 'PAID' && inv.issuedAt && inv.paidAt);

    if (paidInvoices.length === 0) {
      return 0;
    }

    let totalDays = 0;
    for (const inv of paidInvoices) {
      const issuedDate = new Date(inv.issuedAt!);
      const paidDate = new Date(inv.paidAt!);
      const diffMs = paidDate.getTime() - issuedDate.getTime();
      const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      totalDays += diffDays;
    }

    return Math.round(totalDays / paidInvoices.length);
  }
}
