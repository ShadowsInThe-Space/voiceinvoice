/**
 * Tests for Electron Preload API.
 *
 * Tests the API exposed to the renderer process
 * via contextBridge.
 *
 * @module tests/electron/preload-api
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPreloadApi, PreloadApi, IpcInvoker } from '../../electron/preload-api';

describe('Preload API', () => {
  let mockIpcInvoker: IpcInvoker;
  let api: PreloadApi;

  beforeEach(() => {
    mockIpcInvoker = vi.fn();
    api = createPreloadApi(mockIpcInvoker);
  });

  describe('invoice operations', () => {
    it('should expose createInvoice method', () => {
      expect(api.invoice.create).toBeDefined();
      expect(typeof api.invoice.create).toBe('function');
    });

    it('should invoke ipc with correct channel for createInvoice', async () => {
      const invoiceData = {
        customerName: 'Test GmbH',
        amount: 500,
        taxRate: 19,
      };

      mockIpcInvoker.mockResolvedValue({ success: true, data: { id: '123' } });

      await api.invoice.create(invoiceData);

      expect(mockIpcInvoker).toHaveBeenCalledWith('invoice:create', invoiceData);
    });

    it('should expose getAll method', () => {
      expect(api.invoice.getAll).toBeDefined();
    });

    it('should invoke ipc for getAll', async () => {
      mockIpcInvoker.mockResolvedValue({ success: true, data: [] });

      await api.invoice.getAll();

      expect(mockIpcInvoker).toHaveBeenCalledWith('invoice:getAll');
    });
  });

  describe('customer operations', () => {
    it('should expose customer.getAll method', () => {
      expect(api.customer.getAll).toBeDefined();
    });

    it('should invoke ipc for customer getAll', async () => {
      mockIpcInvoker.mockResolvedValue({ success: true, data: [] });

      await api.customer.getAll();

      expect(mockIpcInvoker).toHaveBeenCalledWith('customer:getAll');
    });

    it('should expose customer.create method', () => {
      expect(api.customer.create).toBeDefined();
    });

    it('should invoke ipc with data for customer create', async () => {
      const customerData = {
        companyName: 'New Corp',
        type: 'CUSTOMER',
      };

      mockIpcInvoker.mockResolvedValue({ success: true, data: { id: '1' } });

      await api.customer.create(customerData);

      expect(mockIpcInvoker).toHaveBeenCalledWith('customer:create', customerData);
    });
  });

  describe('settings operations', () => {
    it('should expose settings.get method', () => {
      expect(api.settings.get).toBeDefined();
    });

    it('should invoke ipc for settings get', async () => {
      mockIpcInvoker.mockResolvedValue({ success: true, data: {} });

      await api.settings.get();

      expect(mockIpcInvoker).toHaveBeenCalledWith('settings:get');
    });

    it('should expose settings.update method', () => {
      expect(api.settings.update).toBeDefined();
    });

    it('should invoke ipc with data for settings update', async () => {
      const settingsData = { n8nEnabled: true };

      mockIpcInvoker.mockResolvedValue({ success: true, data: settingsData });

      await api.settings.update(settingsData);

      expect(mockIpcInvoker).toHaveBeenCalledWith('settings:update', settingsData);
    });
  });

  describe('voice operations', () => {
    it('should expose voice.startRecording method', () => {
      expect(api.voice.startRecording).toBeDefined();
    });

    it('should expose voice.stopRecording method', () => {
      expect(api.voice.stopRecording).toBeDefined();
    });

    it('should invoke ipc for startRecording', async () => {
      mockIpcInvoker.mockResolvedValue({ success: true });

      await api.voice.startRecording();

      expect(mockIpcInvoker).toHaveBeenCalledWith('voice:startRecording');
    });

    it('should invoke ipc for stopRecording', async () => {
      mockIpcInvoker.mockResolvedValue({ success: true, data: { transcription: 'test' } });

      await api.voice.stopRecording();

      expect(mockIpcInvoker).toHaveBeenCalledWith('voice:stopRecording');
    });
  });

  describe('app info', () => {
    it('should expose app.getVersion method', () => {
      expect(api.app.getVersion).toBeDefined();
    });

    it('should expose app.getPlatform method', () => {
      expect(api.app.getPlatform).toBeDefined();
    });

    it('should invoke ipc for getVersion', async () => {
      mockIpcInvoker.mockResolvedValue('0.1.0');

      const version = await api.app.getVersion();

      expect(mockIpcInvoker).toHaveBeenCalledWith('app:getVersion');
      expect(version).toBe('0.1.0');
    });
  });
});
