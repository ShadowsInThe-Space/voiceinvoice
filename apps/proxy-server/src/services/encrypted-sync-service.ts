/**
 * Encrypted Sync Service
 *
 * Handles storage and retrieval of encrypted documents.
 * Server never decrypts content - Zero-Knowledge architecture.
 *
 * @module services/encrypted-sync-service
 */

/**
 * Input for storing an encrypted document.
 */
export interface EncryptedDocumentInput {
  tenant_id: string;
  document_type: string;
  encrypted_content: string;
  iv: string;
  embedding?: number[] | undefined;
  metadata: {
    entity_id: string;
    entity_type: string;
    operation: 'CREATE' | 'UPDATE' | 'DELETE';
    timestamp: number;
  };
  sync_version: number;
}

/**
 * Stored encrypted document structure.
 */
export interface EncryptedDocument {
  id: string;
  tenant_id: string;
  document_type: string;
  encrypted_content: string;
  iv: string;
  embedding?: number[] | undefined;
  metadata: {
    entity_id: string;
    entity_type: string;
    operation: 'CREATE' | 'UPDATE' | 'DELETE';
    timestamp: number;
  };
  sync_version: number;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * In-memory storage for encrypted documents.
 * In production, this would be replaced with Supabase storage.
 */
const documentStore: Map<string, EncryptedDocument[]> = new Map();

/**
 * Generates a unique document ID.
 *
 * @returns Unique document identifier string
 */
function generateDocumentId(): string {
  return `doc-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Stores an encrypted document.
 * Server never decrypts the content - Zero-Knowledge architecture.
 *
 * @param input - Encrypted document input
 * @returns Stored document with generated ID
 */
export async function storeEncryptedDocument(
  input: EncryptedDocumentInput
): Promise<{ id: string }> {
  const { tenant_id, document_type, encrypted_content, iv, embedding, metadata, sync_version } =
    input;

  // Get or create tenant's document list
  let tenantDocs = documentStore.get(tenant_id);
  if (!tenantDocs) {
    tenantDocs = [];
    documentStore.set(tenant_id, tenantDocs);
  }

  // Check for existing document with same entity_id (upsert logic)
  const existingIndex = tenantDocs.findIndex(
    (doc) => doc.metadata.entity_id === metadata.entity_id && doc.document_type === document_type
  );

  const now = new Date();
  const documentId = existingIndex >= 0 ? tenantDocs[existingIndex].id : generateDocumentId();

  const document: EncryptedDocument = {
    id: documentId,
    tenant_id,
    document_type,
    encrypted_content,
    iv,
    embedding,
    metadata,
    sync_version,
    is_deleted: metadata.operation === 'DELETE',
    created_at: existingIndex >= 0 ? tenantDocs[existingIndex].created_at : now,
    updated_at: now,
  };

  if (existingIndex >= 0) {
    // Update existing document
    tenantDocs[existingIndex] = document;
  } else {
    // Add new document
    tenantDocs.push(document);
  }

  return { id: documentId };
}

/**
 * Pulls encrypted documents for a tenant since a given timestamp.
 *
 * @param tenantId - Tenant identifier
 * @param since - Optional timestamp to filter documents
 * @param documentTypes - Optional filter by document types
 * @returns Encrypted documents and current timestamp
 */
export async function pullEncryptedDocuments(
  tenantId: string,
  since: Date | null,
  documentTypes?: string[]
): Promise<{
  documents: EncryptedDocument[];
  timestamp: Date;
}> {
  const tenantDocs = documentStore.get(tenantId) || [];

  let filteredDocs = tenantDocs;

  // Filter by timestamp if provided
  if (since) {
    filteredDocs = filteredDocs.filter((doc) => doc.updated_at > since);
  }

  // Filter by document types if provided
  if (documentTypes && documentTypes.length > 0) {
    filteredDocs = filteredDocs.filter((doc) => documentTypes.includes(doc.document_type));
  }

  return {
    documents: filteredDocs,
    timestamp: new Date(),
  };
}

/**
 * Clears all stored documents (for testing).
 */
export function clearDocumentStore(): void {
  documentStore.clear();
}

/**
 * Gets the document store (for testing).
 *
 * @returns The document store map
 */
export function getDocumentStore(): Map<string, EncryptedDocument[]> {
  return documentStore;
}
