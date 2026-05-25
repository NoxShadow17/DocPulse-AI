/**
 * DocuPulse AI — Agent Skill Manifest
 *
 * This skill file defines the capabilities, triggers, and contracts
 * for all agents in the DocuPulse multi-agent pipeline.
 *
 * The AgentOrchestrator reads this manifest to:
 *  - Know which agents exist and what they consume/produce
 *  - Validate payloads before spawning agents
 *  - Wire agent outputs to downstream agent inputs automatically
 */

import { z } from 'zod';

// ── Shared payload schemas ────────────────────────────────────────────────────

export const FileUploadPayloadSchema = z.object({
  documentId:  z.string().uuid(),
  filename:    z.string(),
  fileType:    z.enum(['pdf', 'docx', 'txt', 'md']),
  fileBuffer:  z.instanceof(Buffer),
  fileSizeBytes: z.number().positive(),
});

export const ExtractionResultSchema = z.object({
  documentId:   z.string().uuid(),
  rawText:      z.string().min(1),
  pageCount:    z.number().optional(),
  wordCount:    z.number(),
  extractedAt:  z.string().datetime(),
});

export const ChunkingResultSchema = z.object({
  documentId:  z.string().uuid(),
  chunkCount:  z.number(),
  tokenTotal:  z.number(),
  completedAt: z.string().datetime(),
});

// ── Agent capability definitions ─────────────────────────────────────────────

export type AgentStatus = 'idle' | 'running' | 'success' | 'error';

export interface AgentCapability {
  /** Unique identifier for this agent type */
  name: string;
  /** Human-readable description */
  description: string;
  /** Event that triggers this agent */
  trigger: string;
  /** Event this agent emits on success */
  emits: string;
  /** Zod schema for input validation */
  inputSchema: z.ZodTypeAny;
  /** Zod schema for output validation */
  outputSchema: z.ZodTypeAny;
  /** Maximum concurrent instances allowed */
  maxConcurrency: number;
  /** Retry attempts on transient failure */
  retries: number;
  /** Timeout in milliseconds */
  timeoutMs: number;
}

// ── Skill manifest ────────────────────────────────────────────────────────────

export const DOCPULSE_SKILL_MANIFEST = {
  name:    'docpulse-agents',
  version: '1.0.0',
  description: 'Multi-agent document processing pipeline for DocuPulse AI',

  agents: [
    {
      name:           'ExtractionAgent',
      description:    'Extracts raw text from uploaded PDF, DOCX, TXT, and MD files.',
      trigger:        'document:uploaded',
      emits:          'document:extracted',
      inputSchema:    FileUploadPayloadSchema,
      outputSchema:   ExtractionResultSchema,
      maxConcurrency: 5,
      retries:        2,
      timeoutMs:      30_000,
    },
    {
      name:           'ChunkingAgent',
      description:    'Splits extracted text into semantic chunks, generates embeddings, and upserts into Supabase Vector.',
      trigger:        'document:extracted',
      emits:          'document:indexed',
      inputSchema:    ExtractionResultSchema,
      outputSchema:   ChunkingResultSchema,
      maxConcurrency: 3,
      retries:        2,
      timeoutMs:      120_000,
    },
  ] as AgentCapability[],

  /** Pipeline: defines how agents chain together */
  pipeline: [
    { from: 'document:uploaded',  to: 'ExtractionAgent' },
    { from: 'document:extracted', to: 'ChunkingAgent'   },
  ],
} as const;

export type FileUploadPayload   = z.infer<typeof FileUploadPayloadSchema>;
export type ExtractionResult    = z.infer<typeof ExtractionResultSchema>;
export type ChunkingResult      = z.infer<typeof ChunkingResultSchema>;
