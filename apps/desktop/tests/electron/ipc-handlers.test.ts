/**
 * Tests for Electron IPC handlers.
 *
 * These tests verify the IPC communication layer between
 * the renderer process and the main process.
 *
 * @module tests/electron/ipc-handlers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createInvoiceHandler,
  getCustomersHandler,
  getSettingsHandler,
  updateSettingsHandler,
  IpcHandlerContext,
} from '../../electron/ipc/handlers';

describe('IPC Handlers', () => {
  let mockContext: IpcHandlerContext;

  beforeEach(() => {
    mockContext = {
      database: {
        createInvoice: vi.fn(),
        getCustomers: vi.fn(),
        getSettings: vi.fn(),
        updateSettings: vi.fn(),
      },
    };
  });

  describe('createInvoiceHandler', () => {
    it('should create an invoice with valid data', async () => {
      const invoiceData = {
        customerName: 'Mustermann GmbH',
        amount: 1000,
        taxRate: 19,
        description: 'Beratungsleistung',
      };

      const expectedInvoice = {
        id: 'inv-123',
        ...invoiceData,
        status: 'DRAFT',
        createdAt: new Date(),
      };

      mockContext.database.createInvoice.mockResolvedValue(expectedInvoice);

      const result = await createInvoiceHandler(mockContext, invoiceData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expectedInvoice);
      expect(mockContext.database.createInvoice).toHaveBeenCalledWith(invoiceData);
    });

    it('should return error for invalid invoice data', async () => {
      const invalidData = {
        customerName: '',
        amount: -100,
        taxRate: 25,
      };

      const result = await createInvoiceHandler(mockContext, invalidData);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.field).toBeDefined();
      expect(mockContext.database.createInvoice).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const invoiceData = {
        customerName: 'Test Corp',
        amount: 500,
        taxRate: 7,
      };

      mockContext.database.createInvoice.mockRejectedValue(new Error('Database error'));

      const result = await createInvoiceHandler(mockContext, invoiceData);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Database');
    });
  });

  describe('getCustomersHandler', () => {
    it('should return list of customers', async () => {
      const customers = [
        { id: '1', companyName: 'Acme Corp', type: 'CUSTOMER' },
        { id: '2', companyName: 'Beta GmbH', type: 'SUPPLIER' },
      ];

      mockContext.database.getCustomers.mockResolvedValue(customers);

      const result = await getCustomersHandler(mockContext);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(customers);
    });

    it('should return empty array when no customers exist', async () => {
      mockContext.database.getCustomers.mockResolvedValue([]);

      const result = await getCustomersHandler(mockContext);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should handle database errors', async () => {
      mockContext.database.getCustomers.mockRejectedValue(new Error('Connection failed'));

      const result = await getCustomersHandler(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getSettingsHandler', () => {
    it('should return current app settings', async () => {
      const settings = {
        privacyMode: 'STRICT',
        n8nEnabled: false,
        bankSyncEnabled: false,
      };

      mockContext.database.getSettings.mockResolvedValue(settings);

      const result = await getSettingsHandler(mockContext);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(settings);
    });

    it('should return default settings when none exist', async () => {
      mockContext.database.getSettings.mockResolvedValue(null);

      const result = await getSettingsHandler(mockContext);

      expect(result.success).toBe(true);
      expect(result.data?.privacyMode).toBe('STRICT');
    });
  });

  describe('updateSettingsHandler', () => {
    it('should update settings with valid data', async () => {
      const settingsUpdate = {
        n8nEnabled: true,
        n8nWebhookUrl: 'https://n8n.example.com/webhook',
      };

      const updatedSettings = {
        privacyMode: 'STRICT',
        ...settingsUpdate,
      };

      mockContext.database.updateSettings.mockResolvedValue(updatedSettings);

      const result = await updateSettingsHandler(mockContext, settingsUpdate);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedSettings);
    });

    it('should reject invalid webhook URL', async () => {
      const settingsUpdate = {
        n8nEnabled: true,
        n8nWebhookUrl: 'not-a-valid-url',
      };

      const result = await updateSettingsHandler(mockContext, settingsUpdate);

      expect(result.success).toBe(false);
      expect(result.error?.field).toBe('n8nWebhookUrl');
    });
  });
});
