-- DocuPulse AI — Supabase Schema
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT,
  filename    TEXT NOT NULL,
  file_type   TEXT NOT NULL,
  file_size   BIGINT,
  status      TEXT NOT NULL DEFAULT 'pending',
  -- status: pending | extracting | chunking | complete | error
  error_msg   TEXT,
  chunk_count INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Document chunks table with vector embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content     TEXT NOT NULL,
  embedding   VECTOR(384),          -- Local all-MiniLM-L6-v2 (384 dims, free & local)
  token_count INTEGER,
  metadata    JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for fast approximate nearest-neighbor search
CREATE INDEX IF NOT EXISTS chunks_embedding_idx
  ON document_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS documents_updated_at ON documents;
CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Semantic similarity search RPC
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding  VECTOR(384),
  match_threshold  FLOAT DEFAULT 0.7,
  match_count      INT   DEFAULT 10,
  filter_doc_id    UUID  DEFAULT NULL
)
RETURNS TABLE (
  id           UUID,
  document_id  UUID,
  chunk_index  INTEGER,
  content      TEXT,
  metadata     JSONB,
  similarity   FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    dc.id,
    dc.document_id,
    dc.chunk_index,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  WHERE
    (filter_doc_id IS NULL OR dc.document_id = filter_doc_id)
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Row Level Security (enable but allow all for now — configure per user_id in prod)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations for service role" ON documents;
CREATE POLICY "Allow all operations for service role"
  ON documents FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations for service role" ON document_chunks;
CREATE POLICY "Allow all operations for service role"
  ON document_chunks FOR ALL USING (true) WITH CHECK (true);
