import { Router, Request, Response, NextFunction } from 'express';
import { supabase } from '../services/supabase';
import { AgentOrchestrator } from '../agents/AgentOrchestrator';

const router = Router();

// ── GET /api/documents ────────────────────────────────────────────────────────
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('id, filename, file_type, file_size, status, chunk_count, error_msg, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);

    res.json({ documents: data ?? [], count: (data ?? []).length });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/documents/:id ────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (docError || !doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const { count } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', id);

    const orchestrator = AgentOrchestrator.getInstance();
    const agentRuns    = orchestrator.getRunsForDocument(id);

    res.json({ document: doc, chunkCount: count ?? 0, agentRuns });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/documents/:id ─────────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);

    res.json({ message: 'Document deleted successfully', id });
  } catch (err) {
    next(err);
  }
});

export default router;
