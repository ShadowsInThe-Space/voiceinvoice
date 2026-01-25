-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create a table to store your documents
create table if not exists documents (
  id bigserial primary key,
  content text, -- corresponds to the document text
  metadata jsonb, -- corresponds to the document metadata
  embedding vector(768) -- 768 is the dimension for Gemini embeddings (text-embedding-004)
);

-- Create an index on the embedding column for efficient vector similarity search
create index if not exists documents_embedding_ivfflat_idx
on documents
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Create a function to search for documents
create or replace function match_documents (
  query_embedding vector(768),
  match_threshold float,
  match_count int
) returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
) language plpgsql stable as $$
begin
  return query
  select
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;
