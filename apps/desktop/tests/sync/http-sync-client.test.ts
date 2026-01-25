/**
 * Tests for HttpSyncApiClient.
 *
 * @module tests/sync/http-sync-client
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpSyncApiClient } from '../../src/lib/sync/http-sync-client';
import { SyncEntityType } from '../../src/lib/sync/sync-queue';

describe('HttpSyncApiClient', () => {
  let client: HttpSyncApiClient;
  const baseUrl = 'https://api.example.com';
  const mockGetAuthToken = vi.fn().mockResolvedValue('fake-token');

  // Mock global fetch
  const fetchMock = vi.fn();
  global.fetch = fetchMock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthToken.mockResolvedValue('fake-token');

    client = new HttpSyncApiClient({
      baseUrl,
      getAuthToken: mockGetAuthToken,
      timeoutMs: 1000,
    });
  });

  describe('push', () => {
    const mockEntry = {
      id: '1',
      tenantId: 'tenant-123',
      entityType: 'customer' as SyncEntityType,
      entityId: 'cust-1',
      operation: 'CREATE' as const,
      data: { name: 'Test' },
      status: 'PENDING' as const,
      timestamp: 1234567890,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should send correct POST request', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: 'cust-1' } }),
      });

      await client.push(mockEntry);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];

      expect(url).toBe(`${baseUrl}/api/sync/push`);
      expect(options.method).toBe('POST');
      expect(options.body).toContain('"entityType":"customer"');

      const headers = options.headers as Headers;
      expect(headers.get('Authorization')).toBe('Bearer fake-token');
      expect(headers.get('Content-Type')).toBe('application/json');
    });

    it('should throw error on failure', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(client.push(mockEntry)).rejects.toThrow('Push failed with status: 500');
    });

    it('should throw if no token available', async () => {
      mockGetAuthToken.mockResolvedValueOnce(null);
      await expect(client.push(mockEntry)).rejects.toThrow('No authentication token');
    });
  });

  describe('pull', () => {
    it('should send correct GET request with params', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ changes: [], timestamp: 123 }),
      });

      await client.pull(1000, ['customer', 'invoice']);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];

      const expectedUrl = `${baseUrl}/api/sync/pull?since=1000&types=customer%2Cinvoice`;
      expect(url).toBe(expectedUrl);
      expect(options.method).toBe('GET');

      const headers = options.headers as Headers;
      expect(headers.get('Authorization')).toBe('Bearer fake-token');
    });

    it('should handle response correctly', async () => {
      const mockResponse = {
        changes: [{ entityType: 'customer', entityId: 'c1', operation: 'UPDATE', data: {} }],
        timestamp: 2000,
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.pull(null);

      expect(result.data).toHaveLength(1);
      expect(result.lastSyncTimestamp).toBe(2000);
    });
  });

  describe('checkConnection', () => {
    it('should return true on 200 OK', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true });
      const isOnline = await client.checkConnection();
      expect(isOnline).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/api/health`, expect.anything());
    });

    it('should return false on failure', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));
      const isOnline = await client.checkConnection();
      expect(isOnline).toBe(false);
    });
  });
});
