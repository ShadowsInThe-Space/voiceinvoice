/**
 * Integration Tests: Voice-to-Invoice Pipeline
 *
 * Tests the complete flow from audio/transcription to invoice creation:
 * 1. Audio -> Transcription -> Parsing -> Invoice Creation
 * 2. Uses real database, mocks only external APIs (Google AI)
 *
 * @module tests/integration/pipeline
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { VoiceInvoicePipeline, PipelineConfig } from '../../src/lib/pipeline/voice-invoice-pipeline';
import { GeminiClient, TranscriptionResult, InvoiceParseResult } from '../../src/lib/ai/gemini-client';
import { DatabaseService } from '../../src/lib/database/database-service';

// Test database path
const TEST_DB_URL = 'file:./test-integration-pipeline.db';

// Mock data for AI responses
const MOCK_TRANSCRIPTION: TranscriptionResult = {
  success: true,
  text: 'Rechnung fuer Firma Mueller GmbH, Musterstrasse 123, 10115 Berlin. 5 Stunden Beratung zu je 150 Euro. Zahlbar innerhalb von 14 Tagen.',
  confidence: 0.95,
};

const MOCK_PARSED_INVOICE: InvoiceParseResult = {
  success: true,
  invoice: {
    customerName: 'Firma Mueller GmbH',
    customerAddress: 'Musterstrasse 123, 10115 Berlin',
    items: [
      {
        description: 'Beratung',
        quantity: 5,
        unitPrice: 150.0,
      },
    ],
    paymentTerms: 'Zahlbar innerhalb von 14 Tagen',
  },
  confidence: 0.85,
};

describe('Voice-to-Invoice Pipeline Integration', () => {
  let prisma: PrismaClient;
  let databaseService: DatabaseService;
  let geminiClient: GeminiClient;
  let pipeline: VoiceInvoicePipeline;

  beforeEach(async () => {
    // Initialize test database
    prisma = new PrismaClient({
      datasources: {
        db: { url: TEST_DB_URL },
      },
    });

    // Push schema to test database
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

    // Create mocked GeminiClient
    geminiClient = new GeminiClient({ apiKey: 'test-api-key' });

    // Mock external API calls
    vi.spyOn(geminiClient, 'transcribe').mockResolvedValue(MOCK_TRANSCRIPTION);
    vi.spyOn(geminiClient, 'parseInvoice').mockResolvedValue(MOCK_PARSED_INVOICE);

    // Initialize pipeline
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

  describe('processTranscription', () => {
    it('should process transcription text and create invoice with new customer', async () => {
      // Arrange
      const transcriptionText =
        'Rechnung fuer Firma Mueller GmbH, 5 Stunden Beratung zu je 150 Euro.';

      // Act
      const result = await pipeline.processTranscription(transcriptionText);

      // Assert
      expect(result.success).toBe(true);
      expect(result.invoice).toBeDefined();
      expect(result.invoice?.customer.name).toBe('Firma Mueller GmbH');
      expect(result.invoice?.items).toHaveLength(1);
      expect(result.invoice?.items[0].description).toBe('Beratung');
      expect(result.invoice?.items[0].quantity).toBe(5);
      expect(result.invoice?.items[0].unitPrice).toBe(150);
      expect(result.transcription).toBe(transcriptionText);
      expect(result.confidence).toBe(0.85);

      // Verify database persistence
      const invoices = await databaseService.getAllInvoices();
      expect(invoices).toHaveLength(1);
      expect(invoices[0].transcription).toBe(transcriptionText);
    });

    it('should use existing customer when found by name', async () => {
      // Arrange - Create existing customer
      const existingCustomer = await databaseService.createCustomer({
        name: 'Firma Mueller GmbH',
        email: 'mueller@example.com',
        address: 'Alte Strasse 1',
      });

      const transcriptionText = 'Rechnung fuer Firma Mueller GmbH';

      // Act
      const result = await pipeline.processTranscription(transcriptionText);

      // Assert
      expect(result.success).toBe(true);
      expect(result.invoice?.customer.id).toBe(existingCustomer.id);
      expect(result.invoice?.customer.email).toBe('mueller@example.com');

      // Verify no duplicate customer was created
      const customers = await databaseService.getAllCustomers();
      expect(customers).toHaveLength(1);
    });

    it('should calculate correct invoice totals with 19% tax', async () => {
      // Arrange
      const transcriptionText = 'Rechnung Test';

      // Act
      const result = await pipeline.processTranscription(transcriptionText);

      // Assert
      expect(result.success).toBe(true);
      expect(result.invoice).toBeDefined();

      // 5 * 150 = 750 subtotal
      const expectedSubtotal = 750;
      const expectedTax = expectedSubtotal * 0.19; // 142.50
      const expectedTotal = expectedSubtotal + expectedTax; // 892.50

      expect(result.invoice?.subtotal).toBe(expectedSubtotal);
      expect(result.invoice?.taxAmount).toBeCloseTo(expectedTax, 2);
      expect(result.invoice?.total).toBeCloseTo(expectedTotal, 2);
    });

    it('should fail gracefully with empty transcription', async () => {
      // Act
      const result = await pipeline.processTranscription('');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Empty transcription provided');
    });

    it('should fail gracefully when AI parsing fails', async () => {
      // Arrange
      vi.spyOn(geminiClient, 'parseInvoice').mockResolvedValue({
        success: false,
        confidence: 0,
        error: 'Could not parse invoice data',
      });

      // Act
      const result = await pipeline.processTranscription('Invalid input');

      // Assert
      expect(result.success).toBe(false);
      // The pipeline returns the error from parseInvoice or a default message
      expect(result.error).toBeTruthy();
    });

    it('should include payment terms from parsed invoice', async () => {
      // Act
      const result = await pipeline.processTranscription('Rechnung mit Zahlungsziel');

      // Assert
      expect(result.success).toBe(true);
      expect(result.invoice?.paymentTerms).toBe('Zahlbar innerhalb von 14 Tagen');
    });
  });

  describe('processRecording', () => {
    it('should process audio blob through complete pipeline', async () => {
      // Arrange - Create mock audio blob
      const audioContent = new Uint8Array([0, 1, 2, 3, 4, 5]);
      const audioBlob = new Blob([audioContent], { type: 'audio/webm' });

      // Act
      const result = await pipeline.processRecording(audioBlob);

      // Assert
      expect(result.success).toBe(true);
      expect(geminiClient.transcribe).toHaveBeenCalledWith(
        expect.any(String),
        'audio/webm',
        { language: 'de-DE' }
      );
      expect(result.invoice).toBeDefined();
      expect(result.transcription).toBe(MOCK_TRANSCRIPTION.text);
    });

    it('should fail when transcription fails', async () => {
      // Arrange
      vi.spyOn(geminiClient, 'transcribe').mockResolvedValue({
        success: false,
        error: 'Transcription service unavailable',
      });

      const audioBlob = new Blob([new Uint8Array([0, 1, 2])], { type: 'audio/webm' });

      // Act
      const result = await pipeline.processRecording(audioBlob);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Transcription service unavailable');
    });

    it('should fail when transcription returns empty text', async () => {
      // Arrange
      vi.spyOn(geminiClient, 'transcribe').mockResolvedValue({
        success: true,
        text: '   ',
      });

      const audioBlob = new Blob([new Uint8Array([0, 1, 2])], { type: 'audio/webm' });

      // Act
      const result = await pipeline.processRecording(audioBlob);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Empty transcription received');
    });
  });

  describe('Pipeline State Management', () => {
    it('should track processing state correctly', async () => {
      // Initial state
      expect(pipeline.isProcessing()).toBe(false);
      expect(pipeline.getLastResult()).toBeNull();

      // After processing
      await pipeline.processTranscription('Test');

      expect(pipeline.isProcessing()).toBe(false);
      expect(pipeline.getLastResult()).not.toBeNull();
      expect(pipeline.getLastResult()?.success).toBe(true);
    });

    it('should reset state correctly', async () => {
      // Process and then reset
      await pipeline.processTranscription('Test');
      expect(pipeline.getLastResult()).not.toBeNull();

      pipeline.reset();

      expect(pipeline.isProcessing()).toBe(false);
      expect(pipeline.getLastResult()).toBeNull();
    });
  });

  describe('Multiple Invoice Creation', () => {
    it('should create multiple invoices with unique numbers', async () => {
      // Act - Create multiple invoices
      const result1 = await pipeline.processTranscription('Erste Rechnung');
      const result2 = await pipeline.processTranscription('Zweite Rechnung');
      const result3 = await pipeline.processTranscription('Dritte Rechnung');

      // Assert
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);

      // Verify unique invoice numbers
      const invoiceNumbers = [
        result1.invoice?.number,
        result2.invoice?.number,
        result3.invoice?.number,
      ];
      const uniqueNumbers = new Set(invoiceNumbers);
      expect(uniqueNumbers.size).toBe(3);

      // Verify all stored in database
      const allInvoices = await databaseService.getAllInvoices();
      expect(allInvoices).toHaveLength(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Arrange - Mock database service to throw error
      vi.spyOn(databaseService, 'searchCustomers').mockRejectedValue(
        new Error('Database connection lost')
      );

      // Act
      const result = await pipeline.processTranscription('Test mit DB Fehler');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });
});
