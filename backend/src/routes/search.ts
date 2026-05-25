import { Router, Request, Response, NextFunction } from 'express';
import { supabase } from '../services/supabase';
import { embedText } from '../services/embeddings';
import { synthesizeAnswer } from '../services/llm';
import { z } from 'zod';

const router = Router();

const SearchBodySchema = z.object({
  query:           z.string().min(1).max(1000),
  matchThreshold:  z.number().min(0).max(1).default(0.6), // set default slightly lower to match easier on all-MiniLM
  matchCount:      z.number().int().min(1).max(50).default(10),
  documentId:      z.string().uuid().optional(),
});

// ── POST /api/search ──────────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = SearchBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      return;
    }

    const { query, matchThreshold, matchCount, documentId } = parsed.data;

    // 1. Embed the query using free local embedding model
    const queryEmbedding = await embedText(query);

    // 2. Call Supabase RPC for vector similarity search
    const { data, error } = await supabase.rpc('match_chunks', {
      query_embedding:  queryEmbedding,
      match_threshold:  matchThreshold,
      match_count:      matchCount,
      filter_doc_id:    documentId ?? null,
    });

    if (error) throw new Error(`Vector search failed: ${error.message}`);

    // 3. Enrich results with document metadata
    const docIds = [...new Set((data ?? []).map((r: { document_id: string }) => r.document_id))];
    let documents: Record<string, { filename: string; file_type: string }> = {};

    if (docIds.length > 0) {
      const { data: docs } = await supabase
        .from('documents')
        .select('id, filename, file_type')
        .in('id', docIds);

      documents = Object.fromEntries(
        (docs ?? []).map((d: { id: string; filename: string; file_type: string }) => [d.id, d])
      );
    }

    const results = (data ?? []).map((chunk: {
      id: string;
      document_id: string;
      chunk_index: number;
      content: string;
      metadata: Record<string, unknown>;
      similarity: number;
    }) => ({
      chunkId:     chunk.id,
      documentId:  chunk.document_id,
      chunkIndex:  chunk.chunk_index,
      content:     chunk.content,
      similarity:  Math.round(chunk.similarity * 1000) / 1000,
      metadata:    chunk.metadata,
      document:    documents[chunk.document_id] ?? null,
    }));

    // 4. Synthesize AI response using Groq with retrieved chunks
    let aiAnswer: string | undefined;
    if (results.length > 0) {
      const retrievedChunks = results.map((r: { content: string }) => r.content);
      aiAnswer = await synthesizeAnswer(query, retrievedChunks);
    } else {
      aiAnswer = "No relevant context was found in the indexed documents to synthesize an AI answer.";
    }

    res.json({ query, count: results.length, results, aiAnswer });
  } catch (err) {
    next(err);
  }
});

export default router;
