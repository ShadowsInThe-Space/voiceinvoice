/**
 * Multi-Tenant Supabase Client for E2E Encrypted Documents.
 *
 * Provides tenant-isolated access to encrypted documents with RAG support.
 * All queries are automatically scoped to the current tenant via RLS.
 *
 * @module ai-orchestrator/rag/supabase-client
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { globalTenantContext } from './tenant-context';

/**
 * Encrypted document types supported by the system.
 */
export type DocumentType = 'invoice' | 'customer' | 'recording' | 'category' | 'bank_transaction';

/**
 * Represents an encrypted document stored in Supabase.
 * Content is AES-256-GCM encrypted, only the client can decrypt.
 */
export interface EncryptedDocument {
  /** UUID of the document */
  id: string;
  /** Tenant ID (derived from license key) */
  tenant_id: string;
  /** Type of document */
  document_type: DocumentType;
  /** AES-256-GCM encrypted content (base64) */
  encrypted_content: string;
  /** Initialization vector (included in encrypted_content but stored separately) */
  iv: string;
  /** 768-dimensional embedding for similarity search (unencrypted) */
  embedding: number[] | null;
  /** Unencrypted metadata for filtering (no PII!) */
  metadata: Record<string, unknown>;
  /** Similarity score from vector search (only present in search results) */
  similarity?: number;
  /** Creation timestamp */
  created_at?: string;
  /** Last update timestamp */
  updated_at?: string;
  /** Sync version for conflict resolution */
  sync_version?: number;
}

/**
 * Input for storing an encrypted document.
 */
export interface StoreDocumentInput {
  /** Optional UUID (auto-generated if not provided) */
  id?: string;
  /** Type of document */
  document_type: DocumentType;
  /** AES-256-GCM encrypted content (base64) */
  encrypted_content: string;
  /** Initialization vector */
  iv: string;
  /** Optional embedding for RAG search */
  embedding?: number[];
  /** Optional metadata for filtering */
  metadata?: Record<string, unknown>;
  /** Sync version (for conflict resolution) */
  sync_version?: number;
}

/**
 * Configuration for the multi-tenant Supabase client.
 */
export interface MultiTenantSupabaseConfig {
  /** Supabase project URL */
  supabaseUrl: string;
  /** Supabase anon or service role key */
  supabaseKey: string;
}

/**
 * Multi-Tenant Supabase Client for E2E encrypted documents.
 *
 * @example
 * ```typescript
 * const client = new MultiTenantSupabaseClient({
 *   supabaseUrl: process.env.SUPABASE_URL!,
 *   supabaseKey: process.env.SUPABASE_KEY!,
 * });
 *
 * // Set tenant context before queries
 * await client.setTenantContext(deriveTenantId(licenseKey));
 *
 * // Store encrypted document
 * const id = await client.storeDocument({
 *   document_type: 'invoice',
 *   encrypted_content: encryptedBase64,
 *   iv: ivBase64,
 *   embedding: embeddingVector,
 * });
 *
 * // Search similar documents
 * const results = await client.similaritySearch(queryEmbedding, 5);
 * ```
 */
export class MultiTenantSupabaseClient {
  private client: SupabaseClient;

  /**
   * Creates a new MultiTenantSupabaseClient.
   *
   * @param config - Supabase configuration
   */
  constructor(config: MultiTenantSupabaseConfig) {
    this.client = createClient(config.supabaseUrl, config.supabaseKey);
  }

  /**
   * Sets the tenant context for all subsequent queries.
   * Must be called before any database operations.
   *
   * @param tenantId - The tenant ID derived from license key
   */
  async setTenantContext(tenantId: string): Promise<void> {
    globalTenantContext.setTenant(tenantId);
    await this.client.rpc('set_tenant_context', { p_tenant_id: tenantId });
  }

  /**
   * Gets the underlying Supabase client for advanced operations.
   *
   * @returns The raw Supabase client
   */
  getClient(): SupabaseClient {
    return this.client;
  }

  /**
   * Stores an encrypted document with optional embedding.
   * The embedding enables RAG similarity search while content remains encrypted.
   *
   * @param doc - Document to store
   * @returns The document ID
   * @throws Error if tenant context not set or storage fails
   */
  async storeDocument(doc: StoreDocumentInput): Promise<string> {
    const tenantId = globalTenantContext.getTenantId();

    const { data, error } = await this.client
      .from('encrypted_documents')
      .insert({
        id: doc.id,
        tenant_id: tenantId,
        document_type: doc.document_type,
        encrypted_content: doc.encrypted_content,
        iv: doc.iv,
        embedding: doc.embedding || null,
        metadata: doc.metadata || {},
        sync_version: doc.sync_version || 1,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to store document: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Upserts an encrypted document with version-based conflict resolution.
   * Uses last-write-wins with version check.
   *
   * @param doc - Document to upsert (must include id)
   * @returns The document ID
   * @throws Error if tenant context not set or upsert fails
   */
  async upsertDocument(doc: StoreDocumentInput & { id: string }): Promise<string> {
    const tenantId = globalTenantContext.getTenantId();

    const { data, error } = await this.client.rpc('upsert_encrypted_document', {
      p_id: doc.id,
      p_tenant_id: tenantId,
      p_document_type: doc.document_type,
      p_encrypted_content: doc.encrypted_content,
      p_iv: doc.iv,
      p_embedding: doc.embedding || null,
      p_metadata: doc.metadata || {},
      p_sync_version: doc.sync_version || 1,
    });

    if (error) {
      throw new Error(`Failed to upsert document: ${error.message}`);
    }

    return data as string;
  }

  /**
   * Performs similarity search within the tenant's documents.
   * Returns encrypted content that must be decrypted client-side.
   *
   * @param queryEmbedding - 768-dimensional query embedding vector
   * @param limit - Maximum number of results (default: 5)
   * @param documentType - Optional filter by document type
   * @returns Array of matching encrypted documents with similarity scores
   * @throws Error if tenant context not set or search fails
   */
  async similaritySearch(
    queryEmbedding: number[],
    limit: number = 5,
    documentType?: DocumentType
  ): Promise<EncryptedDocument[]> {
    const tenantId = globalTenantContext.getTenantId();

    const { data, error } = await this.client.rpc('match_encrypted_documents', {
      query_embedding: queryEmbedding,
      match_count: limit,
      p_tenant_id: tenantId,
      p_document_type: documentType || null,
    });

    if (error) {
      throw new Error(`Similarity search failed: ${error.message}`);
    }

    return (data || []) as EncryptedDocument[];
  }

  /**
   * Gets documents changed since a specific timestamp for incremental sync.
   *
   * @param since - Timestamp to get changes since
   * @param documentType - Optional filter by document type
   * @param limit - Maximum number of results (default: 100)
   * @returns Array of changed documents (including deleted)
   */
  async getDocumentsSince(
    since: Date,
    documentType?: DocumentType,
    limit: number = 100
  ): Promise<EncryptedDocument[]> {
    const tenantId = globalTenantContext.getTenantId();

    const { data, error } = await this.client.rpc('get_documents_since', {
      p_tenant_id: tenantId,
      p_since: since.toISOString(),
      p_document_type: documentType || null,
      p_limit: limit,
    });

    if (error) {
      throw new Error(`Failed to get documents since ${since.toISOString()}: ${error.message}`);
    }

    return (data || []) as EncryptedDocument[];
  }

  /**
   * Soft-deletes a document by marking it as deleted.
   * Document remains in database for sync purposes.
   *
   * @param documentId - UUID of the document to delete
   * @throws Error if tenant context not set or deletion fails
   */
  async softDeleteDocument(documentId: string): Promise<void> {
    const tenantId = globalTenantContext.getTenantId();

    const { error } = await this.client
      .from('encrypted_documents')
      .update({ is_deleted: true })
      .eq('id', documentId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Failed to delete document: ${error.message}`);
    }
  }

  /**
   * Gets a single document by ID.
   *
   * @param documentId - UUID of the document
   * @returns The encrypted document or null if not found
   */
  async getDocument(documentId: string): Promise<EncryptedDocument | null> {
    const tenantId = globalTenantContext.getTenantId();

    const { data, error } = await this.client
      .from('encrypted_documents')
      .select('*')
      .eq('id', documentId)
      .eq('tenant_id', tenantId)
      .eq('is_deleted', false)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to get document: ${error.message}`);
    }

    return data as EncryptedDocument;
  }
}

/**
 * Creates a MultiTenantSupabaseClient from environment variables.
 *
 * @returns Configured Supabase client
 * @throws Error if required environment variables are missing
 */
export function createMultiTenantClientFromEnv(): MultiTenantSupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!supabaseKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return new MultiTenantSupabaseClient({
    supabaseUrl,
    supabaseKey,
  });
}
