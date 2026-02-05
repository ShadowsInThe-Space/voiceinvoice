-- Migration: Multi-Tenant Row-Level Security for E2E Encryption
-- Created: 2026-02-04
-- Purpose: Enables tenant isolation for encrypted documents with RAG support

-- Enable pgvector if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create multi-tenant encrypted documents table
-- Note: Content is AES-256-GCM encrypted, embeddings are NOT encrypted to enable similarity search
CREATE TABLE IF NOT EXISTS encrypted_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('invoice', 'customer', 'recording', 'category', 'bank_transaction')),
  encrypted_content TEXT NOT NULL, -- AES-256-GCM encrypted JSON (base64)
  iv TEXT NOT NULL, -- Initialization vector (included in encrypted_content but stored separately for reference)
  embedding vector(768), -- Gemini embeddings (unencrypted for similarity search)
  metadata JSONB DEFAULT '{}', -- Unencrypted metadata for filtering (no PII!)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_version BIGINT DEFAULT 1, -- For conflict resolution
  is_deleted BOOLEAN DEFAULT FALSE -- Soft delete for sync
);

-- Create index for vector similarity search (IVFFlat for large datasets)
CREATE INDEX IF NOT EXISTS encrypted_documents_embedding_idx
  ON encrypted_documents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Create index for tenant filtering (critical for RLS performance)
CREATE INDEX IF NOT EXISTS encrypted_documents_tenant_idx
  ON encrypted_documents (tenant_id);

-- Create composite index for common query patterns
CREATE INDEX IF NOT EXISTS encrypted_documents_tenant_type_idx
  ON encrypted_documents (tenant_id, document_type);

-- Create index for sync queries
CREATE INDEX IF NOT EXISTS encrypted_documents_sync_idx
  ON encrypted_documents (tenant_id, updated_at DESC);

-- Enable Row Level Security
ALTER TABLE encrypted_documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotent migrations)
DROP POLICY IF EXISTS tenant_isolation_select ON encrypted_documents;
DROP POLICY IF EXISTS tenant_isolation_insert ON encrypted_documents;
DROP POLICY IF EXISTS tenant_isolation_update ON encrypted_documents;
DROP POLICY IF EXISTS tenant_isolation_delete ON encrypted_documents;

-- RLS Policy: SELECT - Users can only read their own tenant's documents
CREATE POLICY tenant_isolation_select ON encrypted_documents
  FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true));

-- RLS Policy: INSERT - Users can only insert into their own tenant
CREATE POLICY tenant_isolation_insert ON encrypted_documents
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- RLS Policy: UPDATE - Users can only update their own tenant's documents
CREATE POLICY tenant_isolation_update ON encrypted_documents
  FOR UPDATE
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- RLS Policy: DELETE - Users can only delete their own tenant's documents
CREATE POLICY tenant_isolation_delete ON encrypted_documents
  FOR DELETE
  USING (tenant_id = current_setting('app.tenant_id', true));

-- Function to set tenant context (must be called before any query)
-- SECURITY: Validates that the provided tenant_id matches the JWT claim
CREATE OR REPLACE FUNCTION set_tenant_context(p_tenant_id TEXT)
RETURNS VOID AS $$
DECLARE
  jwt_tenant_id TEXT;
BEGIN
  -- Tenant-ID aus JWT extrahieren und validieren
  jwt_tenant_id := current_setting('request.jwt.claims', true)::json->>'tenant_id';

  IF jwt_tenant_id IS NULL OR jwt_tenant_id != p_tenant_id THEN
    RAISE EXCEPTION 'Unauthorized: tenant_id mismatch';
  END IF;

  PERFORM set_config('app.tenant_id', p_tenant_id, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current tenant context
CREATE OR REPLACE FUNCTION get_tenant_context()
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.tenant_id', true);
END;
$$ LANGUAGE plpgsql STABLE;

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.sync_version = OLD.sync_version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_encrypted_documents_updated_at ON encrypted_documents;
CREATE TRIGGER update_encrypted_documents_updated_at
  BEFORE UPDATE ON encrypted_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comment on table for documentation
COMMENT ON TABLE encrypted_documents IS 'Multi-tenant encrypted document storage with RAG support. Content is E2E encrypted, embeddings are unencrypted for similarity search.';
COMMENT ON COLUMN encrypted_documents.tenant_id IS 'Derived from license key using HKDF-SHA256. Used for RLS isolation.';
COMMENT ON COLUMN encrypted_documents.encrypted_content IS 'AES-256-GCM encrypted JSON content. Server cannot decrypt.';
COMMENT ON COLUMN encrypted_documents.embedding IS 'Unencrypted 768-dim vector for similarity search (Gemini text-embedding-004).';
