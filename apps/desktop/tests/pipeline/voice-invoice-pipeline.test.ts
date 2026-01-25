/**
 * Tests for VoiceInvoicePipeline.
 *
 * TDD approach: Tests written first, then implementation.
 *
 * @module tests/pipeline/voice-invoice-pipeline
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import {
  VoiceInvoicePipeline,
  type PipelineConfig,
} from '../../src/lib/pipeline/voice-invoice-pipeline';
import type {
  GeminiClient,
  TranscriptionResult,
  InvoiceParseResult,
} from '../../src/lib/ai/gemini-client';
import type {
  DatabaseService,
  InvoiceWithRelations,
} from '../../src/lib/database/database-service';
import type { PrivacyEngine } from '../../src/lib/privacy/privacy-engine';

// Mock types for testing
interface MockGeminiClient {
  transcribe: Mock;
  parseInvoice: Mock;
}

interface MockDatabaseService {
  createInvoice: Mock;
  createCustomer: Mock;
  searchCustomers: Mock;
}

interface MockPrivacyEngine {
  encrypt: Mock;
  decrypt: Mock;
  hashData: Mock;
  getConsentStatus: Mock;
}

describe('VoiceInvoicePipeline', () => {
  let pipeline: VoiceInvoicePipeline;
  let mockGeminiClient: MockGeminiClient;
  let mockDatabaseService: MockDatabaseService;
  let mockPrivacyEngine: MockPrivacyEngine;

  beforeEach(() => {
    // Create mocks
    mockGeminiClient = {
      transcribe: vi.fn(),
      parseInvoice: vi.fn(),
    };

    mockDatabaseService = {
      createInvoice: vi.fn(),
      createCustomer: vi.fn(),
      searchCustomers: vi.fn(),
    };

    mockPrivacyEngine = {
      encrypt: vi.fn(),
      decrypt: vi.fn(),
      hashData: vi.fn(),
      getConsentStatus: vi.fn(),
    };

    const config: PipelineConfig = {
      geminiClient: mockGeminiClient as unknown as GeminiClient,
      databaseService: mockDatabaseService as unknown as DatabaseService,
      privacyEngine: mockPrivacyEngine as unknown as PrivacyEngine,
    };

    pipeline = new VoiceInvoicePipeline(config);
  });

  describe('processRecording', () => {
    it('should successfully process audio blob and create invoice', async () => {
      // Arrange
      const audioBlob = new Blob(['test audio data'], { type: 'audio/webm' });

      const transcriptionResult: TranscriptionResult = {
        success: true,
        text: 'Rechnung fuer Max Mustermann, 3 Stunden Webentwicklung zu 120 Euro pro Stunde',
        confidence: 0.95,
      };

      const parseResult: InvoiceParseResult = {
        success: true,
        invoice: {
          customerName: 'Max Mustermann',
          items: [{ description: 'Webentwicklung', quantity: 3, unitPrice: 120 }],
        },
        confidence: 0.88,
      };

      const mockInvoice: Partial<InvoiceWithRelations> = {
        id: 'inv-123',
        number: 'INV-000001',
        customerId: 'cust-123',
        total: 360,
        status: 'DRAFT',
      };

      mockGeminiClient.transcribe.mockResolvedValue(transcriptionResult);
      mockGeminiClient.parseInvoice.mockResolvedValue(parseResult);
      mockDatabaseService.searchCustomers.mockResolvedValue([]);
      mockDatabaseService.createCustomer.mockResolvedValue({
        id: 'cust-123',
        name: 'Max Mustermann',
      });
      mockDatabaseService.createInvoice.mockResolvedValue(mockInvoice);
      mockPrivacyEngine.getConsentStatus.mockResolvedValue({ granted: true });

      // Act
      const result = await pipeline.processRecording(audioBlob);

      // Assert
      expect(result.success).toBe(true);
      expect(result.transcription).toBe(transcriptionResult.text);
      expect(result.confidence).toBe(0.88);
      expect(result.invoice).toBeDefined();
      expect(mockGeminiClient.transcribe).toHaveBeenCalled();
      expect(mockGeminiClient.parseInvoice).toHaveBeenCalledWith(transcriptionResult.text);
      expect(mockDatabaseService.createInvoice).toHaveBeenCalled();
    });

    it('should return error when transcription fails', async () => {
      // Arrange
      const audioBlob = new Blob(['test audio data'], { type: 'audio/webm' });

      mockGeminiClient.transcribe.mockResolvedValue({
        success: false,
        error: 'Transcription service unavailable',
      });

      mockPrivacyEngine.getConsentStatus.mockResolvedValue({ granted: true });

      // Act
      const result = await pipeline.processRecording(audioBlob);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Transcription service unavailable');
      expect(mockGeminiClient.parseInvoice).not.toHaveBeenCalled();
      expect(mockDatabaseService.createInvoice).not.toHaveBeenCalled();
    });

    it('should return error when invoice parsing fails', async () => {
      // Arrange
      const audioBlob = new Blob(['test audio data'], { type: 'audio/webm' });

      // Use realistic invoice transcription so intent is classified correctly as CREATE_INVOICE
      const transcription = 'Rechnung für Test GmbH, 10 Stunden Beratung zu 150 Euro pro Stunde';

      mockGeminiClient.transcribe.mockResolvedValue({
        success: true,
        text: transcription,
        confidence: 0.9,
      });

      mockGeminiClient.parseInvoice.mockResolvedValue({
        success: false,
        confidence: 0,
        error: 'Could not extract invoice data',
      });

      mockPrivacyEngine.getConsentStatus.mockResolvedValue({ granted: true });

      // Act
      const result = await pipeline.processRecording(audioBlob);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Could not extract invoice data');
      expect(result.transcription).toBe(transcription);
    });

    it('should return error when consent is not granted', async () => {
      // Arrange
      const audioBlob = new Blob(['test audio data'], { type: 'audio/webm' });

      mockPrivacyEngine.getConsentStatus.mockResolvedValue({ granted: false });

      // Act
      const result = await pipeline.processRecording(audioBlob);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Voice recording consent not granted');
      expect(mockGeminiClient.transcribe).not.toHaveBeenCalled();
    });

    it('should handle empty transcription', async () => {
      // Arrange
      const audioBlob = new Blob(['test audio data'], { type: 'audio/webm' });

      mockGeminiClient.transcribe.mockResolvedValue({
        success: true,
        text: '',
        confidence: 0,
      });

      mockPrivacyEngine.getConsentStatus.mockResolvedValue({ granted: true });

      // Act
      const result = await pipeline.processRecording(audioBlob);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Empty transcription received');
    });

    it('should use existing customer when found', async () => {
      // Arrange
      const audioBlob = new Blob(['test audio data'], { type: 'audio/webm' });

      const existingCustomer = {
        id: 'existing-cust-123',
        name: 'Max Mustermann',
        email: 'max@example.com',
      };

      mockGeminiClient.transcribe.mockResolvedValue({
        success: true,
        text: 'Rechnung fuer Max Mustermann',
        confidence: 0.95,
      });

      mockGeminiClient.parseInvoice.mockResolvedValue({
        success: true,
        invoice: {
          customerName: 'Max Mustermann',
          items: [{ description: 'Service', quantity: 1, unitPrice: 100 }],
        },
        confidence: 0.9,
      });

      mockDatabaseService.searchCustomers.mockResolvedValue([existingCustomer]);
      mockDatabaseService.createInvoice.mockResolvedValue({
        id: 'inv-123',
        customerId: existingCustomer.id,
        total: 100,
      });

      mockPrivacyEngine.getConsentStatus.mockResolvedValue({ granted: true });

      // Act
      const result = await pipeline.processRecording(audioBlob);

      // Assert
      expect(result.success).toBe(true);
      expect(mockDatabaseService.createCustomer).not.toHaveBeenCalled();
      expect(mockDatabaseService.createInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: existingCustomer.id,
        })
      );
    });
  });

  describe('processTranscription', () => {
    it('should successfully process transcription text and create invoice', async () => {
      // Arrange
      const transcription = 'Rechnung fuer Firma ABC, 5 Einheiten Beratung zu 200 Euro';

      const parseResult: InvoiceParseResult = {
        success: true,
        invoice: {
          customerName: 'Firma ABC',
          items: [{ description: 'Beratung', quantity: 5, unitPrice: 200 }],
        },
        confidence: 0.92,
      };

      const mockInvoice: Partial<InvoiceWithRelations> = {
        id: 'inv-456',
        number: 'INV-000002',
        customerId: 'cust-456',
        total: 1000,
        status: 'DRAFT',
      };

      mockGeminiClient.parseInvoice.mockResolvedValue(parseResult);
      mockDatabaseService.searchCustomers.mockResolvedValue([]);
      mockDatabaseService.createCustomer.mockResolvedValue({ id: 'cust-456', name: 'Firma ABC' });
      mockDatabaseService.createInvoice.mockResolvedValue(mockInvoice);

      // Act
      const result = await pipeline.processTranscription(transcription);

      // Assert
      expect(result.success).toBe(true);
      expect(result.transcription).toBe(transcription);
      expect(result.invoice).toBeDefined();
      expect(result.confidence).toBe(0.92);
      expect(mockGeminiClient.transcribe).not.toHaveBeenCalled();
      expect(mockGeminiClient.parseInvoice).toHaveBeenCalledWith(transcription);
    });

    it('should return error when parsing fails', async () => {
      // Arrange
      const transcription = 'Invalid text without invoice data';

      mockGeminiClient.parseInvoice.mockResolvedValue({
        success: false,
        confidence: 0,
        error: 'No invoice data found',
      });

      // Act
      const result = await pipeline.processTranscription(transcription);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('No invoice data found');
      expect(result.transcription).toBe(transcription);
    });

    it('should return error for empty transcription', async () => {
      // Act
      const result = await pipeline.processTranscription('');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Empty transcription provided');
      expect(mockGeminiClient.parseInvoice).not.toHaveBeenCalled();
    });

    it('should return error for whitespace-only transcription', async () => {
      // Act
      const result = await pipeline.processTranscription('   \n\t  ');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Empty transcription provided');
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const transcription = 'Rechnung fuer Test Kunde';

      mockGeminiClient.parseInvoice.mockResolvedValue({
        success: true,
        invoice: {
          customerName: 'Test Kunde',
          items: [{ description: 'Service', quantity: 1, unitPrice: 50 }],
        },
        confidence: 0.85,
      });

      mockDatabaseService.searchCustomers.mockResolvedValue([]);
      mockDatabaseService.createCustomer.mockRejectedValue(new Error('Database connection failed'));

      // Act
      const result = await pipeline.processTranscription(transcription);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to save invoice: Database connection failed');
    });
  });

  describe('convertBlobToBase64', () => {
    it('should convert blob to base64 string', async () => {
      // Arrange
      const testData = 'test audio content';
      const blob = new Blob([testData], { type: 'audio/webm' });

      // Act
      const base64 = await pipeline.convertBlobToBase64(blob);

      // Assert
      expect(typeof base64).toBe('string');
      expect(base64.length).toBeGreaterThan(0);
    });
  });

  describe('pipeline state', () => {
    it('should track pipeline processing state', async () => {
      // Arrange
      const audioBlob = new Blob(['test'], { type: 'audio/webm' });

      mockGeminiClient.transcribe.mockResolvedValue({
        success: true,
        text: 'Test',
        confidence: 0.9,
      });

      mockGeminiClient.parseInvoice.mockResolvedValue({
        success: true,
        invoice: {
          customerName: 'Test',
          items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
        },
        confidence: 0.9,
      });

      mockDatabaseService.searchCustomers.mockResolvedValue([{ id: 'c1', name: 'Test' }]);
      mockDatabaseService.createInvoice.mockResolvedValue({ id: 'i1' });
      mockPrivacyEngine.getConsentStatus.mockResolvedValue({ granted: true });

      // Assert initial state
      expect(pipeline.isProcessing()).toBe(false);

      // Act - start processing
      const processPromise = pipeline.processRecording(audioBlob);

      // Should be processing
      expect(pipeline.isProcessing()).toBe(true);

      // Wait for completion
      await processPromise;

      // Should no longer be processing
      expect(pipeline.isProcessing()).toBe(false);
    });

    it('should return last result after processing', async () => {
      // Arrange
      const transcription = 'Rechnung Test';

      mockGeminiClient.parseInvoice.mockResolvedValue({
        success: true,
        invoice: {
          customerName: 'Test',
          items: [{ description: 'Service', quantity: 1, unitPrice: 50 }],
        },
        confidence: 0.88,
      });

      mockDatabaseService.searchCustomers.mockResolvedValue([{ id: 'c1', name: 'Test' }]);
      mockDatabaseService.createInvoice.mockResolvedValue({ id: 'i1', total: 50 });

      // Act
      await pipeline.processTranscription(transcription);
      const lastResult = pipeline.getLastResult();

      // Assert
      expect(lastResult).toBeDefined();
      expect(lastResult?.success).toBe(true);
    });

    it('should return null for last result before any processing', () => {
      // Act
      const lastResult = pipeline.getLastResult();

      // Assert
      expect(lastResult).toBeNull();
    });

    it('should reset pipeline state', async () => {
      // Arrange - first do some processing
      const transcription = 'Test Rechnung';

      mockGeminiClient.parseInvoice.mockResolvedValue({
        success: true,
        invoice: {
          customerName: 'Test',
          items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
        },
        confidence: 0.9,
      });

      mockDatabaseService.searchCustomers.mockResolvedValue([{ id: 'c1', name: 'Test' }]);
      mockDatabaseService.createInvoice.mockResolvedValue({ id: 'i1', total: 100 });

      await pipeline.processTranscription(transcription);

      // Verify state was set
      expect(pipeline.getLastResult()).not.toBeNull();

      // Act - reset
      pipeline.reset();

      // Assert
      expect(pipeline.getLastResult()).toBeNull();
      expect(pipeline.isProcessing()).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle network errors during transcription', async () => {
      // Arrange
      const audioBlob = new Blob(['test'], { type: 'audio/webm' });

      mockGeminiClient.transcribe.mockRejectedValue(new Error('Network error'));
      mockPrivacyEngine.getConsentStatus.mockResolvedValue({ granted: true });

      // Act
      const result = await pipeline.processRecording(audioBlob);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      const audioBlob = new Blob(['test'], { type: 'audio/webm' });

      mockPrivacyEngine.getConsentStatus.mockRejectedValue(new Error('Unexpected error'));

      // Act
      const result = await pipeline.processRecording(audioBlob);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unexpected error');
    });

    it('should handle errors thrown during processTranscription', async () => {
      // Arrange
      // Use realistic invoice transcription so intent is classified as CREATE_INVOICE
      const transcription =
        'Erstelle Rechnung für Müller AG, 5 Stunden Softwareentwicklung, 200 Euro pro Stunde';

      // Make parseInvoice throw an error (not reject)
      mockGeminiClient.parseInvoice.mockImplementation(() => {
        throw new Error('Synchronous error in parseInvoice');
      });

      // Act
      const result = await pipeline.processTranscription(transcription);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Synchronous error in parseInvoice');
      expect(result.transcription).toBe(transcription);
    });

    it('should handle non-Error objects thrown', async () => {
      // Arrange
      // Use realistic invoice transcription so intent is classified as CREATE_INVOICE
      const transcription =
        'Neue Rechnung an Schmidt & Partner, 8 Stunden Projektmanagement, 180 Euro je Stunde';

      mockGeminiClient.parseInvoice.mockImplementation(() => {
        throw 'string error'; // Non-Error throw
      });

      // Act
      const result = await pipeline.processTranscription(transcription);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error occurred');
    });
  });

  describe('invoice data mapping', () => {
    it('should correctly map parsed invoice to database input', async () => {
      // Arrange
      const transcription =
        'Rechnung fuer Kunde XYZ, Email info@xyz.de, 2 Stunden Support zu 80 Euro, Zahlbar in 14 Tagen';

      mockGeminiClient.parseInvoice.mockResolvedValue({
        success: true,
        invoice: {
          customerName: 'Kunde XYZ',
          customerEmail: 'info@xyz.de',
          items: [{ description: 'Support', quantity: 2, unitPrice: 80, category: 'IT' }],
          paymentTerms: '14 Tage netto',
          notes: 'Zahlbar in 14 Tagen',
        },
        confidence: 0.95,
      });

      const existingCustomer = { id: 'cust-xyz', name: 'Kunde XYZ', email: 'info@xyz.de' };
      mockDatabaseService.searchCustomers.mockResolvedValue([existingCustomer]);
      mockDatabaseService.createInvoice.mockResolvedValue({ id: 'inv-xyz', total: 160 });

      // Act
      const result = await pipeline.processTranscription(transcription);

      // Assert
      expect(result.success).toBe(true);
      expect(mockDatabaseService.createInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'cust-xyz',
          items: expect.arrayContaining([
            expect.objectContaining({
              description: 'Support',
              quantity: 2,
              unitPrice: 80,
              category: 'IT',
            }),
          ]),
          paymentTerms: '14 Tage netto',
          notes: 'Zahlbar in 14 Tagen',
          transcription: transcription,
        })
      );
    });

    it('should create new customer when not found', async () => {
      // Arrange
      const transcription = 'Rechnung fuer Neue Firma GmbH, Adresse Hauptstrasse 1';

      mockGeminiClient.parseInvoice.mockResolvedValue({
        success: true,
        invoice: {
          customerName: 'Neue Firma GmbH',
          customerAddress: 'Hauptstrasse 1',
          items: [{ description: 'Produkt', quantity: 1, unitPrice: 500 }],
        },
        confidence: 0.9,
      });

      mockDatabaseService.searchCustomers.mockResolvedValue([]);
      mockDatabaseService.createCustomer.mockResolvedValue({
        id: 'new-cust-id',
        name: 'Neue Firma GmbH',
        address: 'Hauptstrasse 1',
      });
      mockDatabaseService.createInvoice.mockResolvedValue({ id: 'inv-new', total: 500 });

      // Act
      const result = await pipeline.processTranscription(transcription);

      // Assert
      expect(result.success).toBe(true);
      expect(mockDatabaseService.createCustomer).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Neue Firma GmbH',
          address: 'Hauptstrasse 1',
        })
      );
      expect(mockDatabaseService.createInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'new-cust-id',
        })
      );
    });
  });
});
