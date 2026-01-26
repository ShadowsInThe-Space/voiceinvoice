/**
 * Database service for VoiceInvoice Enterprise.
 *
 * Provides type-safe database operations using Prisma with SQLite.
 * Designed for local-first with sync-ready schema.
 *
 * @module lib/database/database-service
 */

import { PrismaClient, Customer, Invoice, InvoiceItem, Setting } from '@/generated/prisma';

/**
 * Invoice status values.
 */
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';

/**
 * Input for creating a new customer.
 */
export interface CreateCustomerInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  zipCode?: string;
  country?: string;
  taxId?: string;
  notes?: string;
}

/**
 * Input for updating a customer.
 */
export interface UpdateCustomerInput {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  zipCode?: string;
  country?: string;
  taxId?: string;
  notes?: string;
}

/**
 * Input for creating an invoice item.
 */
export interface CreateInvoiceItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  category?: string;
}

/**
 * Input for creating a new invoice.
 */
export interface CreateInvoiceInput {
  customerId: string;
  items: CreateInvoiceItemInput[];
  taxRate?: number;
  notes?: string;
  paymentTerms?: string;
  voiceRecordingId?: string;
  transcription?: string;
}

/**
 * Input for updating an invoice.
 */
export interface UpdateInvoiceInput {
  status?: InvoiceStatus;
  issuedAt?: Date;
  dueAt?: Date;
  paidAt?: Date;
  notes?: string;
  paymentTerms?: string;
  transcription?: string;
}

/**
 * Invoice with related data.
 */
export interface InvoiceWithRelations extends Invoice {
  items: InvoiceItem[];
  customer: Customer;
}

/**
 * Invoice statistics.
 */
export interface InvoiceStatistics {
  totalInvoices: number;
  draftInvoices: number;
  sentInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  cancelledInvoices: number;
  totalRevenue: number;
  totalOutstanding: number;
}

/**
 * Counter for generating invoice numbers.
 */
let invoiceCounter = 0;

/**
 * Generates a unique invoice number.
 */
function generateInvoiceNumber(): string {
  invoiceCounter++;
  const num = invoiceCounter.toString().padStart(6, '0');
  return `INV-${num}`;
}

/**
 * Database service providing CRUD operations for all entities.
 */
export class DatabaseService {
  private prisma: PrismaClient;

  /**
   *
   * @param prisma
   */
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // ==================== Customer Operations ====================

  /**
   * Creates a new customer.
   * @param input
   */
  async createCustomer(input: CreateCustomerInput): Promise<Customer> {
    const id = this.generateId();
    const now = new Date().toISOString();

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO Customer (id, name, email, phone, address, city, zipCode, country, taxId, notes, createdAt, updatedAt, syncVersion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      id,
      input.name,
      input.email ?? null,
      input.phone ?? null,
      input.address ?? null,
      input.city ?? null,
      input.zipCode ?? null,
      input.country ?? 'DE',
      input.taxId ?? null,
      input.notes ?? null,
      now,
      now
    );

    return this.getCustomerByIdInternal(id) as Promise<Customer>;
  }

  /**
   * Gets a customer by ID (excludes soft-deleted).
   * @param id
   */
  async getCustomerById(id: string): Promise<Customer | null> {
    const results = await this.prisma.$queryRawUnsafe<Customer[]>(
      'SELECT * FROM Customer WHERE id = ? AND deletedAt IS NULL',
      id
    );
    return results[0] ?? null;
  }

  /**
   * Gets a customer by ID (internal, includes soft-deleted).
   * @param id
   */
  private async getCustomerByIdInternal(id: string): Promise<Customer | null> {
    const results = await this.prisma.$queryRawUnsafe<Customer[]>(
      'SELECT * FROM Customer WHERE id = ?',
      id
    );
    return results[0] ?? null;
  }

  /**
   * Gets all customers (excludes soft-deleted).
   */
  async getAllCustomers(): Promise<Customer[]> {
    return this.prisma.$queryRawUnsafe<Customer[]>(
      'SELECT * FROM Customer WHERE deletedAt IS NULL ORDER BY name ASC'
    );
  }

  /**
   * Updates a customer.
   * @param id
   * @param input
   */
  async updateCustomer(id: string, input: UpdateCustomerInput): Promise<Customer> {
    const current = await this.getCustomerByIdInternal(id);
    if (!current) {
      throw new Error(`Customer not found: ${id}`);
    }

    const now = new Date().toISOString();
    const newVersion = (current.syncVersion ?? 0) + 1;

    await this.prisma.$executeRawUnsafe(
      `UPDATE Customer SET
        name = ?, email = ?, phone = ?, address = ?, city = ?,
        zipCode = ?, country = ?, taxId = ?, notes = ?,
        updatedAt = ?, syncVersion = ?
       WHERE id = ?`,
      input.name ?? current.name,
      input.email ?? current.email,
      input.phone ?? current.phone,
      input.address ?? current.address,
      input.city ?? current.city,
      input.zipCode ?? current.zipCode,
      input.country ?? current.country,
      input.taxId ?? current.taxId,
      input.notes ?? current.notes,
      now,
      newVersion,
      id
    );

    return this.getCustomerByIdInternal(id) as Promise<Customer>;
  }

  /**
   * Soft deletes a customer.
   * @param id
   */
  async softDeleteCustomer(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.prisma.$executeRawUnsafe(
      'UPDATE Customer SET deletedAt = ?, updatedAt = ? WHERE id = ?',
      now,
      now,
      id
    );
  }

  /**
   * Searches customers by name or email.
   * @param query
   */
  async searchCustomers(query: string): Promise<Customer[]> {
    const pattern = `%${query}%`;
    return this.prisma.$queryRawUnsafe<Customer[]>(
      `SELECT * FROM Customer
       WHERE deletedAt IS NULL
         AND (name LIKE ? OR email LIKE ?)
       ORDER BY name ASC`,
      pattern,
      pattern
    );
  }

  // ==================== Invoice Operations ====================

  /**
   * Creates a new invoice with items.
   * Uses a transaction to ensure Invoice is committed before InvoiceItems are created.
   * @param input
   */
  async createInvoice(input: CreateInvoiceInput): Promise<InvoiceWithRelations> {
    const id = this.generateId();
    const number = generateInvoiceNumber();
    const now = new Date().toISOString();
    const taxRate = input.taxRate ?? 19.0;

    // Calculate totals
    let subtotal = 0;
    for (const item of input.items) {
      subtotal += item.quantity * item.unitPrice;
    }
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    // Use transaction to ensure Invoice exists before InvoiceItems reference it
    await this.prisma.$transaction(async (tx) => {
      // Create invoice first
      await tx.$executeRawUnsafe(
        `INSERT INTO Invoice (
          id, number, customerId, subtotal, taxRate, taxAmount, total, currency,
          status, voiceRecordingId, transcription, notes, paymentTerms,
          createdAt, updatedAt, syncVersion
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'EUR', 'DRAFT', ?, ?, ?, ?, ?, ?, 0)`,
        id,
        number,
        input.customerId,
        subtotal,
        taxRate,
        taxAmount,
        total,
        input.voiceRecordingId ?? null,
        input.transcription ?? null,
        input.notes ?? null,
        input.paymentTerms ?? null,
        now,
        now
      );

      // Then create items within the same transaction
      for (const item of input.items) {
        const itemId = this.generateId();
        const itemTotal = item.quantity * item.unitPrice;

        await tx.$executeRawUnsafe(
          `INSERT INTO InvoiceItem (id, invoiceId, description, quantity, unitPrice, total, category, createdAt, updatedAt, syncVersion)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          itemId,
          id,
          item.description,
          item.quantity,
          item.unitPrice,
          itemTotal,
          item.category ?? null,
          now,
          now
        );
      }
    });

    return this.getInvoiceById(id) as Promise<InvoiceWithRelations>;
  }

  /**
   * Gets an invoice by ID with items and customer.
   * @param id
   */
  async getInvoiceById(id: string): Promise<InvoiceWithRelations | null> {
    const invoices = await this.prisma.$queryRawUnsafe<Invoice[]>(
      'SELECT * FROM Invoice WHERE id = ? AND deletedAt IS NULL',
      id
    );

    if (invoices.length === 0) {
      return null;
    }

    const results = await this.populateRelations(invoices);
    return results[0];
  }

  /**
   * Gets all invoices (excludes soft-deleted).
   */
  async getAllInvoices(): Promise<InvoiceWithRelations[]> {
    const invoices = await this.prisma.$queryRawUnsafe<Invoice[]>(
      'SELECT * FROM Invoice WHERE deletedAt IS NULL ORDER BY createdAt DESC'
    );

    return this.populateRelations(invoices);
  }

  /**
   * Updates an invoice.
   * @param id
   * @param input
   */
  async updateInvoice(id: string, input: UpdateInvoiceInput): Promise<Invoice> {
    const current = await this.getInvoiceById(id);
    if (!current) {
      throw new Error(`Invoice not found: ${id}`);
    }

    const now = new Date().toISOString();
    const newVersion = (current.syncVersion ?? 0) + 1;

    await this.prisma.$executeRawUnsafe(
      `UPDATE Invoice SET
        status = ?, issuedAt = ?, dueAt = ?, paidAt = ?,
        notes = ?, paymentTerms = ?, transcription = ?,
        updatedAt = ?, syncVersion = ?
       WHERE id = ?`,
      input.status ?? current.status,
      input.issuedAt?.toISOString() ?? current.issuedAt,
      input.dueAt?.toISOString() ?? current.dueAt,
      input.paidAt?.toISOString() ?? current.paidAt,
      input.notes ?? current.notes,
      input.paymentTerms ?? current.paymentTerms,
      input.transcription ?? current.transcription,
      now,
      newVersion,
      id
    );

    const updatedInvoice = (await this.getInvoiceById(id)) as InvoiceWithRelations;

    // Trigger n8n webhook if status changed
    if (input.status && input.status !== current.status) {
      await this.sendToN8n(updatedInvoice);
    }

    return updatedInvoice;
  }

  /**
   * Sends invoice data to n8n webhook if URL is configured.
   * @param invoice
   */
  private async sendToN8n(invoice: InvoiceWithRelations): Promise<void> {
    const webhookUrl = await this.getSetting('n8nWebhookUrl');
    if (!webhookUrl) {
      return;
    }

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invoice),
      });
    } catch (error) {
      console.error('Failed to send invoice to n8n:', error);
      // We do not throw here to prevent failing the main operation
    }
  }

  /**
   * Marks an invoice as paid.
   * @param id
   */
  async markInvoiceAsPaid(id: string): Promise<Invoice> {
    return this.updateInvoice(id, {
      status: 'PAID',
      paidAt: new Date(),
    });
  }

  /**
   * Soft deletes an invoice.
   * @param id
   */
  async softDeleteInvoice(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.prisma.$executeRawUnsafe(
      'UPDATE Invoice SET deletedAt = ?, updatedAt = ? WHERE id = ?',
      now,
      now,
      id
    );
  }

  /**
   * Gets invoices by status.
   * @param status
   */
  async getInvoicesByStatus(status: InvoiceStatus): Promise<InvoiceWithRelations[]> {
    const invoices = await this.prisma.$queryRawUnsafe<Invoice[]>(
      'SELECT * FROM Invoice WHERE status = ? AND deletedAt IS NULL ORDER BY createdAt DESC',
      status
    );

    return this.populateRelations(invoices);
  }

  /**
   * Gets invoices by customer.
   * @param customerId
   */
  async getInvoicesByCustomer(customerId: string): Promise<InvoiceWithRelations[]> {
    const invoices = await this.prisma.$queryRawUnsafe<Invoice[]>(
      'SELECT * FROM Invoice WHERE customerId = ? AND deletedAt IS NULL ORDER BY createdAt DESC',
      customerId
    );

    return this.populateRelations(invoices);
  }

  /**
   * Helper to populate relations for a list of invoices efficiently.
   * Avoids N+1 query problem by fetching related data in batches.
   * @param invoices
   */
  private async populateRelations(invoices: Invoice[]): Promise<InvoiceWithRelations[]> {
    if (invoices.length === 0) {
      return [];
    }

    const invoiceIds = invoices.map((inv) => inv.id);
    const customerIds = [...new Set(invoices.map((inv) => inv.customerId))];

    // Build placeholders for IN clauses
    const invoicePlaceholders = invoiceIds.map(() => '?').join(',');
    const customerPlaceholders = customerIds.map(() => '?').join(',');

    const items = await this.prisma.$queryRawUnsafe<InvoiceItem[]>(
      `SELECT * FROM InvoiceItem WHERE invoiceId IN (${invoicePlaceholders})`,
      ...invoiceIds
    );

    const customers = await this.prisma.$queryRawUnsafe<Customer[]>(
      `SELECT * FROM Customer WHERE id IN (${customerPlaceholders})`,
      ...customerIds
    );

    // Create lookup maps
    const itemsMap = new Map<string, InvoiceItem[]>();
    for (const item of items) {
      if (!itemsMap.has(item.invoiceId)) {
        itemsMap.set(item.invoiceId, []);
      }
      itemsMap.get(item.invoiceId)!.push(item);
    }

    const customersMap = new Map<string, Customer>();
    for (const customer of customers) {
      customersMap.set(customer.id, customer);
    }

    // Map relations to invoices
    return invoices.map((invoice) => ({
      ...invoice,
      items: itemsMap.get(invoice.id) || [],
      // Fallback to finding customer in list if map fails (should not happen with referential integrity)
      customer: customersMap.get(invoice.customerId)!,
    }));
  }

  // ==================== Settings Operations ====================

  /**
   * Sets a setting value.
   * @param key
   * @param value
   */
  async setSetting(key: string, value: string): Promise<void> {
    const now = new Date().toISOString();

    // Try to update first
    const result = await this.prisma.$executeRawUnsafe(
      'UPDATE Setting SET value = ?, updatedAt = ? WHERE key = ?',
      value,
      now,
      key
    );

    // If no rows updated, insert
    if (result === 0) {
      await this.prisma.$executeRawUnsafe(
        'INSERT INTO Setting (key, value, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
        key,
        value,
        now,
        now
      );
    }
  }

  /**
   * Gets a setting value.
   * @param key
   * @param defaultValue
   */
  async getSetting(key: string, defaultValue?: string): Promise<string | null> {
    const results = await this.prisma.$queryRawUnsafe<Setting[]>(
      'SELECT * FROM Setting WHERE key = ?',
      key
    );

    if (results.length === 0) {
      return defaultValue ?? null;
    }

    return results[0].value;
  }

  /**
   * Gets all settings as key-value object.
   */
  async getAllSettings(): Promise<Record<string, string>> {
    const results = await this.prisma.$queryRawUnsafe<Setting[]>('SELECT * FROM Setting');

    const settings: Record<string, string> = {};
    for (const setting of results) {
      settings[setting.key] = setting.value;
    }

    return settings;
  }

  /**
   * Deletes a setting.
   * @param key
   */
  async deleteSetting(key: string): Promise<void> {
    await this.prisma.$executeRawUnsafe('DELETE FROM Setting WHERE key = ?', key);
  }

  // ==================== Statistics ====================

  /**
   * Gets invoice statistics.
   */
  async getInvoiceStatistics(): Promise<InvoiceStatistics> {
    const results = await this.prisma.$queryRawUnsafe<
      Array<{ status: string; count: bigint; totalSum: number | null }>
    >(
      `SELECT
         status,
         COUNT(*) as count,
         SUM(total) as totalSum
       FROM Invoice
       WHERE deletedAt IS NULL
       GROUP BY status`
    );

    let totalInvoices = 0;
    let draftInvoices = 0;
    let sentInvoices = 0;
    let paidInvoices = 0;
    let overdueInvoices = 0;
    let cancelledInvoices = 0;
    let totalRevenue = 0;
    let totalOutstanding = 0;

    for (const row of results) {
      const count = Number(row.count);
      const totalSum = row.totalSum ?? 0;

      totalInvoices += count;

      switch (row.status) {
        case 'DRAFT':
          draftInvoices = count;
          break;
        case 'SENT':
          sentInvoices = count;
          totalOutstanding += totalSum;
          break;
        case 'PAID':
          paidInvoices = count;
          totalRevenue += totalSum;
          break;
        case 'OVERDUE':
          overdueInvoices = count;
          totalOutstanding += totalSum;
          break;
        case 'CANCELLED':
          cancelledInvoices = count;
          break;
      }
    }

    return {
      totalInvoices,
      draftInvoices,
      sentInvoices,
      paidInvoices,
      overdueInvoices,
      cancelledInvoices,
      totalRevenue,
      totalOutstanding,
    };
  }

  // ==================== Utility ====================

  /**
   * Generates a unique CUID-like ID.
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `c${timestamp}${random}`;
  }
}
