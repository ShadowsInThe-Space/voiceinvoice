-- Migration: Multi-Tenant Similarity Search RPC Function
-- Created: 2026-02-04
-- Purpose: Provides tenant-isolated similarity search for encrypted documents

-- Drop existing function if exists (for idempotent migrations)
DROP FUNCTION IF EXISTS match_encrypted_documents(vector(768), INT, TEXT, TEXT);

-- Function to perform similarity search within a tenant's documents
-- Returns encrypted content that must be decrypted client-side
CREATE OR REPLACE FUNCTION match_encrypted_documents(
  query_embedding vector(768),
  match_count INT DEFAULT 5,
  p_tenant_id TEXT DEFAULT NULL,
  p_document_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  tenant_id TEXT,
  document_type TEXT,
  encrypted_content TEXT,
  iv TEXT,
  embedding vector(768),
  metadata JSONB,
  similarity FLOAT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  effective_tenant_id TEXT;
BEGIN
  -- Use provided tenant_id or fall back to session context
  effective_tenant_id := COALESCE(p_tenant_id, current_setting('app.tenant_id', true));

  IF effective_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant context not set. Call set_tenant_context() first or provide p_tenant_id.';
  END IF;

  -- Set tenant context for RLS
  PERFORM set_tenant_context(effective_tenant_id);

  RETURN QUERY
  SELECT
    ed.id,
    ed.tenant_id,
    ed.document_type,
    ed.encrypted_content,
    ed.iv,
    ed.embedding,
    ed.metadata,
    1 - (ed.embedding <=> query_embedding) AS similarity,
    ed.created_at,
    ed.updated_at
  FROM encrypted_documents ed
  WHERE ed.tenant_id = effective_tenant_id
    AND ed.is_deleted = FALSE
    AND (p_document_type IS NULL OR ed.document_type = p_document_type)
    AND ed.embedding IS NOT NULL
  ORDER BY ed.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to upsert encrypted document (for sync)
CREATE OR REPLACE FUNCTION upsert_encrypted_document(
  p_id UUID,
  p_tenant_id TEXT,
  p_document_type TEXT,
  p_encrypted_content TEXT,
  p_iv TEXT,
  p_embedding vector(768) DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_sync_version BIGINT DEFAULT 1
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_id UUID;
  existing_version BIGINT;
BEGIN
  -- Verify tenant context matches
  IF p_tenant_id != current_setting('app.tenant_id', true) THEN
    RAISE EXCEPTION 'Tenant ID mismatch. Cannot upsert document for different tenant.';
  END IF;

  -- Check for existing document and version
  SELECT sync_version INTO existing_version
  FROM encrypted_documents
  WHERE id = p_id AND tenant_id = p_tenant_id;

  IF existing_version IS NOT NULL THEN
    -- Update only if incoming version is newer (conflict resolution: last-write-wins with version check)
    IF p_sync_version > existing_version THEN
      UPDATE encrypted_documents
      SET
        document_type = p_document_type,
        encrypted_content = p_encrypted_content,
        iv = p_iv,
        embedding = p_embedding,
        metadata = p_metadata,
        sync_version = p_sync_version,
        is_deleted = FALSE
      WHERE id = p_id AND tenant_id = p_tenant_id
      RETURNING id INTO result_id;
    ELSE
      -- Return existing ID without update (client has older version)
      result_id := p_id;
    END IF;
  ELSE
    -- Insert new document
    INSERT INTO encrypted_documents (id, tenant_id, document_type, encrypted_content, iv, embedding, metadata, sync_version)
    VALUES (p_id, p_tenant_id, p_document_type, p_encrypted_content, p_iv, p_embedding, p_metadata, p_sync_version)
    RETURNING id INTO result_id;
  END IF;

  RETURN result_id;
END;
$$;

-- Function to get documents changed since a specific timestamp (for sync)
CREATE OR REPLACE FUNCTION get_documents_since(
  p_tenant_id TEXT,
  p_since TIMESTAMPTZ,
  p_document_type TEXT DEFAULT NULL,
  p_limit INT DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  document_type TEXT,
  encrypted_content TEXT,
  iv TEXT,
  embedding vector(768),
  metadata JSONB,
  sync_version BIGINT,
  is_deleted BOOLEAN,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set tenant context
  PERFORM set_tenant_context(p_tenant_id);

  RETURN QUERY
  SELECT
    ed.id,
    ed.document_type,
    ed.encrypted_content,
    ed.iv,
    ed.embedding,
    ed.metadata,
    ed.sync_version,
    ed.is_deleted,
    ed.updated_at
  FROM encrypted_documents ed
  WHERE ed.tenant_id = p_tenant_id
    AND ed.updated_at > p_since
    AND (p_document_type IS NULL OR ed.document_type = p_document_type)
  ORDER BY ed.updated_at ASC
  LIMIT p_limit;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION set_tenant_context(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tenant_context() TO authenticated;
GRANT EXECUTE ON FUNCTION match_encrypted_documents(vector(768), INT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_encrypted_document(UUID, TEXT, TEXT, TEXT, TEXT, vector(768), JSONB, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_documents_since(TEXT, TIMESTAMPTZ, TEXT, INT) TO authenticated;

-- Comments for documentation
COMMENT ON FUNCTION match_encrypted_documents IS 'Performs tenant-isolated similarity search. Returns encrypted content for client-side decryption.';
COMMENT ON FUNCTION upsert_encrypted_document IS 'Upserts encrypted document with version-based conflict resolution.';
COMMENT ON FUNCTION get_documents_since IS 'Returns documents changed since timestamp for incremental sync.';
