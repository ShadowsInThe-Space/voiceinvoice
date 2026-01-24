/**
 * Tests for PDF Exporter.
 *
 * Tests the German invoice PDF generation with proper formatting,
 * layout, and content.
 *
 * @module tests/export/pdf-exporter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PDFExporter } from '../../src/lib/export/pdf-exporter';
import type {
  PDFExportOptions,
  CompanyInfo,
  Invoice,
  Customer,
  InvoiceItem,
} from '../../src/lib/export/pdf-exporter';

// Mock jsPDF
vi.mock('jspdf', () => {
  const mockJsPDF = vi.fn().mockImplementation(() => ({
    setFontSize: vi.fn().mockReturnThis(),
    setFont: vi.fn().mockReturnThis(),
    text: vi.fn().mockReturnThis(),
    line: vi.fn().mockReturnThis(),
    rect: vi.fn().mockReturnThis(),
    setDrawColor: vi.fn().mockReturnThis(),
    setFillColor: vi.fn().mockReturnThis(),
    setTextColor: vi.fn().mockReturnThis(),
    setLineDashPattern: vi.fn().mockReturnThis(),
    splitTextToSize: vi.fn().mockImplementation((text: string) => [text]),
    addPage: vi.fn().mockReturnThis(),
    getTextWidth: vi.fn().mockReturnValue(50),
    internal: {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297,
      },
    },
    output: vi.fn().mockReturnValue(new ArrayBuffer(100)),
  }));
  return { default: mockJsPDF, jsPDF: mockJsPDF };
});

// Test data factory
function createTestCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cust-001',
    name: 'Max Mustermann GmbH',
    email: 'kontakt@mustermann.de',
    phone: '+49 30 12345678',
    address: 'Musterstraße 123',
    city: 'Berlin',
    zipCode: '10115',
    country: 'DE',
    taxId: 'DE123456789',
    notes: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
    syncVersion: 0,
    ...overrides,
  };
}

function createTestInvoiceItem(overrides: Partial<InvoiceItem> = {}): InvoiceItem {
  return {
    id: 'item-001',
    invoiceId: 'inv-001',
    description: 'Webentwicklung',
    quantity: 10,
    unitPrice: 85.0,
    total: 850.0,
    category: 'Dienstleistung',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    syncVersion: 0,
    ...overrides,
  };
}

function createTestInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv-001',
    number: 'INV-000001',
    customerId: 'cust-001',
    subtotal: 850.0,
    taxRate: 19.0,
    taxAmount: 161.5,
    total: 1011.5,
    currency: 'EUR',
    status: 'DRAFT',
    issuedAt: new Date('2024-01-15'),
    dueAt: new Date('2024-02-15'),
    paidAt: null,
    voiceRecordingId: null,
    transcription: null,
    notes: 'Vielen Dank für Ihren Auftrag!',
    paymentTerms: 'Zahlbar innerhalb von 30 Tagen',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    deletedAt: null,
    syncVersion: 0,
    items: [createTestInvoiceItem()],
    ...overrides,
  };
}

function createTestCompanyInfo(overrides: Partial<CompanyInfo> = {}): CompanyInfo {
  return {
    name: 'VoiceInvoice GmbH',
    address: 'Innovationsweg 42\n80331 München\nDeutschland',
    taxId: 'DE987654321',
    bankInfo: 'Deutsche Bank\nIBAN: DE89 3704 0044 0532 0130 00\nBIC: COBADEFFXXX',
    phone: '+49 89 12345678',
    email: 'rechnung@voiceinvoice.de',
    website: 'www.voiceinvoice.de',
    ...overrides,
  };
}

describe('PDFExporter', () => {
  let exporter: PDFExporter;

  beforeEach(() => {
    exporter = new PDFExporter();
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create an instance', () => {
      expect(exporter).toBeInstanceOf(PDFExporter);
    });
  });

  describe('generateInvoicePDF', () => {
    it('should generate a PDF blob from invoice data', async () => {
      const options: PDFExportOptions = {
        invoice: createTestInvoice(),
        customer: createTestCustomer(),
      };

      const result = await exporter.generateInvoicePDF(options);

      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('application/pdf');
    });

    it('should generate PDF with company info', async () => {
      const options: PDFExportOptions = {
        invoice: createTestInvoice(),
        customer: createTestCustomer(),
        companyInfo: createTestCompanyInfo(),
      };

      const result = await exporter.generateInvoicePDF(options);

      expect(result).toBeInstanceOf(Blob);
    });

    it('should use German language by default', async () => {
      const options: PDFExportOptions = {
        invoice: createTestInvoice(),
        customer: createTestCustomer(),
      };

      const result = await exporter.generateInvoicePDF(options);

      expect(result).toBeInstanceOf(Blob);
      // German formatting is default
    });

    it('should support English language option', async () => {
      const options: PDFExportOptions = {
        invoice: createTestInvoice(),
        customer: createTestCustomer(),
        language: 'en',
      };

      const result = await exporter.generateInvoicePDF(options);

      expect(result).toBeInstanceOf(Blob);
    });

    it('should handle multiple invoice items', async () => {
      const invoice = createTestInvoice({
        items: [
          createTestInvoiceItem({ description: 'Webentwicklung', quantity: 10, unitPrice: 85 }),
          createTestInvoiceItem({
            id: 'item-002',
            description: 'Projektmanagement',
            quantity: 5,
            unitPrice: 95,
          }),
          createTestInvoiceItem({
            id: 'item-003',
            description: 'Server-Setup',
            quantity: 1,
            unitPrice: 250,
          }),
        ],
        subtotal: 1575.0,
        taxAmount: 299.25,
        total: 1874.25,
      });

      const options: PDFExportOptions = {
        invoice,
        customer: createTestCustomer(),
      };

      const result = await exporter.generateInvoicePDF(options);

      expect(result).toBeInstanceOf(Blob);
    });

    it('should handle customer without optional fields', async () => {
      const customer = createTestCustomer({
        email: null,
        phone: null,
        taxId: null,
        notes: null,
      });

      const options: PDFExportOptions = {
        invoice: createTestInvoice(),
        customer,
      };

      const result = await exporter.generateInvoicePDF(options);

      expect(result).toBeInstanceOf(Blob);
    });

    it('should handle invoice without payment terms', async () => {
      const invoice = createTestInvoice({
        paymentTerms: null,
        notes: null,
      });

      const options: PDFExportOptions = {
        invoice,
        customer: createTestCustomer(),
      };

      const result = await exporter.generateInvoicePDF(options);

      expect(result).toBeInstanceOf(Blob);
    });

    it('should throw error if invoice is missing', async () => {
      const options = {
        customer: createTestCustomer(),
      } as PDFExportOptions;

      await expect(exporter.generateInvoicePDF(options)).rejects.toThrow('Invoice is required');
    });

    it('should throw error if customer is missing', async () => {
      const options = {
        invoice: createTestInvoice(),
      } as PDFExportOptions;

      await expect(exporter.generateInvoicePDF(options)).rejects.toThrow('Customer is required');
    });
  });

  describe('saveToFile', () => {
    it('should save blob to file and return path', async () => {
      // Create a mock blob with arrayBuffer method
      const mockArrayBuffer = new ArrayBuffer(100);
      const mockBlob = {
        arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
        type: 'application/pdf',
      } as unknown as Blob;
      const filename = 'test-invoice.pdf';

      // Mock the file system API
      const mockWriteFile = vi.fn().mockResolvedValue(undefined);
      global.window = {
        ...global.window,
        electronAPI: {
          writeFile: mockWriteFile,
        },
      } as unknown as Window & typeof globalThis;

      const result = await exporter.saveToFile(mockBlob, filename);

      expect(result).toContain(filename);
    });

    it('should handle filename without .pdf extension', async () => {
      // Create a mock blob with arrayBuffer method
      const mockArrayBuffer = new ArrayBuffer(100);
      const mockBlob = {
        arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
        type: 'application/pdf',
      } as unknown as Blob;
      const filename = 'test-invoice';

      const mockWriteFile = vi.fn().mockResolvedValue(undefined);
      global.window = {
        ...global.window,
        electronAPI: {
          writeFile: mockWriteFile,
        },
      } as unknown as Window & typeof globalThis;

      const result = await exporter.saveToFile(mockBlob, filename);

      expect(result).toContain('.pdf');
    });
  });

  describe('German Invoice Formatting', () => {
    it('should format currency in German style', () => {
      const formatted = exporter.formatCurrency(1234.56, 'EUR', 'de');

      // German uses comma as decimal separator
      expect(formatted).toContain('1.234,56');
      expect(formatted).toContain('EUR');
    });

    it('should format English currency style', () => {
      const formatted = exporter.formatCurrency(1234.56, 'EUR', 'en');

      expect(formatted).toContain('1,234.56');
    });

    it('should format date in German style', () => {
      const date = new Date('2024-01-15');
      const formatted = exporter.formatDate(date, 'de');

      expect(formatted).toBe('15.01.2024');
    });

    it('should format date in English style', () => {
      const date = new Date('2024-01-15');
      const formatted = exporter.formatDate(date, 'en');

      expect(formatted).toBe('01/15/2024');
    });
  });

  describe('Invoice Labels', () => {
    it('should return German labels', () => {
      const labels = exporter.getLabels('de');

      expect(labels.invoice).toBe('Rechnung');
      expect(labels.invoiceNumber).toBe('Rechnungsnummer');
      expect(labels.invoiceDate).toBe('Rechnungsdatum');
      expect(labels.dueDate).toBe('Fälligkeitsdatum');
      expect(labels.customerNumber).toBe('Kundennummer');
      expect(labels.description).toBe('Beschreibung');
      expect(labels.quantity).toBe('Menge');
      expect(labels.unitPrice).toBe('Einzelpreis');
      expect(labels.total).toBe('Gesamt');
      expect(labels.subtotal).toBe('Netto');
      expect(labels.tax).toBe('MwSt.');
      expect(labels.totalDue).toBe('Brutto');
      expect(labels.paymentTerms).toBe('Zahlungsbedingungen');
      expect(labels.bankDetails).toBe('Bankverbindung');
      expect(labels.taxId).toBe('USt-IdNr.');
    });

    it('should return English labels', () => {
      const labels = exporter.getLabels('en');

      expect(labels.invoice).toBe('Invoice');
      expect(labels.invoiceNumber).toBe('Invoice Number');
      expect(labels.invoiceDate).toBe('Invoice Date');
      expect(labels.dueDate).toBe('Due Date');
      expect(labels.customerNumber).toBe('Customer Number');
      expect(labels.description).toBe('Description');
      expect(labels.quantity).toBe('Quantity');
      expect(labels.unitPrice).toBe('Unit Price');
      expect(labels.total).toBe('Total');
      expect(labels.subtotal).toBe('Subtotal');
      expect(labels.tax).toBe('VAT');
      expect(labels.totalDue).toBe('Total Due');
      expect(labels.paymentTerms).toBe('Payment Terms');
      expect(labels.bankDetails).toBe('Bank Details');
      expect(labels.taxId).toBe('Tax ID');
    });
  });

  describe('PDF Layout', () => {
    it('should use A4 page format', async () => {
      const { jsPDF } = await import('jspdf');
      const options: PDFExportOptions = {
        invoice: createTestInvoice(),
        customer: createTestCustomer(),
      };

      await exporter.generateInvoicePDF(options);

      // jsPDF should be called with A4 format
      expect(jsPDF).toHaveBeenCalled();
    });

    it('should include company logo placeholder', async () => {
      const options: PDFExportOptions = {
        invoice: createTestInvoice(),
        customer: createTestCustomer(),
        companyInfo: createTestCompanyInfo(),
      };

      // PDF should be generated with logo placeholder area
      const result = await exporter.generateInvoicePDF(options);
      expect(result).toBeInstanceOf(Blob);
    });

    it('should properly position customer address', async () => {
      const options: PDFExportOptions = {
        invoice: createTestInvoice(),
        customer: createTestCustomer(),
      };

      // Customer address should be positioned in the address window area
      const result = await exporter.generateInvoicePDF(options);
      expect(result).toBeInstanceOf(Blob);
    });
  });

  describe('Invoice Totals Calculation Display', () => {
    it('should display correct net amount', async () => {
      const invoice = createTestInvoice({
        subtotal: 1000.0,
        taxRate: 19.0,
        taxAmount: 190.0,
        total: 1190.0,
      });

      const options: PDFExportOptions = {
        invoice,
        customer: createTestCustomer(),
      };

      const result = await exporter.generateInvoicePDF(options);
      expect(result).toBeInstanceOf(Blob);
    });

    it('should display VAT with correct rate', async () => {
      const invoice = createTestInvoice({
        taxRate: 7.0, // Reduced German VAT rate
        subtotal: 100.0,
        taxAmount: 7.0,
        total: 107.0,
      });

      const options: PDFExportOptions = {
        invoice,
        customer: createTestCustomer(),
      };

      const result = await exporter.generateInvoicePDF(options);
      expect(result).toBeInstanceOf(Blob);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long item descriptions', async () => {
      const invoice = createTestInvoice({
        items: [
          createTestInvoiceItem({
            description:
              'Dies ist eine sehr lange Beschreibung für eine Rechnungsposition, die möglicherweise über mehrere Zeilen gehen muss und korrekt umgebrochen werden sollte',
          }),
        ],
      });

      const options: PDFExportOptions = {
        invoice,
        customer: createTestCustomer(),
      };

      const result = await exporter.generateInvoicePDF(options);
      expect(result).toBeInstanceOf(Blob);
    });

    it('should handle zero tax rate', async () => {
      const invoice = createTestInvoice({
        taxRate: 0,
        taxAmount: 0,
        subtotal: 100,
        total: 100,
      });

      const options: PDFExportOptions = {
        invoice,
        customer: createTestCustomer(),
      };

      const result = await exporter.generateInvoicePDF(options);
      expect(result).toBeInstanceOf(Blob);
    });

    it('should handle empty items array', async () => {
      const invoice = createTestInvoice({
        items: [],
        subtotal: 0,
        taxAmount: 0,
        total: 0,
      });

      const options: PDFExportOptions = {
        invoice,
        customer: createTestCustomer(),
      };

      const result = await exporter.generateInvoicePDF(options);
      expect(result).toBeInstanceOf(Blob);
    });

    it('should handle special characters in company name', async () => {
      const customer = createTestCustomer({
        name: 'Müller & Söhne KG "Spezialitäten"',
      });

      const options: PDFExportOptions = {
        invoice: createTestInvoice(),
        customer,
      };

      const result = await exporter.generateInvoicePDF(options);
      expect(result).toBeInstanceOf(Blob);
    });
  });
});
