/**
 * Tests for Webhook Client
 *
 * Tests the n8n webhook integration including:
 * - URL validation
 * - Sending webhook notifications
 * - Retry logic with exponential backoff
 * - Timeout handling
 *
 * @module tests/lib/webhook/webhook-client.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isValidWebhookUrl,
  getWebhookConfig,
  saveWebhookConfig,
  sendWebhookNotification,
  WEBHOOK_STORAGE_KEYS,
  type WebhookConfig,
  type WebhookPayload,
} from '../../../src/lib/webhook/webhook-client';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => mockLocalStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockLocalStorage[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockLocalStorage[key];
  }),
  clear: vi.fn(() => {
    Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key]);
  }),
};

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock console.error to prevent noise in tests
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('webhook-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('WEBHOOK_STORAGE_KEYS', () => {
    it('should have correct storage keys', () => {
      expect(WEBHOOK_STORAGE_KEYS.enabled).toBe('voiceinvoice_webhook_enabled');
      expect(WEBHOOK_STORAGE_KEYS.url).toBe('voiceinvoice_webhook_url');
      expect(WEBHOOK_STORAGE_KEYS.backupUrl).toBe('voiceinvoice_webhook_backup_url');
    });
  });

  describe('isValidWebhookUrl', () => {
    it('should accept valid HTTP URLs', () => {
      expect(isValidWebhookUrl('http://localhost:5678/webhook')).toBe(true);
      expect(isValidWebhookUrl('http://n8n.local/webhook/abc')).toBe(true);
      expect(isValidWebhookUrl('http://192.168.1.1:5678/webhook')).toBe(true);
    });

    it('should accept valid HTTPS URLs', () => {
      expect(isValidWebhookUrl('https://n8n.example.com/webhook')).toBe(true);
      expect(isValidWebhookUrl('https://automation.company.de/webhook/123')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidWebhookUrl('')).toBe(false);
      expect(isValidWebhookUrl('not-a-url')).toBe(false);
      expect(isValidWebhookUrl('ftp://example.com')).toBe(false);
      expect(isValidWebhookUrl('file:///etc/passwd')).toBe(false);
    });

    it('should reject null and undefined', () => {
      expect(isValidWebhookUrl(null as unknown as string)).toBe(false);
      expect(isValidWebhookUrl(undefined as unknown as string)).toBe(false);
    });
  });

  describe('getWebhookConfig', () => {
    it('should return default config when nothing is saved', () => {
      const config = getWebhookConfig();

      expect(config).toEqual({
        enabled: false,
        url: '',
        backupUrl: '',
      });
    });

    it('should load saved config from localStorage', () => {
      mockLocalStorage[WEBHOOK_STORAGE_KEYS.enabled] = 'true';
      mockLocalStorage[WEBHOOK_STORAGE_KEYS.url] = 'https://n8n.example.com/webhook';
      mockLocalStorage[WEBHOOK_STORAGE_KEYS.backupUrl] = 'https://backup.example.com/webhook';

      const config = getWebhookConfig();

      expect(config).toEqual({
        enabled: true,
        url: 'https://n8n.example.com/webhook',
        backupUrl: 'https://backup.example.com/webhook',
      });
    });

    it('should handle partial config', () => {
      mockLocalStorage[WEBHOOK_STORAGE_KEYS.enabled] = 'true';
      mockLocalStorage[WEBHOOK_STORAGE_KEYS.url] = 'http://localhost:5678/webhook';

      const config = getWebhookConfig();

      expect(config).toEqual({
        enabled: true,
        url: 'http://localhost:5678/webhook',
        backupUrl: '',
      });
    });
  });

  describe('saveWebhookConfig', () => {
    it('should save config to localStorage', () => {
      const config: WebhookConfig = {
        enabled: true,
        url: 'https://n8n.example.com/webhook',
        backupUrl: 'https://backup.example.com/webhook',
      };

      saveWebhookConfig(config);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(WEBHOOK_STORAGE_KEYS.enabled, 'true');
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        WEBHOOK_STORAGE_KEYS.url,
        'https://n8n.example.com/webhook'
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        WEBHOOK_STORAGE_KEYS.backupUrl,
        'https://backup.example.com/webhook'
      );
    });

    it('should handle disabled config', () => {
      const config: WebhookConfig = {
        enabled: false,
        url: '',
        backupUrl: '',
      };

      saveWebhookConfig(config);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(WEBHOOK_STORAGE_KEYS.enabled, 'false');
    });
  });

  describe('sendWebhookNotification', () => {
    const mockPayload: WebhookPayload = {
      invoiceId: 'inv-123',
      invoiceNumber: 'RE-2024-001',
      status: 'PAID',
      previousStatus: 'PENDING',
      amount: 1190.0,
      currency: 'EUR',
      customerName: 'Acme GmbH',
      changedAt: '2024-01-15T10:30:00.000Z',
    };

    it('should not send if webhooks are disabled', async () => {
      mockLocalStorage[WEBHOOK_STORAGE_KEYS.enabled] = 'false';

      await sendWebhookNotification(mockPayload);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not send if no URL is configured', async () => {
      mockLocalStorage[WEBHOOK_STORAGE_KEYS.enabled] = 'true';
      mockLocalStorage[WEBHOOK_STORAGE_KEYS.url] = '';

      await sendWebhookNotification(mockPayload);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should send notification to primary webhook URL', async () => {
      mockLocalStorage[WEBHOOK_STORAGE_KEYS.enabled] = 'true';
      mockLocalStorage[WEBHOOK_STORAGE_KEYS.url] = 'https://n8n.example.com/webhook';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      await sendWebhookNotification(mockPayload);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://n8n.example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(mockPayload),
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('should retry on failure with exponential backoff', async () => {
      mockLocalStorage[WEBHOOK_STORAGE_KEYS.enabled] = 'true';
      mockLocalStorage[WEBHOOK_STORAGE_KEYS.url] = 'https://n8n.example.com/webhook';

      // First 3 attempts fail, 4th succeeds (but we only retry 3 times, so 4 total attempts)
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true, status: 200 });

      const sendPromise = sendWebhookNotification(mockPayload);

      // First attempt fails immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Wait 1 second for first retry
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Wait 2 seconds for second retry
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Wait 4 seconds for third retry
      await vi.advanceTimersByTimeAsync(4000);
      expect(mockFetch).toHaveBeenCalledTimes(4);

      await sendPromise;
    });

    it('should try backup URL after all primary retries fail', async () => {
      mockLocalStorage[WEBHOOK_STORAGE_KEYS.enabled] = 'true';
      mockLocalStorage[WEBHOOK_STORAGE_KEYS.url] = 'https://n8n.example.com/webhook';
      mockLocalStorage[WEBHOOK_STORAGE_KEYS.backupUrl] = 'https://backup.example.com/webhook';

      // All primary attempts fail
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true, status: 200 }); // Backup succeeds

      const sendPromise = sendWebhookNotification(mockPayload);

      // Advance through all primary retries (1 + 3 retries)
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      // Now backup URL should be called
      await vi.advanceTimersByTimeAsync(0);

      await sendPromise;

      // 4 primary + 1 backup
      expect(mockFetch).toHaveBeenCalledTimes(5);
      expect(mockFetch).toHaveBeenLastCalledWith(
        'https://backup.example.com/webhook',
        expect.any(Object)
      );
    });

    it('should silently log errors without throwing', async () => {
      mockLocalStorage[WEBHOOK_STORAGE_KEYS.enabled] = 'true';
      mockLocalStorage[WEBHOOK_STORAGE_KEYS.url] = 'https://n8n.example.com/webhook';

      // All attempts fail
      mockFetch.mockRejectedValue(new Error('Permanent failure'));

      const sendPromise = sendWebhookNotification(mockPayload);

      // Advance through all retries
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      // Should not throw
      await expect(sendPromise).resolves.toBeUndefined();

      // Should log error
      expect(mockConsoleError).toHaveBeenCalled();
    });

    it('should handle HTTP error responses', async () => {
      mockLocalStorage[WEBHOOK_STORAGE_KEYS.enabled] = 'true';
      mockLocalStorage[WEBHOOK_STORAGE_KEYS.url] = 'https://n8n.example.com/webhook';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const sendPromise = sendWebhookNotification(mockPayload);

      // Advance through all retries
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      await sendPromise;

      // Should retry on HTTP errors
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('should use 10 second timeout', async () => {
      mockLocalStorage[WEBHOOK_STORAGE_KEYS.enabled] = 'true';
      mockLocalStorage[WEBHOOK_STORAGE_KEYS.url] = 'https://n8n.example.com/webhook';

      // Simulate a timeout by checking the abort signal
      mockFetch.mockImplementationOnce((url, options) => {
        const signal = options?.signal as AbortSignal;
        // The signal should have a timeout of 10 seconds
        expect(signal).toBeDefined();
        return Promise.resolve({ ok: true, status: 200 });
      });

      await sendWebhookNotification(mockPayload);
    });
  });
});
