/**
 * HTTP Sync Client implementation.
 *
 * Implements the SyncApiClient interface using real HTTP requests
 * to the backend API.
 *
 * @module lib/sync/http-sync-client
 */

import { SyncApiClient } from './sync-engine';
import { SyncQueueEntry, SyncEntityType } from './sync-queue';

/**
 * Configuration options for HttpSyncApiClient.
 */
export interface HttpSyncClientOptions {
  /** Base URL of the API (e.g., 'https://api.voiceinvoice.com') */
  baseUrl: string;
  /** Function to get the current authentication token */
  getAuthToken: () => Promise<string | null>;
  /** Timeout for requests in milliseconds */
  timeoutMs?: number;
}

/**
 * Implementation of SyncApiClient using HTTP/REST.
 */
export class HttpSyncApiClient implements SyncApiClient {
  private baseUrl: string;
  private getAuthToken: () => Promise<string | null>;
  private timeoutMs: number;

  /**
   *
   * @param options
   */
  constructor(options: HttpSyncClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.getAuthToken = options.getAuthToken;
    this.timeoutMs = options.timeoutMs ?? 10000;
  }

  /**
   * Pushes a local change to the server.
   * @param entry
   */
  async push(
    entry: SyncQueueEntry
  ): Promise<{ success: boolean; serverData?: Record<string, unknown> }> {
    try {
      const response = await this.fetchWithAuth('/api/sync/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entityType: entry.entityType,
          entityId: entry.entityId,
          operation: entry.operation,
          data: entry.data,
          timestamp: entry.timestamp,
        }),
      });

      if (!response.ok) {
        throw new Error(`Push failed with status: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        serverData: result.data,
      };
    } catch (error) {
      // Re-throw to let SyncEngine handle retries
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Pulls changes from the server.
   * @param since
   * @param entityTypes
   */
  async pull(
    since: number | null,
    entityTypes?: SyncEntityType[]
  ): Promise<{
    data: Array<{
      entityType: SyncEntityType;
      entityId: string;
      operation: 'CREATE' | 'UPDATE' | 'DELETE';
      data: Record<string, unknown>;
      serverVersion?: number;
    }>;
    lastSyncTimestamp: number;
  }> {
    const params = new URLSearchParams();
    if (since) {
      params.append('since', since.toString());
    }
    if (entityTypes && entityTypes.length > 0) {
      params.append('types', entityTypes.join(','));
    }

    const response = await this.fetchWithAuth(`/api/sync/pull?${params.toString()}`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Pull failed with status: ${response.status}`);
    }

    const result = await response.json();
    return {
      data: result.changes,
      lastSyncTimestamp: result.timestamp,
    };
  }

  /**
   * Checks server connection.
   */
  async checkConnection(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // Shorter timeout for check

      const response = await fetch(`${this.baseUrl}/api/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Helper to perform authenticated requests.
   * @param endpoint
   * @param init
   */
  private async fetchWithAuth(endpoint: string, init?: RequestInit): Promise<Response> {
    const token = await this.getAuthToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${token}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...init,
        headers,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
