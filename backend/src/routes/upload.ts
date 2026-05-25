import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../services/supabase';
import { AgentOrchestrator } from '../agents/AgentOrchestrator';
import { FileUploadPayload } from '../skills/docpulse-agents.skill';

const router = Router();

// ── Multer configuration (memory storage — we pass buffers to agents) ─────────
const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf':                                                   'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain':                                                        'txt',
  'text/markdown':                                                     'md',
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: PDF, DOCX, TXT, MD`));
    }
  },
});

// ── POST /api/upload ──────────────────────────────────────────────────────────
router.post(
  '/',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file provided. Include a "file" field in your form-data.' });
        return;
      }

      const file       = req.file;
      const fileType   = ALLOWED_TYPES[file.mimetype] as 'pdf' | 'docx' | 'txt' | 'md';
      const documentId = uuidv4();
      const filename   = path.basename(file.originalname);

      // 1. Create document record in Supabase (status: pending)
      const { error: insertError } = await supabase.from('documents').insert({
        id:        documentId,
        filename,
        file_type: fileType,
        file_size: file.size,
        status:    'pending',
      });

      if (insertError) {
        throw new Error(`Failed to create document record: ${insertError.message}`);
      }

      // 2. Build payload and hand off to the orchestrator (non-blocking)
      const payload: FileUploadPayload = {
        documentId,
        filename,
        fileType,
        fileBuffer:    file.buffer,
        fileSizeBytes: file.size,
      };

      const orchestrator = AgentOrchestrator.getInstance();
      orchestrator.handleUpload(payload).catch(err => {
        console.error(`[UploadRoute] Orchestrator error for ${documentId}:`, err);
      });

      // 3. Respond immediately — processing happens asynchronously
      res.status(202).json({
        documentId,
        filename,
        fileType,
        fileSize: file.size,
        status:   'pending',
        message:  'File accepted. Agents are processing your document.',
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
