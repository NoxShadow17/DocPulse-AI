import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import uploadRouter from './routes/upload';
import searchRouter from './routes/search';
import documentsRouter from './routes/documents';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT ?? 4000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health ───────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({ message: 'DocuPulse Backend API', version: '1.0.0', endpoints: { health: '/health', upload: '/api/upload', search: '/api/search', documents: '/api/documents' } });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'docpulse-backend', timestamp: new Date().toISOString() });
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/upload',    uploadRouter);
app.use('/api/search',    searchRouter);
app.use('/api/documents', documentsRouter);

// ── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  DocuPulse backend running on http://localhost:${PORT}`);
  console.log(`   Health → http://localhost:${PORT}/health\n`);
});

export default app;
