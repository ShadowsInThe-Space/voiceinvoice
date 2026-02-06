/**
 * Encrypted Sync Client for E2E encrypted data synchronization.
 *
 * Wraps the HTTP sync client to encrypt data before sending
 * and decrypt data after receiving. Server never sees plaintext.
 *
 * @module lib/sync/encrypted-sync-client
 */

import { globalEncryptionContext } from '../encryption';
import { SyncQueueEntry, SyncEntityType } from './sync-queue';

/**
 * Configuration for encrypted sync.
 */
export interface EncryptedSyncConfig {
  /** Base URL of the API */
  baseUrl: string;
  /** Function to get auth token */
  getAuthToken: () => Promise<string | null>;
  /** Optional function to generate embeddings for RAG */
  generateEmbedding?: (text: string) => Promise<number[]>;
  /** Timeout in ms */
  timeoutMs?: number;
}

/**
 * Encrypted document payload for sync.
 */
export interface EncryptedSyncPayload {
  /** Document type mapped from entity type */
  document_type: string;
  /** AES-256-GCM encrypted content (base64) */
  encrypted_content: string;
  /** Initialization vector (extracted from serialized data) */
  iv: string;
  /** 768-dim embedding for RAG (unencrypted) */
  embedding?: number[];
  /** Unencrypted metadata for filtering */
  metadata: {
    entity_id: string;
    entity_type: SyncEntityType;
    operation: 'CREATE' | 'UPDATE' | 'DELETE';
    timestamp: number;
  };
  /** Sync version for conflict resolution */
  sync_version: number;
}

/**
 * Encrypted Sync Client that provides E2E encryption for data sync.
 *
 * @example
 * ```typescript
 * const client = new EncryptedSyncClient({
 *   baseUrl: 'https://api.voiceinvoice.com',
 *   getAuthToken: () => licenseApi.getToken(),
 *   generateEmbedding: (text) => geminiClient.embed(text),
 * });
 *
 * // Push encrypted invoice
 * await client.pushEncrypted(syncEntry);
 *
 * // Pull and decrypt changes
 * const changes = await client.pullEncrypted(lastSyncTime);
 * ```
 */
export class EncryptedSyncClient {
  private baseUrl: string;
  private getAuthToken: () => Promise<string | null>;
  private generateEmbedding?: (text: string) => Promise<number[]>;
  private timeoutMs: number;

  /**
   *
   * @param config
   */
  constructor(config: EncryptedSyncConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.getAuthToken = config.getAuthToken;
    if (config.generateEmbedding) {
      this.generateEmbedding = config.generateEmbedding;
    }
    this.timeoutMs = config.timeoutMs ?? 10000;
  }

  /**
   * Pushes an encrypted entry to the server.
   *
   * @param entry - Sync queue entry with plaintext data
   * @returns Success status and optional server response
   * @throws Error if encryption context not initialized
   */
  async pushEncrypted(entry: SyncQueueEntry): Promise<{ success: boolean; documentId?: string }> {
    if (!globalEncryptionContext.isInitialized()) {
      throw new Error('Encryption context not initialized');
    }

    const tenantId = globalEncryptionContext.getTenantId();

    // Encrypt the data
    const encryptedContent = globalEncryptionContext.encryptForSync(entry.data);

    // Extract IV from serialized data (first 12 bytes = 16 base64 chars)
    // Note: The serialized format is [IV (12 bytes)][ciphertext][tag (16 bytes)]
    const iv = encryptedContent.slice(0, 16);

    // Generate embedding for RAG if handler provided
    let embedding: number[] | undefined;
    if (this.generateEmbedding && entry.operation !== 'DELETE') {
      const textForEmbedding = this.extractTextForEmbedding(entry);
      if (textForEmbedding) {
        try {
          embedding = await this.generateEmbedding(textForEmbedding);
        } catch (error) {
          console.warn('[EncryptedSync] Failed to generate embedding:', error);
          // Continue without embedding - RAG search will be limited
        }
      }
    }

    // Build encrypted payload
    const payload: EncryptedSyncPayload = {
      document_type: this.mapEntityTypeToDocumentType(entry.entityType),
      encrypted_content: encryptedContent,
      iv,
      metadata: {
        entity_id: entry.entityId,
        entity_type: entry.entityType,
        operation: entry.operation,
        timestamp: entry.timestamp,
      },
      sync_version: 1,
    };
    if (embedding) {
      payload.embedding = embedding;
    }

    // Send to server
    const response = await this.fetchWithAuth('/api/sync/encrypted', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Push failed with status: ${response.status}`);
    }

    const result = await response.json();
    return {
      success: true,
      documentId: result.id,
    };
  }

  /**
   * Pulls and decrypts changes from the server.
   *
   * @param since - Timestamp to get changes since
   * @param entityTypes - Optional filter by entity types
   * @returns Decrypted changes
   */
  async pullEncrypted(
    since: Date | null,
    entityTypes?: SyncEntityType[]
  ): Promise<{
    changes: Array<{
      entityType: SyncEntityType;
      entityId: string;
      operation: 'CREATE' | 'UPDATE' | 'DELETE';
      data: Record<string, unknown>;
      syncVersion: number;
      isDeleted: boolean;
    }>;
    lastSyncTimestamp: Date;
  }> {
    if (!globalEncryptionContext.isInitialized()) {
      throw new Error('Encryption context not initialized');
    }

    const tenantId = globalEncryptionContext.getTenantId();

    const params = new URLSearchParams();
    if (since) {
      params.append('since', since.toISOString());
    }
    if (entityTypes && entityTypes.length > 0) {
      const documentTypes = entityTypes.map((t) => this.mapEntityTypeToDocumentType(t));
      params.append('types', documentTypes.join(','));
    }

    const response = await this.fetchWithAuth(`/api/sync/encrypted/pull?${params.toString()}`, {
      method: 'GET',
      headers: {
        'x-tenant-id': tenantId,
      },
    });

    if (!response.ok) {
      throw new Error(`Pull failed with status: ${response.status}`);
    }

    const result = await response.json();

    // Decrypt each change
    const changes = result.documents.map(
      (doc: {
        encrypted_content: string;
        metadata: {
          entity_id: string;
          entity_type: SyncEntityType;
          operation: 'CREATE' | 'UPDATE' | 'DELETE';
        };
        sync_version: number;
        is_deleted: boolean;
      }) => {
        let data: Record<string, unknown> = {};

        if (!doc.is_deleted) {
          try {
            data = globalEncryptionContext.decryptFromSync<Record<string, unknown>>(
              doc.encrypted_content
            );
          } catch (error) {
            console.error('[EncryptedSync] Failed to decrypt document:', error);
            // Return empty data - caller should handle gracefully
          }
        }

        return {
          entityType: doc.metadata.entity_type,
          entityId: doc.metadata.entity_id,
          operation: doc.metadata.operation,
          data,
          syncVersion: doc.sync_version,
          isDeleted: doc.is_deleted,
        };
      }
    );

    return {
      changes,
      lastSyncTimestamp: new Date(result.timestamp),
    };
  }

  /**
   * Checks if server connection is available.
   */
  async checkConnection(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

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
   * Extracts text from entry data for embedding generation.
   * @param entry
   */
  private extractTextForEmbedding(entry: SyncQueueEntry): string | null {
    const data = entry.data as Record<string, unknown>;

    switch (entry.entityType) {
      case 'invoice': {
        const parts = [
          data.customerName,
          data.description,
          data.notes,
          data.items
            ? (data.items as Array<{ description?: string }>).map((i) => i.description).join(' ')
            : null,
        ].filter(Boolean);
        return parts.length > 0 ? parts.join(' ') : null;
      }

      case 'customer': {
        const parts = [data.name, data.company, data.notes].filter(Boolean);
        return parts.length > 0 ? parts.join(' ') : null;
      }

      case 'recording': {
        return (data.transcript as string) || null;
      }

      default:
        return null;
    }
  }

  /**
   * Maps sync entity type to Supabase document type.
   * @param entityType
   */
  private mapEntityTypeToDocumentType(entityType: SyncEntityType): string {
    const mapping: Record<SyncEntityType, string> = {
      customer: 'customer',
      invoice: 'invoice',
      invoiceItem: 'invoice_item',
      recording: 'recording',
      category: 'category',
      bankTransaction: 'bank_transaction',
      appSettings: 'app_settings',
    };
    return mapping[entityType] || entityType;
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

/**
 * Creates an EncryptedSyncClient from environment variables.
 * @param getAuthToken
 * @param generateEmbedding
 */
export function createEncryptedSyncClientFromEnv(
  getAuthToken: () => Promise<string | null>,
  generateEmbedding?: (text: string) => Promise<number[]>
): EncryptedSyncClient {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const config: EncryptedSyncConfig = {
    baseUrl,
    getAuthToken,
  };
  if (generateEmbedding) {
    config.generateEmbedding = generateEmbedding;
  }
  return new EncryptedSyncClient(config);
}
