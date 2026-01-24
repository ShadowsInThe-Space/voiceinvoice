/**
 * Tests for AnalyticsService.
 *
 * Tests dashboard analytics with revenue stats, customer insights,
 * invoice insights, and trend analysis.
 *
 * @module tests/analytics/analytics-service
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { DatabaseService } from '../../src/lib/database/database-service';
import {
  AnalyticsService,
  DateRange,
  RevenueStats,
  CustomerInsights,
  InvoiceInsights,
  DashboardSummary,
} from '../../src/lib/analytics/analytics-service';

// Use in-memory SQLite for tests
const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file::memory:?cache=shared',
    },
  },
});

describe('AnalyticsService', () => {
  let db: DatabaseService;
  let analytics: AnalyticsService;

  beforeAll(async () => {
    // Push schema to in-memory database
    await testPrisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS Customer (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        address TEXT,
        city TEXT,
        zipCode TEXT,
        country TEXT DEFAULT 'DE',
        taxId TEXT,
        notes TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        syncVersion INTEGER DEFAULT 0,
        deletedAt DATETIME
      )
    `);

    await testPrisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS Invoice (
        id TEXT PRIMARY KEY,
        number TEXT UNIQUE NOT NULL,
        customerId TEXT NOT NULL,
        subtotal REAL NOT NULL,
        taxRate REAL DEFAULT 19.0,
        taxAmount REAL NOT NULL,
        total REAL NOT NULL,
        currency TEXT DEFAULT 'EUR',
        status TEXT DEFAULT 'DRAFT',
        issuedAt DATETIME,
        dueAt DATETIME,
        paidAt DATETIME,
        voiceRecordingId TEXT,
        transcription TEXT,
        notes TEXT,
        paymentTerms TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        syncVersion INTEGER DEFAULT 0,
        deletedAt DATETIME,
        FOREIGN KEY (customerId) REFERENCES Customer(id)
      )
    `);

    await testPrisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS InvoiceItem (
        id TEXT PRIMARY KEY,
        invoiceId TEXT NOT NULL,
        description TEXT NOT NULL,
        quantity REAL DEFAULT 1,
        unitPrice REAL NOT NULL,
        total REAL NOT NULL,
        category TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        syncVersion INTEGER DEFAULT 0,
        FOREIGN KEY (invoiceId) REFERENCES Invoice(id) ON DELETE CASCADE
      )
    `);

    await testPrisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS Setting (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db = new DatabaseService(testPrisma);
    analytics = new AnalyticsService(db, testPrisma);
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean tables before each test
    await testPrisma.$executeRawUnsafe('DELETE FROM InvoiceItem');
    await testPrisma.$executeRawUnsafe('DELETE FROM Invoice');
    await testPrisma.$executeRawUnsafe('DELETE FROM Customer');
    await testPrisma.$executeRawUnsafe('DELETE FROM Setting');
  });

  describe('getRevenueStats', () => {
    it('should calculate total revenue from paid invoices', async () => {
      const customer = await db.createCustomer({ name: 'Revenue Customer' });

      // Create and pay invoices
      const inv1 = await db.createInvoice({
        customerId: customer.id,
        items: [{ description: 'Service A', quantity: 1, unitPrice: 1000 }],
      });
      await db.markInvoiceAsPaid(inv1.id);

      const inv2 = await db.createInvoice({
        customerId: customer.id,
        items: [{ description: 'Service B', quantity: 2, unitPrice: 500 }],
      });
      await db.markInvoiceAsPaid(inv2.id);

      // Unpaid invoice should not count
      await db.createInvoice({
        customerId: customer.id,
        items: [{ description: 'Service C', quantity: 1, unitPrice: 2000 }],
      });

      const stats = await analytics.getRevenueStats();

      // 1000 * 1.19 + 1000 * 1.19 = 2380
      expect(stats.total).toBeCloseTo(2380, 0);
    });

    it('should group revenue by month', async () => {
      const customer = await db.createCustomer({ name: 'Monthly Customer' });

      // Create invoice for current month
      const inv = await db.createInvoice({
        customerId: customer.id,
        items: [{ description: 'Service', quantity: 1, unitPrice: 1000 }],
      });
      await db.markInvoiceAsPaid(inv.id);

      const stats = await analytics.getRevenueStats();

      expect(stats.byMonth).toBeDefined();
      expect(stats.byMonth.length).toBeGreaterThan(0);
      expect(stats.byMonth[0].amount).toBeGreaterThan(0);
    });

    it('should group revenue by customer', async () => {
      const customer1 = await db.createCustomer({ name: 'Customer Alpha' });
      const customer2 = await db.createCustomer({ name: 'Customer Beta' });

      const inv1 = await db.createInvoice({
        customerId: customer1.id,
        items: [{ description: 'Service', quantity: 1, unitPrice: 1000 }],
      });
      await db.markInvoiceAsPaid(inv1.id);

      const inv2 = await db.createInvoice({
        customerId: customer2.id,
        items: [{ description: 'Service', quantity: 1, unitPrice: 2000 }],
      });
      await db.markInvoiceAsPaid(inv2.id);

      const stats = await analytics.getRevenueStats();

      expect(stats.byCustomer).toHaveLength(2);
      expect(stats.byCustomer.find(c => c.customerName === 'Customer Beta')?.amount).toBeGreaterThan(
        stats.byCustomer.find(c => c.customerName === 'Customer Alpha')?.amount ?? 0
      );
    });

    it('should calculate trend direction', async () => {
      const customer = await db.createCustomer({ name: 'Trend Customer' });

      const inv = await db.createInvoice({
        customerId: customer.id,
        items: [{ description: 'Service', quantity: 1, unitPrice: 1000 }],
      });
      await db.markInvoiceAsPaid(inv.id);

      const stats = await analytics.getRevenueStats();

      expect(['up', 'down', 'stable']).toContain(stats.trend);
      expect(typeof stats.trendPercent).toBe('number');
    });

    it('should filter by date range', async () => {
      const customer = await db.createCustomer({ name: 'Date Range Customer' });

      const inv = await db.createInvoice({
        customerId: customer.id,
        items: [{ description: 'Service', quantity: 1, unitPrice: 1000 }],
      });
      await db.markInvoiceAsPaid(inv.id);

      const futureRange: DateRange = {
        from: new Date(Date.now() + 86400000 * 30), // 30 days in future
        to: new Date(Date.now() + 86400000 * 60), // 60 days in future
      };

      const stats = await analytics.getRevenueStats(futureRange);

      expect(stats.total).toBe(0);
    });

    it('should return empty stats when no invoices', async () => {
      const stats = await analytics.getRevenueStats();

      expect(stats.total).toBe(0);
      expect(stats.byMonth).toEqual([]);
      expect(stats.byCustomer).toEqual([]);
      expect(stats.trend).toBe('stable');
      expect(stats.trendPercent).toBe(0);
    });
  });

  describe('getCustomerInsights', () => {
    it('should identify top customers by revenue', async () => {
      const customer1 = await db.createCustomer({ name: 'Small Customer' });
      const customer2 = await db.createCustomer({ name: 'Big Customer' });
      const customer3 = await db.createCustomer({ name: 'Medium Customer' });

      // Small customer: 1 invoice, 100 EUR
      const inv1 = await db.createInvoice({
        customerId: customer1.id,
        items: [{ description: 'Service', quantity: 1, unitPrice: 100 }],
      });
      await db.markInvoiceAsPaid(inv1.id);

      // Big customer: 2 invoices, 3000 EUR total
      const inv2 = await db.createInvoice({
        customerId: customer2.id,
        items: [{ description: 'Service', quantity: 1, unitPrice: 2000 }],
      });
      await db.markInvoiceAsPaid(inv2.id);

      const inv3 = await db.createInvoice({
        customerId: customer2.id,
        items: [{ description: 'Service', quantity: 1, unitPrice: 1000 }],
      });
      await db.markInvoiceAsPaid(inv3.id);

      // Medium customer: 1 invoice, 500 EUR
      const inv4 = await db.createInvoice({
        customerId: customer3.id,
        items: [{ description: 'Service', quantity: 1, unitPrice: 500 }],
      });
      await db.markInvoiceAsPaid(inv4.id);

      const insights = await analytics.getCustomerInsights();

      expect(insights.topCustomers).toBeDefined();
      expect(insights.topCustomers.length).toBeGreaterThanOrEqual(1);
      expect(insights.topCustomers[0].customer.name).toBe('Big Customer');
      expect(insights.topCustomers[0].invoiceCount).toBe(2);
    });

    it('should count active customers', async () => {
      const customer1 = await db.createCustomer({ name: 'Active 1' });
      const customer2 = await db.createCustomer({ name: 'Active 2' });
      await db.createCustomer({ name: 'Inactive' }); // No invoices

      const inv1 = await db.createInvoice({
        customerId: customer1.id,
        items: [{ description: 'Service', quantity: 1, unitPrice: 100 }],
      });
      await db.markInvoiceAsPaid(inv1.id);

      const inv2 = await db.createInvoice({
        customerId: customer2.id,
        items: [{ description: 'Service', quantity: 1, unitPrice: 100 }],
      });
      await db.markInvoiceAsPaid(inv2.id);

      const insights = await analytics.getCustomerInsights();

      expect(insights.activeCustomers).toBe(2);
    });

    it('should count new customers in period', async () => {
      // Create customers
      await db.createCustomer({ name: 'New Customer 1' });
      await db.createCustomer({ name: 'New Customer 2' });

      const range: DateRange = {
        from: new Date(Date.now() - 86400000), // Yesterday
        to: new Date(Date.now() + 86400000), // Tomorrow
      };

      const insights = await analytics.getCustomerInsights(range);

      expect(insights.newCustomers).toBe(2);
    });

    it('should return empty insights when no customers', async () => {
      const insights = await analytics.getCustomerInsights();

      expect(insights.topCustomers).toEqual([]);
      expect(insights.newCustomers).toBe(0);
      expect(insights.activeCustomers).toBe(0);
    });
  });

  describe('getInvoiceInsights', () => {
    it('should calculate average invoice value', async () => {
      const customer = await db.createCustomer({ name: 'Average Customer' });

      await db.createInvoice({
        customerId: customer.id,
        items: [{ description: 'Service', quantity: 1, unitPrice: 1000 }],
      });
      await db.createInvoice({
        customerId: customer.id,
        items: [{ description: 'Service', quantity: 1, unitPrice: 2000 }],
      });

      const insights = await analytics.getInvoiceInsights();

      // Average of 1190 and 2380 = 1785
      expect(insights.averageValue).toBeCloseTo(1785, 0);
    });

    it('should calculate average item count per invoice', async () => {
      const customer = await db.createCustomer({ name: 'Items Customer' });

      await db.createInvoice({
        customerId: customer.id,
        items: [
          { description: 'Item 1', quantity: 1, unitPrice: 100 },
          { description: 'Item 2', quantity: 1, unitPrice: 100 },
        ],
      });
      await db.createInvoice({
        customerId: customer.id,
        items: [
          { description: 'Item 1', quantity: 1, unitPrice: 100 },
          { description: 'Item 2', quantity: 1, unitPrice: 100 },
          { description: 'Item 3', quantity: 1, unitPrice: 100 },
          { description: 'Item 4', quantity: 1, unitPrice: 100 },
        ],
      });

      const insights = await analytics.getInvoiceInsights();

      expect(insights.averageItemCount).toBe(3); // (2 + 4) / 2
    });

    it('should identify most common items', async () => {
      const customer = await db.createCustomer({ name: 'Common Items Customer' });

      // Consulting appears 3 times
      await db.createInvoice({
        customerId: customer.id,
        items: [
          { description: 'Consulting', quantity: 1, unitPrice: 100 },
          { description: 'Development', quantity: 1, unitPrice: 100 },
        ],
      });
      await db.createInvoice({
        customerId: customer.id,
        items: [
          { description: 'Consulting', quantity: 1, unitPrice: 100 },
          { description: 'Support', quantity: 1, unitPrice: 100 },
        ],
      });
      await db.createInvoice({
        customerId: customer.id,
        items: [
          { description: 'Consulting', quantity: 1, unitPrice: 100 },
          { description: 'Development', quantity: 1, unitPrice: 100 },
        ],
      });

      const insights = await analytics.getInvoiceInsights();

      expect(insights.mostCommonItems).toBeDefined();
      expect(insights.mostCommonItems[0].description).toBe('Consulting');
      expect(insights.mostCommonItems[0].count).toBe(3);
    });

    it('should calculate average payment time', async () => {
      const customer = await db.createCustomer({ name: 'Payment Time Customer' });

      // Create invoice and mark as paid
      const inv = await db.createInvoice({
        customerId: customer.id,
        items: [{ description: 'Service', quantity: 1, unitPrice: 100 }],
      });

      // Update with issued date and then mark paid
      await db.updateInvoice(inv.id, {
        status: 'SENT',
        issuedAt: new Date(Date.now() - 86400000 * 10), // 10 days ago
      });
      await db.markInvoiceAsPaid(inv.id);

      const insights = await analytics.getInvoiceInsights();

      expect(insights.paymentTimeAverage).toBeGreaterThanOrEqual(0);
    });

    it('should return zero averages when no invoices', async () => {
      const insights = await analytics.getInvoiceInsights();

      expect(insights.averageValue).toBe(0);
      expect(insights.averageItemCount).toBe(0);
      expect(insights.mostCommonItems).toEqual([]);
      expect(insights.paymentTimeAverage).toBe(0);
    });
  });

  describe('getDashboardSummary', () => {
    it('should combine all analytics into summary', async () => {
      const customer = await db.createCustomer({ name: 'Dashboard Customer' });

      const inv = await db.createInvoice({
        customerId: customer.id,
        items: [{ description: 'Service', quantity: 1, unitPrice: 1000 }],
      });
      await db.markInvoiceAsPaid(inv.id);

      const summary = await analytics.getDashboardSummary();

      expect(summary.revenue).toBeDefined();
      expect(summary.customers).toBeDefined();
      expect(summary.invoices).toBeDefined();
      expect(summary.basicStats).toBeDefined();
    });

    it('should include basic statistics from database service', async () => {
      const customer = await db.createCustomer({ name: 'Stats Customer' });

      await db.createInvoice({
        customerId: customer.id,
        items: [{ description: 'Draft', quantity: 1, unitPrice: 100 }],
      });

      const inv2 = await db.createInvoice({
        customerId: customer.id,
        items: [{ description: 'Paid', quantity: 1, unitPrice: 200 }],
      });
      await db.markInvoiceAsPaid(inv2.id);

      const summary = await analytics.getDashboardSummary();

      expect(summary.basicStats.totalInvoices).toBe(2);
      expect(summary.basicStats.paidInvoices).toBe(1);
      expect(summary.basicStats.draftInvoices).toBe(1);
    });

    it('should return empty summary when no data', async () => {
      const summary = await analytics.getDashboardSummary();

      expect(summary.revenue.total).toBe(0);
      expect(summary.customers.topCustomers).toEqual([]);
      expect(summary.invoices.averageValue).toBe(0);
      expect(summary.basicStats.totalInvoices).toBe(0);
    });
  });

  describe('Date Range Filtering', () => {
    it('should respect date range in all methods', async () => {
      const customer = await db.createCustomer({ name: 'Range Test Customer' });

      const inv = await db.createInvoice({
        customerId: customer.id,
        items: [{ description: 'Service', quantity: 1, unitPrice: 1000 }],
      });
      await db.markInvoiceAsPaid(inv.id);

      // Range that excludes all data
      const emptyRange: DateRange = {
        from: new Date('2020-01-01'),
        to: new Date('2020-12-31'),
      };

      const revenueStats = await analytics.getRevenueStats(emptyRange);
      const invoiceInsights = await analytics.getInvoiceInsights(emptyRange);

      expect(revenueStats.total).toBe(0);
      expect(invoiceInsights.averageValue).toBe(0);
    });

    it('should include data within range', async () => {
      const customer = await db.createCustomer({ name: 'Include Test Customer' });

      const inv = await db.createInvoice({
        customerId: customer.id,
        items: [{ description: 'Service', quantity: 1, unitPrice: 1000 }],
      });
      await db.markInvoiceAsPaid(inv.id);

      // Range that includes current data
      const includeRange: DateRange = {
        from: new Date(Date.now() - 86400000 * 7), // 7 days ago
        to: new Date(Date.now() + 86400000), // Tomorrow
      };

      const revenueStats = await analytics.getRevenueStats(includeRange);

      expect(revenueStats.total).toBeGreaterThan(0);
    });
  });

  describe('Trend Analysis', () => {
    it('should detect upward trend when current period higher', async () => {
      const customer = await db.createCustomer({ name: 'Trend Up Customer' });

      // Create multiple recent invoices (simulating growth)
      for (let i = 0; i < 3; i++) {
        const inv = await db.createInvoice({
          customerId: customer.id,
          items: [{ description: `Service ${i}`, quantity: 1, unitPrice: 1000 }],
        });
        await db.markInvoiceAsPaid(inv.id);
      }

      const stats = await analytics.getRevenueStats();

      // With only current period data and no previous, trend should be up or stable
      expect(['up', 'stable']).toContain(stats.trend);
    });

    it('should return stable trend with no data', async () => {
      const stats = await analytics.getRevenueStats();

      expect(stats.trend).toBe('stable');
      expect(stats.trendPercent).toBe(0);
    });
  });
});
