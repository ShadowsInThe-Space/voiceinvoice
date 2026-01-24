/**
 * Integration Tests: Full Workflow
 *
 * End-to-End Test: Voice Input -> Invoice Creation -> PDF Export -> Voice Confirmation
 * Simulates complete user workflow for VoiceInvoice Enterprise.
 *
 * @module tests/integration/full-workflow
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { VoiceInvoicePipeline, PipelineConfig } from '../../src/lib/pipeline/voice-invoice-pipeline';
import { GeminiClient, TranscriptionResult, InvoiceParseResult } from '../../src/lib/ai/gemini-client';
import { DatabaseService, InvoiceWithRelations } from '../../src/lib/database/database-service';
import { PDFExporter, PDFExportOptions } from '../../src/lib/export/pdf-exporter';
import { TTSClient, VoiceResponseHelper, Invoice as TTSInvoice } from '../../src/lib/tts/tts-client';

// Test database path
const TEST_DB_URL = 'file:./test-integration-workflow.db';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Audio class
class MockAudio {
  src: string = '';
  onplay: (() => void) | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(src?: string) {
    if (src) this.src = src;
  }

  async play(): Promise<void> {
    setTimeout(() => {
      if (this.onplay) this.onplay();
    }, 0);
  }

  pause(): void {}

  simulateEnd(): void {
    if (this.onended) this.onended();
  }
}

// Track audio instances
let audioInstances: MockAudio[] = [];

// Make MockAudio auto-register instances
class RegisteredMockAudio extends MockAudio {
  constructor(src?: string) {
    super(src);
    audioInstances.push(this);
  }
}
(global as unknown as { Audio: typeof MockAudio }).Audio = RegisteredMockAudio;

describe('Full Workflow Integration', () => {
  let prisma: PrismaClient;
  let databaseService: DatabaseService;
  let geminiClient: GeminiClient;
  let pipeline: VoiceInvoicePipeline;
  let pdfExporter: PDFExporter;
  let ttsClient: TTSClient;
  let voiceHelper: VoiceResponseHelper;

  // Mock responses
  const createMockTranscription = (text: string): TranscriptionResult => ({
    success: true,
    text,
    confidence: 0.95,
  });

  const createMockParseResult = (data: {
    customerName: string;
    items: Array<{ description: string; quantity: number; unitPrice: number }>;
    paymentTerms?: string;
  }): InvoiceParseResult => ({
    success: true,
    invoice: {
      customerName: data.customerName,
      items: data.items,
      paymentTerms: data.paymentTerms ?? 'Zahlbar innerhalb von 14 Tagen',
    },
    confidence: 0.9,
  });

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    audioInstances = [];

    // Mock TTS API
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ audioContent: 'bW9ja2VkX2F1ZGlv' }),
    });

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

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS Setting (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    // Initialize services
    databaseService = new DatabaseService(prisma);
    geminiClient = new GeminiClient({ apiKey: 'test-api-key' });
    pdfExporter = new PDFExporter();
    ttsClient = new TTSClient({ apiKey: 'test-tts-key' });
    voiceHelper = new VoiceResponseHelper(ttsClient);

    // Configure pipeline
    const config: PipelineConfig = {
      geminiClient,
      databaseService,
      language: 'de-DE',
      defaultTaxRate: 19,
    };
    pipeline = new VoiceInvoicePipeline(config);
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.$executeRawUnsafe('DELETE FROM InvoiceItem');
    await prisma.$executeRawUnsafe('DELETE FROM Invoice');
    await prisma.$executeRawUnsafe('DELETE FROM Customer');
    await prisma.$executeRawUnsafe('DELETE FROM Setting');

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
   * Helper to convert InvoiceWithRelations to TTS Invoice format.
   */
  function toTTSInvoice(invoice: InvoiceWithRelations): TTSInvoice {
    return {
      id: invoice.id,
      number: invoice.number,
      customerName: invoice.customer.name,
      total: invoice.total,
      items: invoice.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      status: invoice.status.toLowerCase() as 'draft' | 'sent' | 'paid' | 'overdue',
      createdAt: new Date(invoice.createdAt),
    };
  }

  describe('Complete User Workflow', () => {
    it('should complete full workflow: Voice -> Invoice -> PDF -> Confirmation', async () => {
      // ========================================
      // STEP 1: Voice Input -> Transcription -> Invoice
      // ========================================

      // Mock AI responses
      vi.spyOn(geminiClient, 'transcribe').mockResolvedValue(
        createMockTranscription(
          'Rechnung fuer Autohaus Schmidt in Hamburg. Oelwechsel 89 Euro und Reifenwechsel 120 Euro.'
        )
      );

      vi.spyOn(geminiClient, 'parseInvoice').mockResolvedValue(
        createMockParseResult({
          customerName: 'Autohaus Schmidt',
          items: [
            { description: 'Oelwechsel', quantity: 1, unitPrice: 89 },
            { description: 'Reifenwechsel', quantity: 1, unitPrice: 120 },
          ],
        })
      );

      // Simulate audio recording
      const audioBlob = new Blob([new Uint8Array([0, 1, 2, 3])], { type: 'audio/webm' });

      // Process through pipeline
      const pipelineResult = await pipeline.processRecording(audioBlob);

      // Verify pipeline success
      expect(pipelineResult.success).toBe(true);
      expect(pipelineResult.invoice).toBeDefined();
      expect(pipelineResult.invoice?.customer.name).toBe('Autohaus Schmidt');
      expect(pipelineResult.invoice?.items).toHaveLength(2);

      const invoice = pipelineResult.invoice!;

      // Verify totals
      const expectedSubtotal = 89 + 120; // 209
      const expectedTax = expectedSubtotal * 0.19; // 39.71
      const expectedTotal = expectedSubtotal + expectedTax; // 248.71

      expect(invoice.subtotal).toBe(expectedSubtotal);
      expect(invoice.taxAmount).toBeCloseTo(expectedTax, 2);
      expect(invoice.total).toBeCloseTo(expectedTotal, 2);

      // ========================================
      // STEP 2: Invoice -> PDF Export
      // ========================================

      // Convert to PDF-compatible format (Date objects instead of strings)
      const pdfInvoice = toPDFInvoice(invoice);

      const pdfOptions: PDFExportOptions = {
        invoice: pdfInvoice,
        customer: pdfInvoice.customer,
        companyInfo: {
          name: 'Meine Werkstatt GmbH',
          address: 'Werkstattstrasse 1\n22041 Hamburg',
          taxId: 'DE987654321',
          bankInfo: 'IBAN: DE89370400440532013000',
        },
        language: 'de',
      };

      const pdfBlob = await pdfExporter.generateInvoicePDF(pdfOptions);

      // Verify PDF generated
      expect(pdfBlob).toBeInstanceOf(Blob);
      expect(pdfBlob.type).toBe('application/pdf');
      expect(pdfBlob.size).toBeGreaterThan(1000);

      // Verify PDF header using FileReader
      const reader = new FileReader();
      const arrayBufferPromise = new Promise<ArrayBuffer>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(pdfBlob);
      });
      const arrayBuffer = await arrayBufferPromise;
      const header = String.fromCharCode(...new Uint8Array(arrayBuffer).slice(0, 4));
      expect(header).toBe('%PDF');

      // ========================================
      // STEP 3: Voice Confirmation
      // ========================================

      const ttsInvoice = toTTSInvoice(invoice);

      // Start voice confirmation
      const confirmPromise = voiceHelper.confirmInvoiceCreated(ttsInvoice);

      // Simulate audio playback completion
      await new Promise((resolve) => setTimeout(resolve, 50));
      audioInstances[audioInstances.length - 1].simulateEnd();
      await confirmPromise;

      // Verify TTS API was called
      expect(mockFetch).toHaveBeenCalled();

      // Verify correct text was spoken
      const ttsCallBody = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body);
      expect(ttsCallBody.input.text).toContain(invoice.number);
      expect(ttsCallBody.input.text).toContain('Autohaus Schmidt');

      // ========================================
      // STEP 4: Verify Persistence
      // ========================================

      const storedInvoices = await databaseService.getAllInvoices();
      expect(storedInvoices).toHaveLength(1);
      expect(storedInvoices[0].id).toBe(invoice.id);
      expect(storedInvoices[0].transcription).toBeTruthy();
    });
  });

  describe('Workflow: Quick Invoice', () => {
    it('should create invoice from quick voice command', async () => {
      // Mock for quick command: "Rechnung 500 Euro an Firma Test"
      vi.spyOn(geminiClient, 'transcribe').mockResolvedValue(
        createMockTranscription('Rechnung 500 Euro an Firma Test')
      );

      vi.spyOn(geminiClient, 'parseInvoice').mockResolvedValue(
        createMockParseResult({
          customerName: 'Firma Test',
          items: [{ description: 'Dienstleistung', quantity: 1, unitPrice: 500 }],
        })
      );

      // Process
      const audioBlob = new Blob([new Uint8Array([0, 1, 2])], { type: 'audio/webm' });
      const result = await pipeline.processRecording(audioBlob);

      // Verify
      expect(result.success).toBe(true);
      expect(result.invoice?.customer.name).toBe('Firma Test');
      expect(result.invoice?.subtotal).toBe(500);
    });
  });

  describe('Workflow: Multi-Item Invoice', () => {
    it('should handle complex multi-item invoice', async () => {
      // Mock for complex invoice
      vi.spyOn(geminiClient, 'transcribe').mockResolvedValue(
        createMockTranscription(
          'Rechnung fuer Software AG. 40 Stunden Entwicklung zu 120 Euro, 10 Stunden Code Review zu 100 Euro, und 5 Stunden Meeting zu 80 Euro.'
        )
      );

      vi.spyOn(geminiClient, 'parseInvoice').mockResolvedValue(
        createMockParseResult({
          customerName: 'Software AG',
          items: [
            { description: 'Entwicklung', quantity: 40, unitPrice: 120 },
            { description: 'Code Review', quantity: 10, unitPrice: 100 },
            { description: 'Meeting', quantity: 5, unitPrice: 80 },
          ],
        })
      );

      // Process
      const audioBlob = new Blob([new Uint8Array([0, 1, 2])], { type: 'audio/webm' });
      const result = await pipeline.processRecording(audioBlob);

      // Verify
      expect(result.success).toBe(true);
      expect(result.invoice?.items).toHaveLength(3);

      // Calculate expected totals
      // 40*120 + 10*100 + 5*80 = 4800 + 1000 + 400 = 6200
      const expectedSubtotal = 6200;
      expect(result.invoice?.subtotal).toBe(expectedSubtotal);

      // Generate PDF
      const pdfInvoice = toPDFInvoice(result.invoice!);
      const pdfBlob = await pdfExporter.generateInvoicePDF({
        invoice: pdfInvoice,
        customer: pdfInvoice.customer,
        language: 'de',
      });

      expect(pdfBlob.size).toBeGreaterThan(0);
    });
  });

  describe('Workflow: Returning Customer', () => {
    it('should use existing customer for repeat invoice', async () => {
      // Create existing customer
      const existingCustomer = await databaseService.createCustomer({
        name: 'Stammkunde GmbH',
        email: 'stammkunde@example.com',
        address: 'Kundenstrasse 1',
        city: 'Berlin',
        zipCode: '10115',
      });

      // Mock voice input referencing existing customer
      vi.spyOn(geminiClient, 'transcribe').mockResolvedValue(
        createMockTranscription('Neue Rechnung fuer Stammkunde GmbH, 300 Euro Wartung')
      );

      vi.spyOn(geminiClient, 'parseInvoice').mockResolvedValue(
        createMockParseResult({
          customerName: 'Stammkunde GmbH',
          items: [{ description: 'Wartung', quantity: 1, unitPrice: 300 }],
        })
      );

      // Process first invoice
      const result1 = await pipeline.processTranscription('Erste Rechnung');

      expect(result1.success).toBe(true);
      expect(result1.invoice?.customer.id).toBe(existingCustomer.id);

      // Process second invoice for same customer
      const result2 = await pipeline.processTranscription('Zweite Rechnung');

      expect(result2.success).toBe(true);
      expect(result2.invoice?.customer.id).toBe(existingCustomer.id);

      // Verify no duplicate customers
      const allCustomers = await databaseService.getAllCustomers();
      expect(allCustomers).toHaveLength(1);

      // Verify two invoices exist
      const allInvoices = await databaseService.getAllInvoices();
      expect(allInvoices).toHaveLength(2);
    });
  });

  describe('Workflow: Error Recovery', () => {
    it('should handle transcription failure gracefully', async () => {
      // Mock transcription failure
      vi.spyOn(geminiClient, 'transcribe').mockResolvedValue({
        success: false,
        error: 'Service temporarily unavailable',
      });

      // Process
      const audioBlob = new Blob([new Uint8Array([0, 1, 2])], { type: 'audio/webm' });
      const result = await pipeline.processRecording(audioBlob);

      // Verify graceful failure
      expect(result.success).toBe(false);
      expect(result.error).toBe('Service temporarily unavailable');

      // Verify no invoice was created
      const invoices = await databaseService.getAllInvoices();
      expect(invoices).toHaveLength(0);

      // Voice error reporting should work
      const errorPromise = voiceHelper.reportError('Spracheingabe konnte nicht verarbeitet werden');

      await new Promise((resolve) => setTimeout(resolve, 50));
      audioInstances[audioInstances.length - 1].simulateEnd();
      await errorPromise;

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle parsing failure gracefully', async () => {
      // Mock successful transcription but failed parsing
      vi.spyOn(geminiClient, 'transcribe').mockResolvedValue({
        success: true,
        text: 'Unverstaendliche Eingabe',
      });

      vi.spyOn(geminiClient, 'parseInvoice').mockResolvedValue({
        success: false,
        confidence: 0,
        error: 'Could not extract invoice data',
      });

      // Process
      const audioBlob = new Blob([new Uint8Array([0, 1, 2])], { type: 'audio/webm' });
      const result = await pipeline.processRecording(audioBlob);

      // Verify
      expect(result.success).toBe(false);
      expect(result.transcription).toBe('Unverstaendliche Eingabe');
    });
  });

  describe('Workflow: Batch Processing', () => {
    it('should handle multiple invoices in sequence', async () => {
      const customers = ['Kunde A', 'Kunde B', 'Kunde C'];

      for (let i = 0; i < customers.length; i++) {
        const customerName = customers[i];

        // Mock for each invoice
        vi.spyOn(geminiClient, 'parseInvoice').mockResolvedValueOnce(
          createMockParseResult({
            customerName,
            items: [{ description: `Service ${i + 1}`, quantity: 1, unitPrice: 100 * (i + 1) }],
          })
        );

        // Process
        const result = await pipeline.processTranscription(`Rechnung ${i + 1}`);

        expect(result.success).toBe(true);
        expect(result.invoice?.customer.name).toBe(customerName);
      }

      // Verify all invoices created
      const allInvoices = await databaseService.getAllInvoices();
      expect(allInvoices).toHaveLength(3);

      // Verify all customers created
      const allCustomers = await databaseService.getAllCustomers();
      expect(allCustomers).toHaveLength(3);

      // Generate PDFs for all
      for (const invoice of allInvoices) {
        const pdfInvoice = toPDFInvoice(invoice);
        const pdfBlob = await pdfExporter.generateInvoicePDF({
          invoice: pdfInvoice,
          customer: pdfInvoice.customer,
          language: 'de',
        });

        expect(pdfBlob.size).toBeGreaterThan(0);
      }
    });
  });

  describe('Workflow: Invoice Status Updates', () => {
    it('should support full invoice lifecycle', async () => {
      // Create invoice via pipeline
      vi.spyOn(geminiClient, 'parseInvoice').mockResolvedValue(
        createMockParseResult({
          customerName: 'Lifecycle Test GmbH',
          items: [{ description: 'Test', quantity: 1, unitPrice: 100 }],
        })
      );

      const result = await pipeline.processTranscription('Test Rechnung');
      expect(result.success).toBe(true);

      const invoiceId = result.invoice!.id;

      // Status: DRAFT -> SENT
      await databaseService.updateInvoice(invoiceId, {
        status: 'SENT',
        issuedAt: new Date(),
        dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      });

      let updated = await databaseService.getInvoiceById(invoiceId);
      expect(updated?.status).toBe('SENT');

      // Status: SENT -> PAID
      await databaseService.markInvoiceAsPaid(invoiceId);

      updated = await databaseService.getInvoiceById(invoiceId);
      expect(updated?.status).toBe('PAID');
      expect(updated?.paidAt).toBeTruthy();

      // Get statistics
      const stats = await databaseService.getInvoiceStatistics();
      expect(stats.paidInvoices).toBe(1);
      expect(stats.totalRevenue).toBeCloseTo(119, 0); // 100 + 19% tax
    });
  });

  describe('Workflow: Analytics Integration', () => {
    it('should track invoice creation through workflow', async () => {
      // Create multiple invoices
      const invoiceData = [
        { customer: 'Kunde 1', amount: 1000 },
        { customer: 'Kunde 2', amount: 2000 },
        { customer: 'Kunde 3', amount: 1500 },
      ];

      for (const data of invoiceData) {
        vi.spyOn(geminiClient, 'parseInvoice').mockResolvedValueOnce(
          createMockParseResult({
            customerName: data.customer,
            items: [{ description: 'Service', quantity: 1, unitPrice: data.amount }],
          })
        );

        await pipeline.processTranscription(`Rechnung ${data.customer}`);
      }

      // Get statistics
      const stats = await databaseService.getInvoiceStatistics();

      expect(stats.totalInvoices).toBe(3);
      expect(stats.draftInvoices).toBe(3); // All start as drafts

      // Calculate expected revenue (all drafts, so 0 revenue yet)
      expect(stats.totalRevenue).toBe(0);
      expect(stats.totalOutstanding).toBe(0);
    });
  });
});
