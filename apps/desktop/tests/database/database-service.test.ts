/**
 * Tests for DatabaseService.
 *
 * Tests the core database operations using Prisma with SQLite.
 * Uses an in-memory database for testing.
 *
 * @module tests/database/database-service
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '../../src/generated/prisma';
import {
  DatabaseService,
  CreateCustomerInput,
  CreateInvoiceInput,
} from '../../src/lib/database/database-service';

// Use in-memory SQLite for tests
const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file::memory:?cache=shared',
    },
  },
});

describe('DatabaseService', () => {
  let db: DatabaseService;

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

  describe('Customer Operations', () => {
    describe('createCustomer', () => {
      it('should create a customer with required fields', async () => {
        const input: CreateCustomerInput = {
          name: 'Test Company GmbH',
        };

        const customer = await db.createCustomer(input);

        expect(customer.id).toBeDefined();
        expect(customer.name).toBe('Test Company GmbH');
        expect(customer.country).toBe('DE');
      });

      it('should create a customer with all fields', async () => {
        const input: CreateCustomerInput = {
          name: 'Full Company GmbH',
          email: 'contact@fullcompany.de',
          phone: '+49 30 12345678',
          address: 'Hauptstraße 1',
          city: 'Berlin',
          zipCode: '10115',
          country: 'DE',
          taxId: 'DE123456789',
          notes: 'Important customer',
        };

        const customer = await db.createCustomer(input);

        expect(customer.email).toBe('contact@fullcompany.de');
        expect(customer.phone).toBe('+49 30 12345678');
        expect(customer.taxId).toBe('DE123456789');
      });
    });

    describe('getCustomerById', () => {
      it('should retrieve customer by id', async () => {
        const created = await db.createCustomer({ name: 'Retrieve Test' });

        const customer = await db.getCustomerById(created.id);

        expect(customer).not.toBeNull();
        expect(customer?.name).toBe('Retrieve Test');
      });

      it('should return null for non-existent id', async () => {
        const customer = await db.getCustomerById('non-existent-id');

        expect(customer).toBeNull();
      });

      it('should not return soft-deleted customers', async () => {
        const created = await db.createCustomer({ name: 'To Delete' });
        await db.softDeleteCustomer(created.id);

        const customer = await db.getCustomerById(created.id);

        expect(customer).toBeNull();
      });
    });

    describe('getAllCustomers', () => {
      it('should return all non-deleted customers', async () => {
        await db.createCustomer({ name: 'Customer 1' });
        await db.createCustomer({ name: 'Customer 2' });
        const toDelete = await db.createCustomer({ name: 'Customer 3' });
        await db.softDeleteCustomer(toDelete.id);

        const customers = await db.getAllCustomers();

        expect(customers).toHaveLength(2);
      });

      it('should return empty array when no customers', async () => {
        const customers = await db.getAllCustomers();

        expect(customers).toEqual([]);
      });
    });

    describe('getAllCustomerNames', () => {
      it('should return all non-deleted customer names', async () => {
        await db.createCustomer({ name: 'Alpha' });
        await db.createCustomer({ name: 'Beta' });
        const toDelete = await db.createCustomer({ name: 'Gamma' });
        await db.softDeleteCustomer(toDelete.id);

        const names = await db.getAllCustomerNames();

        expect(names).toEqual(['Alpha', 'Beta']);
      });

      it('should return empty array when no customers', async () => {
        const names = await db.getAllCustomerNames();

        expect(names).toEqual([]);
      });
    });

    describe('updateCustomer', () => {
      it('should update customer fields', async () => {
        const created = await db.createCustomer({ name: 'Original Name' });

        const updated = await db.updateCustomer(created.id, {
          name: 'Updated Name',
          email: 'new@email.de',
        });

        expect(updated.name).toBe('Updated Name');
        expect(updated.email).toBe('new@email.de');
      });

      it('should increment syncVersion on update', async () => {
        const created = await db.createCustomer({ name: 'Sync Test' });
        const originalVersion = created.syncVersion;

        const updated = await db.updateCustomer(created.id, { name: 'Updated' });

        expect(updated.syncVersion).toBe(originalVersion + 1);
      });
    });

    describe('softDeleteCustomer', () => {
      it('should set deletedAt timestamp', async () => {
        const created = await db.createCustomer({ name: 'To Soft Delete' });

        await db.softDeleteCustomer(created.id);

        // Direct query to check deletedAt
        const result = await testPrisma.$queryRawUnsafe<{ deletedAt: Date | null }[]>(
          'SELECT deletedAt FROM Customer WHERE id = ?',
          created.id
        );
        expect(result[0].deletedAt).not.toBeNull();
      });
    });

    describe('searchCustomers', () => {
      it('should search by name', async () => {
        await db.createCustomer({ name: 'ABC Company' });
        await db.createCustomer({ name: 'XYZ Corp' });
        await db.createCustomer({ name: 'ABC Industries' });

        const results = await db.searchCustomers('ABC');

        expect(results).toHaveLength(2);
      });

      it('should search by email', async () => {
        await db.createCustomer({ name: 'Test 1', email: 'test@example.com' });
        await db.createCustomer({ name: 'Test 2', email: 'other@domain.de' });

        const results = await db.searchCustomers('example');

        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Test 1');
      });
    });
  });

  describe('Invoice Operations', () => {
    let customerId: string;

    beforeEach(async () => {
      const customer = await db.createCustomer({ name: 'Invoice Test Customer' });
      customerId = customer.id;
    });

    describe('createInvoice', () => {
      it('should create invoice with items', async () => {
        const input: CreateInvoiceInput = {
          customerId,
          items: [
            { description: 'Service A', quantity: 2, unitPrice: 100 },
            { description: 'Service B', quantity: 1, unitPrice: 50 },
          ],
        };

        const invoice = await db.createInvoice(input);

        expect(invoice.id).toBeDefined();
        expect(invoice.number).toMatch(/^INV-\d{6}$/);
        expect(invoice.subtotal).toBe(250); // 2*100 + 1*50
        expect(invoice.taxAmount).toBe(47.5); // 19% of 250
        expect(invoice.total).toBe(297.5);
        expect(invoice.status).toBe('DRAFT');
      });

      it('should auto-generate invoice number', async () => {
        const invoice1 = await db.createInvoice({
          customerId,
          items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
        });
        const invoice2 = await db.createInvoice({
          customerId,
          items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
        });

        expect(invoice1.number).not.toBe(invoice2.number);
      });

      it('should apply custom tax rate', async () => {
        const input: CreateInvoiceInput = {
          customerId,
          taxRate: 7, // Reduced German VAT
          items: [{ description: 'Food', quantity: 1, unitPrice: 100 }],
        };

        const invoice = await db.createInvoice(input);

        expect(invoice.taxRate).toBe(7);
        expect(invoice.taxAmount).toBeCloseTo(7, 2);
        expect(invoice.total).toBeCloseTo(107, 2);
      });
    });

    describe('getInvoiceById', () => {
      it('should retrieve invoice with items and customer', async () => {
        const created = await db.createInvoice({
          customerId,
          items: [{ description: 'Test', quantity: 1, unitPrice: 100 }],
        });

        const invoice = await db.getInvoiceById(created.id);

        expect(invoice).not.toBeNull();
        expect(invoice?.items).toHaveLength(1);
        expect(invoice?.customer).toBeDefined();
        expect(invoice?.customer.name).toBe('Invoice Test Customer');
      });
    });

    describe('getAllInvoices', () => {
      it('should return all non-deleted invoices', async () => {
        await db.createInvoice({
          customerId,
          items: [{ description: 'A', quantity: 1, unitPrice: 100 }],
        });
        await db.createInvoice({
          customerId,
          items: [{ description: 'B', quantity: 1, unitPrice: 200 }],
        });

        const invoices = await db.getAllInvoices();

        expect(invoices).toHaveLength(2);
      });
    });

    describe('updateInvoice', () => {
      it('should update invoice status', async () => {
        const created = await db.createInvoice({
          customerId,
          items: [{ description: 'Test', quantity: 1, unitPrice: 100 }],
        });

        const updated = await db.updateInvoice(created.id, {
          status: 'SENT',
          issuedAt: new Date(),
        });

        expect(updated.status).toBe('SENT');
        expect(updated.issuedAt).toBeDefined();
      });

      it('should update notes and payment terms', async () => {
        const created = await db.createInvoice({
          customerId,
          items: [{ description: 'Test', quantity: 1, unitPrice: 100 }],
        });

        const updated = await db.updateInvoice(created.id, {
          notes: 'Thank you for your business',
          paymentTerms: 'Net 30',
        });

        expect(updated.notes).toBe('Thank you for your business');
        expect(updated.paymentTerms).toBe('Net 30');
      });
    });

    describe('markInvoiceAsPaid', () => {
      it('should set status to PAID and paidAt timestamp', async () => {
        const created = await db.createInvoice({
          customerId,
          items: [{ description: 'Test', quantity: 1, unitPrice: 100 }],
        });

        const paid = await db.markInvoiceAsPaid(created.id);

        expect(paid.status).toBe('PAID');
        expect(paid.paidAt).toBeDefined();
      });
    });

    describe('getInvoicesByStatus', () => {
      it('should filter invoices by status', async () => {
        const inv1 = await db.createInvoice({
          customerId,
          items: [{ description: 'A', quantity: 1, unitPrice: 100 }],
        });
        await db.createInvoice({
          customerId,
          items: [{ description: 'B', quantity: 1, unitPrice: 100 }],
        });
        await db.updateInvoice(inv1.id, { status: 'SENT' });

        const sentInvoices = await db.getInvoicesByStatus('SENT');
        const draftInvoices = await db.getInvoicesByStatus('DRAFT');

        expect(sentInvoices).toHaveLength(1);
        expect(draftInvoices).toHaveLength(1);
      });
    });

    describe('getInvoicesByCustomer', () => {
      it('should return all invoices for a customer', async () => {
        const customer2 = await db.createCustomer({ name: 'Other Customer' });

        await db.createInvoice({
          customerId,
          items: [{ description: 'A', quantity: 1, unitPrice: 100 }],
        });
        await db.createInvoice({
          customerId,
          items: [{ description: 'B', quantity: 1, unitPrice: 100 }],
        });
        await db.createInvoice({
          customerId: customer2.id,
          items: [{ description: 'C', quantity: 1, unitPrice: 100 }],
        });

        const invoices = await db.getInvoicesByCustomer(customerId);

        expect(invoices).toHaveLength(2);
      });
    });

    describe('n8n Integration', () => {
      beforeEach(() => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({}),
        });
      });

      afterEach(() => {
        vi.restoreAllMocks();
      });

      it('should trigger webhook when status changes and URL is set', async () => {
        const url = 'https://n8n.example.com/webhook/test';
        await db.setSetting('n8nWebhookUrl', url);

        const invoice = await db.createInvoice({
          customerId,
          items: [{ description: 'Test', quantity: 1, unitPrice: 100 }],
        });

        await db.updateInvoice(invoice.id, { status: 'SENT' });

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledWith(
          url,
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining(invoice.number),
          })
        );
      });

      it('should not trigger webhook if URL is not set', async () => {
        // Ensure no setting
        await db.deleteSetting('n8nWebhookUrl');

        const invoice = await db.createInvoice({
          customerId,
          items: [{ description: 'Test', quantity: 1, unitPrice: 100 }],
        });

        await db.updateInvoice(invoice.id, { status: 'SENT' });

        expect(fetch).not.toHaveBeenCalled();
      });

      it('should not trigger webhook if status does not change', async () => {
        const url = 'https://n8n.example.com/webhook/test';
        await db.setSetting('n8nWebhookUrl', url);

        const invoice = await db.createInvoice({
          customerId,
          items: [{ description: 'Test', quantity: 1, unitPrice: 100 }],
        });

        // Initial status is DRAFT. Update with DRAFT.
        await db.updateInvoice(invoice.id, { status: 'DRAFT' });

        expect(fetch).not.toHaveBeenCalled();
      });

      it('should gracefully handle fetch errors', async () => {
        const url = 'https://n8n.example.com/webhook/fail';
        await db.setSetting('n8nWebhookUrl', url);

        // Mock fetch failure
        global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        const invoice = await db.createInvoice({
          customerId,
          items: [{ description: 'Test', quantity: 1, unitPrice: 100 }],
        });

        // Should not throw
        await expect(db.updateInvoice(invoice.id, { status: 'SENT' })).resolves.toBeDefined();

        expect(fetch).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Settings Operations', () => {
    describe('setSetting', () => {
      it('should create new setting', async () => {
        await db.setSetting('company_name', 'VoiceInvoice GmbH');

        const value = await db.getSetting('company_name');
        expect(value).toBe('VoiceInvoice GmbH');
      });

      it('should update existing setting', async () => {
        await db.setSetting('theme', 'light');
        await db.setSetting('theme', 'dark');

        const value = await db.getSetting('theme');
        expect(value).toBe('dark');
      });
    });

    describe('getSetting', () => {
      it('should return null for non-existent key', async () => {
        const value = await db.getSetting('non_existent_key');

        expect(value).toBeNull();
      });

      it('should return default value when provided', async () => {
        const value = await db.getSetting('non_existent', 'default_value');

        expect(value).toBe('default_value');
      });
    });

    describe('getAllSettings', () => {
      it('should return all settings as object', async () => {
        await db.setSetting('key1', 'value1');
        await db.setSetting('key2', 'value2');

        const settings = await db.getAllSettings();

        expect(settings).toEqual({
          key1: 'value1',
          key2: 'value2',
        });
      });
    });

    describe('deleteSetting', () => {
      it('should remove setting', async () => {
        await db.setSetting('to_delete', 'value');
        await db.deleteSetting('to_delete');

        const value = await db.getSetting('to_delete');
        expect(value).toBeNull();
      });
    });
  });

  describe('Statistics', () => {
    describe('getInvoiceStatistics', () => {
      it('should calculate invoice statistics', async () => {
        const customer = await db.createCustomer({ name: 'Stats Customer' });

        await db.createInvoice({
          customerId: customer.id,
          items: [{ description: 'A', quantity: 1, unitPrice: 1000 }],
        });
        const inv2 = await db.createInvoice({
          customerId: customer.id,
          items: [{ description: 'B', quantity: 1, unitPrice: 2000 }],
        });
        await db.markInvoiceAsPaid(inv2.id);

        const stats = await db.getInvoiceStatistics();

        expect(stats.totalInvoices).toBe(2);
        expect(stats.paidInvoices).toBe(1);
        expect(stats.draftInvoices).toBe(1);
        expect(stats.totalRevenue).toBeGreaterThan(0);
      });
    });
  });
});
