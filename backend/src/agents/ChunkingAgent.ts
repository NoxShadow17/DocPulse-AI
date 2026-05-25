import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../services/supabase';
import { embedBatch } from '../services/embeddings';
import {
  ExtractionResult,
  ChunkingResult,
} from '../skills/docpulse-agents.skill';
import { AgentOrchestrator } from './AgentOrchestrator';

// ── Chunking configuration ────────────────────────────────────────────────────
const CHUNK_SIZE       = 500;   // target tokens per chunk (approx 1 token ≈ 4 chars)
const CHUNK_OVERLAP    = 50;    // overlap tokens between consecutive chunks
const CHARS_PER_TOKEN  = 4;     // rough approximation
const BATCH_SIZE       = 20;    // embed N chunks per OpenAI request

/**
 * ChunkingAgent
 *
 * Triggered by: 'document:extracted'
 * Emits:        'document:indexed'  (via orchestrator)
 *
 * Responsibilities:
 *  - Splits extracted text into overlapping semantic chunks
 *  - Respects sentence boundaries when splitting
 *  - Generates OpenAI embeddings in batches (avoids rate limits)
 *  - Upserts all chunk rows + embeddings into Supabase
 *  - Updates the document's chunk_count and status to 'complete'
 */
export class ChunkingAgent {
  constructor(private orchestrator: EventEmitter) {}

  async run(payload: ExtractionResult): Promise<ChunkingResult> {
    console.log(`✂️   [ChunkingAgent] Starting for document ${payload.documentId}`);

    // 1. Split text into chunks
    const textChunks = this.splitIntoChunks(payload.rawText, CHUNK_SIZE, CHUNK_OVERLAP);
    console.log(`✂️   [ChunkingAgent] Created ${textChunks.length} chunks`);

    // 2. Generate embeddings in batches
    const embeddings = await this.generateEmbeddingsInBatches(textChunks);

    // 3. Upsert to Supabase
    await this.upsertChunks(payload.documentId, textChunks, embeddings);

    // 4. Update document metadata
    const tokenTotal = textChunks.reduce((acc, c) => acc + Math.ceil(c.length / CHARS_PER_TOKEN), 0);
    await this.finaliseDocument(payload.documentId, textChunks.length);

    console.log(`✅  [ChunkingAgent] Indexed ${textChunks.length} chunks for ${payload.documentId}`);

    return {
      documentId:  payload.documentId,
      chunkCount:  textChunks.length,
      tokenTotal,
      completedAt: new Date().toISOString(),
    };
  }

  // ── Text splitting ────────────────────────────────────────────────────────

  private splitIntoChunks(text: string, chunkTokens: number, overlapTokens: number): string[] {
    const chunkChars   = chunkTokens * CHARS_PER_TOKEN;
    const overlapChars = overlapTokens * CHARS_PER_TOKEN;

    // Split on sentence boundaries first
    const sentences = text.match(/[^.!?\n]+[.!?\n]+/g) ?? [text];

    const chunks: string[] = [];
    let current = '';

    for (const sentence of sentences) {
      if ((current + sentence).length > chunkChars && current.length > 0) {
        chunks.push(current.trim());
        // Keep overlap from end of current chunk
        const overlapText = current.slice(Math.max(0, current.length - overlapChars));
        current = overlapText + sentence;
      } else {
        current += sentence;
      }
    }

    if (current.trim().length > 0) {
      chunks.push(current.trim());
    }

    return chunks.filter(c => c.length > 0);
  }

  // ── Embedding generation ──────────────────────────────────────────────────

  private async generateEmbeddingsInBatches(chunks: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      console.log(`✂️   [ChunkingAgent] Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}`);
      const batchEmbeddings = await embedBatch(batch);
      embeddings.push(...batchEmbeddings);

      // Rate-limit guard: 100ms pause between batches
      if (i + BATCH_SIZE < chunks.length) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    return embeddings;
  }

  // ── Supabase upsert ───────────────────────────────────────────────────────

  private async upsertChunks(
    documentId: string,
    chunks: string[],
    embeddings: number[][],
  ): Promise<void> {
    const rows = chunks.map((content, index) => ({
      id:          uuidv4(),
      document_id: documentId,
      chunk_index: index,
      content,
      embedding:   JSON.stringify(embeddings[index]),  // Supabase expects stringified vector
      token_count: Math.ceil(content.length / CHARS_PER_TOKEN),
      metadata: {
        charCount:  content.length,
        chunkIndex: index,
        totalChunks: chunks.length,
      },
    }));

    // Insert in pages of 50 to avoid request size limits
    const PAGE_SIZE = 50;
    for (let i = 0; i < rows.length; i += PAGE_SIZE) {
      const page = rows.slice(i, i + PAGE_SIZE);
      const { error } = await supabase.from('document_chunks').insert(page);
      if (error) {
        throw new Error(`ChunkingAgent: Supabase insert failed — ${error.message}`);
      }
    }
  }

  private async finaliseDocument(documentId: string, chunkCount: number): Promise<void> {
    const { error } = await supabase
      .from('documents')
      .update({ status: 'complete', chunk_count: chunkCount })
      .eq('id', documentId);

    if (error) {
      throw new Error(`ChunkingAgent: Failed to finalise document — ${error.message}`);
    }

    // Emit completion via orchestrator
    (this.orchestrator as AgentOrchestrator).updateDocumentStatus(documentId, 'complete');
  }
}
