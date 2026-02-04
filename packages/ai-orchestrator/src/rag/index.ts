/**
 * RAG (Retrieval-Augmented Generation) Module
 *
 * Provides multi-tenant RAG capabilities with E2E encryption support.
 *
 * @module ai-orchestrator/rag
 */

// Tenant context management
export { TenantContext, globalTenantContext } from './tenant-context';

// Multi-tenant Supabase client
export { MultiTenantSupabaseClient, createMultiTenantClientFromEnv } from './supabase-client';
export type {
  DocumentType,
  EncryptedDocument,
  StoreDocumentInput,
  MultiTenantSupabaseConfig,
} from './supabase-client';
