import { EventEmitter } from 'events';
import { supabase } from '../services/supabase';
import {
  DOCPULSE_SKILL_MANIFEST,
  FileUploadPayload,
  ExtractionResult,
  AgentCapability,
} from '../skills/docpulse-agents.skill';
import { ExtractionAgent } from './ExtractionAgent';
import { ChunkingAgent } from './ChunkingAgent';

interface AgentRun {
  agentName: string;
  documentId: string;
  status: 'running' | 'success' | 'error';
  startedAt: Date;
  finishedAt?: Date;
  error?: string;
}

/**
 * AgentOrchestrator
 *
 * The central nervous system of the DocuPulse multi-agent pipeline.
 *
 * Responsibilities:
 *  - Reads the skill manifest to understand the agent pipeline
 *  - Dynamically spawns ExtractionAgent and ChunkingAgent when files are uploaded
 *  - Wires agent outputs to downstream agent inputs via EventEmitter
 *  - Enforces concurrency limits and retry logic per agent definition
 *  - Keeps Supabase document status in sync throughout the pipeline
 */
export class AgentOrchestrator extends EventEmitter {
  private static instance: AgentOrchestrator;
  private activeRuns: Map<string, AgentRun[]> = new Map();
  private concurrencyCounters: Map<string, number> = new Map();

  private constructor() {
    super();
    this.setMaxListeners(50);
    this.wirePipeline();
    console.log('🤖  AgentOrchestrator initialized with skill manifest:', DOCPULSE_SKILL_MANIFEST.name);
    console.log(`   Agents registered: ${DOCPULSE_SKILL_MANIFEST.agents.map(a => a.name).join(', ')}`);
  }

  /** Singleton accessor */
  static getInstance(): AgentOrchestrator {
    if (!AgentOrchestrator.instance) {
      AgentOrchestrator.instance = new AgentOrchestrator();
    }
    return AgentOrchestrator.instance;
  }

  // ── Pipeline wiring ─────────────────────────────────────────────────────────

  /**
   * Read the skill manifest pipeline array and attach event listeners
   * that spawn the correct agent for each trigger event.
   */
  private wirePipeline(): void {
    for (const step of DOCPULSE_SKILL_MANIFEST.pipeline) {
      const agentDef = DOCPULSE_SKILL_MANIFEST.agents.find(a => a.name === step.to);
      if (!agentDef) continue;

      this.on(step.from, async (payload: unknown) => {
        await this.spawnAgent(step.to, agentDef, payload);
      });

      console.log(`   🔗  ${step.from} → ${step.to}`);
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Entry point called by the upload route.
   * Triggers the pipeline by emitting 'document:uploaded'.
   */
  async handleUpload(payload: FileUploadPayload): Promise<void> {
    console.log(`\n📄  [Orchestrator] Handling upload: ${payload.filename} (doc: ${payload.documentId})`);
    await this.updateDocumentStatus(payload.documentId, 'extracting');
    this.emit('document:uploaded', payload);
  }

  // ── Agent spawning ──────────────────────────────────────────────────────────

  private async spawnAgent(
    agentName: string,
    agentDef: AgentCapability,
    payload: unknown,
  ): Promise<void> {
    const current = this.concurrencyCounters.get(agentName) ?? 0;

    if (current >= agentDef.maxConcurrency) {
      console.warn(`⚠️  [Orchestrator] ${agentName} at max concurrency (${agentDef.maxConcurrency}). Queuing...`);
      // Simple back-off retry — in production use Bull/BullMQ
      await new Promise(r => setTimeout(r, 2000));
      return this.spawnAgent(agentName, agentDef, payload);
    }

    this.concurrencyCounters.set(agentName, current + 1);

    const docId = (payload as { documentId?: string }).documentId ?? 'unknown';
    const run: AgentRun = { agentName, documentId: docId, status: 'running', startedAt: new Date() };
    const runs = this.activeRuns.get(docId) ?? [];
    runs.push(run);
    this.activeRuns.set(docId, runs);

    console.log(`🚀  [Orchestrator] Spawning ${agentName} for document ${docId}`);

    let attempt = 0;
    while (attempt <= agentDef.retries) {
      try {
        const result = await Promise.race([
          this.runAgent(agentName, payload),
          this.timeout(agentDef.timeoutMs, agentName),
        ]);

        run.status = 'success';
        run.finishedAt = new Date();
        this.concurrencyCounters.set(agentName, (this.concurrencyCounters.get(agentName) ?? 1) - 1);

        console.log(`✅  [Orchestrator] ${agentName} completed for ${docId}`);
        this.emit(agentDef.emits, result);
        return;
      } catch (err) {
        attempt++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`❌  [Orchestrator] ${agentName} attempt ${attempt} failed: ${msg}`);

        if (attempt > agentDef.retries) {
          run.status = 'error';
          run.error = msg;
          run.finishedAt = new Date();
          this.concurrencyCounters.set(agentName, (this.concurrencyCounters.get(agentName) ?? 1) - 1);
          await this.updateDocumentStatus(docId, 'error', msg);
          this.emit('agent:error', { agentName, documentId: docId, error: msg });
          return;
        }

        // Exponential back-off before retry
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }

  private async runAgent(agentName: string, payload: unknown): Promise<unknown> {
    switch (agentName) {
      case 'ExtractionAgent': {
        const agent = new ExtractionAgent(this);
        return agent.run(payload as FileUploadPayload);
      }
      case 'ChunkingAgent': {
        const agent = new ChunkingAgent(this);
        return agent.run(payload as ExtractionResult);
      }
      default:
        throw new Error(`Unknown agent: ${agentName}`);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  async updateDocumentStatus(
    documentId: string,
    status: 'pending' | 'extracting' | 'chunking' | 'complete' | 'error',
    errorMsg?: string,
  ): Promise<void> {
    const update: Record<string, unknown> = { status };
    if (errorMsg) update.error_msg = errorMsg;

    const { error } = await supabase
      .from('documents')
      .update(update)
      .eq('id', documentId);

    if (error) console.error(`[Orchestrator] Failed to update document status:`, error.message);
  }

  private timeout(ms: number, agentName: string): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${agentName} timed out after ${ms}ms`)), ms)
    );
  }

  /** Returns live run info for a document (useful for status polling) */
  getRunsForDocument(documentId: string): AgentRun[] {
    return this.activeRuns.get(documentId) ?? [];
  }
}
