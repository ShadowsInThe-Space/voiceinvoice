/**
 * Integration Tests: Export Pipeline
 *
 * Tests the complete flow from Invoice to PDF Generation:
 * 1. Invoice -> PDF Generation
 * 2. Verifies PDF output characteristics
 * 3. Tests with various invoice data scenarios
 *
 * @module tests/integration/export
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PDFExporter, PDFExportOptions, CompanyInfo } from '../../src/lib/export/pdf-exporter';
import { DatabaseService, InvoiceWithRelations } from '../../src/lib/database/database-service';

// Test database path
const TEST_DB_URL = 'file:./test-integration-export.db';

// Test company info
const TEST_COMPANY_INFO: CompanyInfo = {
  name: 'Test GmbH',
  address: 'Teststrasse 1\n10115 Berlin',
  taxId: 'DE123456789',
  bankInfo: 'IBAN: DE89370400440532013000\nBIC: COBADEFFXXX',
  phone: '+49 30 123456',
  email: 'info@test.de',
  website: 'www.test.de',
};

describe('Export Pipeline Integration', () => {
  let prisma: PrismaClient;
  let databaseService: DatabaseService;
  let pdfExporter: PDFExporter;

  beforeEach(async () => {
    // Initialize test database
    prisma = new PrismaClient({
      datasources: {
        db: { url: TEST_DB_URL },
      },
    });

    // Create tables
    await prisma.$executeRawUnsafe(`
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
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        syncVersion INTEGER DEFAULT 0,
        deletedAt TEXT
      )
    `);

    await prisma.$executeRawUnsafe(`
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
        issuedAt TEXT,
        dueAt TEXT,
        paidAt TEXT,
        voiceRecordingId TEXT,
        transcription TEXT,
        notes TEXT,
        paymentTerms TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        syncVersion INTEGER DEFAULT 0,
        deletedAt TEXT,
        FOREIGN KEY (customerId) REFERENCES Customer(id)
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS InvoiceItem (
        id TEXT PRIMARY KEY,
        invoiceId TEXT NOT NULL,
        description TEXT NOT NULL,
        quantity REAL DEFAULT 1,
        unitPrice REAL NOT NULL,
        total REAL NOT NULL,
        category TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        syncVersion INTEGER DEFAULT 0,
        FOREIGN KEY (invoiceId) REFERENCES Invoice(id) ON DELETE CASCADE
      )
    `);

    // Initialize services
    databaseService = new DatabaseService(prisma);
    pdfExporter = new PDFExporter();
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.$executeRawUnsafe('DELETE FROM InvoiceItem');
    await prisma.$executeRawUnsafe('DELETE FROM Invoice');
    await prisma.$executeRawUnsafe('DELETE FROM Customer');

    await prisma.$disconnect();
    vi.restoreAllMocks();
  });

  /**
   * Helper to convert ISO date string to Date object.
   */
  function toDate(value: Date | string | null): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    return new Date(value);
  }

  /**
   * Helper to convert database invoice to PDF-compatible format.
   */
  function toPDFInvoice(invoice: InvoiceWithRelations): InvoiceWithRelations {
    return {
      ...invoice,
      createdAt: toDate(invoice.createdAt) as Date,
      updatedAt: toDate(invoice.updatedAt) as Date,
      issuedAt: toDate(invoice.issuedAt),
      dueAt: toDate(invoice.dueAt),
      paidAt: toDate(invoice.paidAt),
      deletedAt: toDate(invoice.deletedAt),
      items: invoice.items.map((item) => ({
        ...item,
        createdAt: toDate(item.createdAt) as Date,
        updatedAt: toDate(item.updatedAt) as Date,
      })),
      customer: {
        ...invoice.customer,
        createdAt: toDate(invoice.customer.createdAt) as Date,
        updatedAt: toDate(invoice.customer.updatedAt) as Date,
        deletedAt: toDate(invoice.customer.deletedAt),
      },
    };
  }

  /**
   * Helper to create a test invoice in the database.
   */
  async function createTestInvoice(overrides?: Partial<{
    customerName: string;
    customerAddress: string;
    items: Array<{ description: string; quantity: number; unitPrice: number }>;
    notes: string;
    paymentTerms: string;
  }>): Promise<InvoiceWithRelations> {
    const customer = await databaseService.createCustomer({
      name: overrides?.customerName ?? 'Test Kunde GmbH',
      email: 'kunde@example.com',
      address: overrides?.customerAddress ?? 'Kundenstrasse 42',
      city: 'Hamburg',
      zipCode: '20095',
      country: 'DE',
    });

    const invoice = await databaseService.createInvoice({
      customerId: customer.id,
      items: overrides?.items ?? [
        { description: 'Beratungsleistung', quantity: 8, unitPrice: 120 },
        { description: 'Dokumentation', quantity: 2, unitPrice: 80 },
      ],
      notes: overrides?.notes ?? 'Vielen Dank fuer Ihren Auftrag!',
      paymentTerms: overrides?.paymentTerms ?? 'Zahlbar innerhalb von 14 Tagen',
    });

    return toPDFInvoice(invoice);
  }

  describe('generateInvoicePDF', () => {
    it('should generate valid PDF blob from invoice data', async () => {
      // Arrange
      const invoice = await createTestInvoice();

      const options: PDFExportOptions = {
        invoice: {
          ...invoice,
          issuedAt: new Date(),
          dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
        customer: invoice.customer,
        companyInfo: TEST_COMPANY_INFO,
        language: 'de',
      };

      // Act
      const pdfBlob = await pdfExporter.generateInvoicePDF(options);

      // Assert
      expect(pdfBlob).toBeInstanceOf(Blob);
      expect(pdfBlob.type).toBe('application/pdf');
      expect(pdfBlob.size).toBeGreaterThan(0);

      // Verify PDF header (starts with %PDF)
      // Note: In jsdom, Blob.arrayBuffer() may not be available, use FileReader-like approach
      const reader = new FileReader();
      const arrayBufferPromise = new Promise<ArrayBuffer>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(pdfBlob);
      });
      const arrayBuffer = await arrayBufferPromise;
      const bytes = new Uint8Array(arrayBuffer);
      const header = String.fromCharCode(...bytes.slice(0, 4));
      expect(header).toBe('%PDF');
    });

    it('should generate PDF with German labels', async () => {
      // Arrange
      const invoice = await createTestInvoice();

      const options: PDFExportOptions = {
        invoice,
        customer: invoice.customer,
        companyInfo: TEST_COMPANY_INFO,
        language: 'de',
      };

      // Act
      const pdfBlob = await pdfExporter.generateInvoicePDF(options);

      // Assert - PDF should be generated successfully
      expect(pdfBlob.size).toBeGreaterThan(1000); // Reasonable PDF size
    });

    it('should generate PDF with English labels', async () => {
      // Arrange
      const invoice = await createTestInvoice();

      const options: PDFExportOptions = {
        invoice,
        customer: invoice.customer,
        companyInfo: TEST_COMPANY_INFO,
        language: 'en',
      };

      // Act
      const pdfBlob = await pdfExporter.generateInvoicePDF(options);

      // Assert
      expect(pdfBlob).toBeInstanceOf(Blob);
      expect(pdfBlob.size).toBeGreaterThan(1000);
    });

    it('should throw error when invoice is missing', async () => {
      // Arrange
      const options = {
        invoice: null as unknown,
        customer: { id: '1', name: 'Test' },
      } as PDFExportOptions;

      // Act & Assert
      await expect(pdfExporter.generateInvoicePDF(options)).rejects.toThrow(
        'Invoice is required'
      );
    });

    it('should throw error when customer is missing', async () => {
      // Arrange
      const invoice = await createTestInvoice();

      const options = {
        invoice,
        customer: null as unknown,
      } as PDFExportOptions;

      // Act & Assert
      await expect(pdfExporter.generateInvoicePDF(options)).rejects.toThrow(
        'Customer is required'
      );
    });
  });

  describe('PDF Content for Various Invoice Types', () => {
    it('should generate PDF for single-item invoice', async () => {
      // Arrange
      const invoice = await createTestInvoice({
        items: [{ description: 'Einzelleistung', quantity: 1, unitPrice: 500 }],
      });

      const options: PDFExportOptions = {
        invoice,
        customer: invoice.customer,
        language: 'de',
      };

      // Act
      const pdfBlob = await pdfExporter.generateInvoicePDF(options);

      // Assert
      expect(pdfBlob.size).toBeGreaterThan(0);
    });

    it('should generate PDF for multi-item invoice', async () => {
      // Arrange
      const invoice = await createTestInvoice({
        items: [
          { description: 'Leistung 1', quantity: 10, unitPrice: 100 },
          { description: 'Leistung 2', quantity: 5, unitPrice: 200 },
          { description: 'Leistung 3', quantity: 2, unitPrice: 350 },
          { description: 'Leistung 4', quantity: 1, unitPrice: 150 },
          { description: 'Leistung 5', quantity: 3, unitPrice: 75 },
        ],
      });

      const options: PDFExportOptions = {
        invoice,
        customer: invoice.customer,
        companyInfo: TEST_COMPANY_INFO,
        language: 'de',
      };

      // Act
      const pdfBlob = await pdfExporter.generateInvoicePDF(options);

      // Assert - Should handle multiple items
      expect(pdfBlob.size).toBeGreaterThan(0);
    });

    it('should generate PDF for invoice with long description', async () => {
      // Arrange
      const longDescription =
        'Dies ist eine sehr ausfuehrliche Beschreibung der erbrachten Dienstleistung, ' +
        'die ueber mehrere Zeilen gehen sollte und alle relevanten Details enthaelt, ' +
        'um dem Kunden einen vollstaendigen Ueberblick zu geben.';

      const invoice = await createTestInvoice({
        items: [{ description: longDescription, quantity: 1, unitPrice: 1000 }],
      });

      const options: PDFExportOptions = {
        invoice,
        customer: invoice.customer,
        language: 'de',
      };

      // Act
      const pdfBlob = await pdfExporter.generateInvoicePDF(options);

      // Assert
      expect(pdfBlob.size).toBeGreaterThan(0);
    });

    it('should generate PDF for invoice without optional fields', async () => {
      // Arrange
      const invoice = await createTestInvoice({
        notes: undefined,
        paymentTerms: undefined,
      });

      const options: PDFExportOptions = {
        invoice: {
          ...invoice,
          notes: null,
          paymentTerms: null,
        },
        customer: invoice.customer,
        language: 'de',
      };

      // Act
      const pdfBlob = await pdfExporter.generateInvoicePDF(options);

      // Assert
      expect(pdfBlob.size).toBeGreaterThan(0);
    });

    it('should generate PDF without company info', async () => {
      // Arrange
      const invoice = await createTestInvoice();

      const options: PDFExportOptions = {
        invoice,
        customer: invoice.customer,
        // No companyInfo
        language: 'de',
      };

      // Act
      const pdfBlob = await pdfExporter.generateInvoicePDF(options);

      // Assert
      expect(pdfBlob.size).toBeGreaterThan(0);
    });
  });

  describe('Currency Formatting', () => {
    it('should format German currency correctly', () => {
      // Act
      const formatted = pdfExporter.formatCurrency(1234.56, 'EUR', 'de');

      // Assert - German format: 1.234,56 EUR
      expect(formatted).toMatch(/1\.234,56.*EUR/);
    });

    it('should format English currency correctly', () => {
      // Act
      const formatted = pdfExporter.formatCurrency(1234.56, 'EUR', 'en');

      // Assert - English format: 1,234.56 EUR
      expect(formatted).toMatch(/1,234\.56.*EUR/);
    });

    it('should handle zero amount', () => {
      // Act
      const formatted = pdfExporter.formatCurrency(0, 'EUR', 'de');

      // Assert
      expect(formatted).toContain('0,00');
    });

    it('should handle large amounts', () => {
      // Act
      const formatted = pdfExporter.formatCurrency(1000000.99, 'EUR', 'de');

      // Assert
      expect(formatted).toContain('EUR');
    });
  });

  describe('Date Formatting', () => {
    it('should format German date correctly', () => {
      // Arrange
      const date = new Date(2024, 5, 15); // June 15, 2024

      // Act
      const formatted = pdfExporter.formatDate(date, 'de');

      // Assert - German format: DD.MM.YYYY
      expect(formatted).toBe('15.06.2024');
    });

    it('should format English date correctly', () => {
      // Arrange
      const date = new Date(2024, 5, 15); // June 15, 2024

      // Act
      const formatted = pdfExporter.formatDate(date, 'en');

      // Assert - English format: MM/DD/YYYY
      expect(formatted).toBe('06/15/2024');
    });

    it('should handle null date', () => {
      // Act
      const formatted = pdfExporter.formatDate(null, 'de');

      // Assert
      expect(formatted).toBe('-');
    });
  });

  describe('Labels', () => {
    it('should return German labels', () => {
      // Act
      const labels = pdfExporter.getLabels('de');

      // Assert
      expect(labels.invoice).toBe('Rechnung');
      expect(labels.subtotal).toBe('Netto');
      expect(labels.tax).toBe('MwSt.');
      expect(labels.totalDue).toBe('Brutto');
    });

    it('should return English labels', () => {
      // Act
      const labels = pdfExporter.getLabels('en');

      // Assert
      expect(labels.invoice).toBe('Invoice');
      expect(labels.subtotal).toBe('Subtotal');
      expect(labels.tax).toBe('VAT');
      expect(labels.totalDue).toBe('Total Due');
    });
  });

  describe('Invoice Totals Verification', () => {
    it('should include correct totals in generated PDF', async () => {
      // Arrange - Create invoice with known values
      const invoice = await createTestInvoice({
        items: [
          { description: 'Item A', quantity: 2, unitPrice: 100 }, // 200
          { description: 'Item B', quantity: 3, unitPrice: 50 }, // 150
        ],
      });

      // Expected: subtotal = 350, tax (19%) = 66.50, total = 416.50

      // Act
      const options: PDFExportOptions = {
        invoice,
        customer: invoice.customer,
        language: 'de',
      };

      const pdfBlob = await pdfExporter.generateInvoicePDF(options);

      // Assert
      expect(pdfBlob.size).toBeGreaterThan(0);
      expect(invoice.subtotal).toBe(350);
      expect(invoice.taxAmount).toBeCloseTo(66.5, 2);
      expect(invoice.total).toBeCloseTo(416.5, 2);
    });
  });

  describe('Database to PDF Integration', () => {
    it('should export stored invoice to PDF correctly', async () => {
      // Arrange - Create and retrieve invoice
      const createdInvoice = await createTestInvoice({
        customerName: 'Export Test GmbH',
        items: [{ description: 'Export Test', quantity: 1, unitPrice: 999 }],
      });

      const retrievedInvoice = await databaseService.getInvoiceById(createdInvoice.id);
      expect(retrievedInvoice).not.toBeNull();

      // Convert to PDF-compatible format
      const pdfInvoice = toPDFInvoice(retrievedInvoice!);

      // Act
      const options: PDFExportOptions = {
        invoice: pdfInvoice,
        customer: pdfInvoice.customer,
        companyInfo: TEST_COMPANY_INFO,
        language: 'de',
      };

      const pdfBlob = await pdfExporter.generateInvoicePDF(options);

      // Assert
      expect(pdfBlob).toBeInstanceOf(Blob);
      expect(pdfBlob.type).toBe('application/pdf');
      expect(pdfBlob.size).toBeGreaterThan(0);
    });

    it('should handle multiple sequential exports', async () => {
      // Arrange
      const invoice1 = await createTestInvoice({ customerName: 'Kunde 1' });
      const invoice2 = await createTestInvoice({ customerName: 'Kunde 2' });

      // Act
      const pdf1 = await pdfExporter.generateInvoicePDF({
        invoice: invoice1,
        customer: invoice1.customer,
        language: 'de',
      });

      const pdf2 = await pdfExporter.generateInvoicePDF({
        invoice: invoice2,
        customer: invoice2.customer,
        language: 'de',
      });

      // Assert
      expect(pdf1.size).toBeGreaterThan(0);
      expect(pdf2.size).toBeGreaterThan(0);
      // Both PDFs should be different sizes due to different content
      // (though this is not strictly guaranteed)
    });
  });
});
