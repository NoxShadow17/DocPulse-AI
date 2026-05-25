import { EventEmitter } from 'events';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import {
  FileUploadPayload,
  ExtractionResult,
} from '../skills/docpulse-agents.skill';
import { AgentOrchestrator } from './AgentOrchestrator';

/**
 * ExtractionAgent
 *
 * Triggered by: 'document:uploaded'
 * Emits:        'document:extracted'  (via orchestrator)
 *
 * Responsibilities:
 *  - Receives the raw file buffer from the orchestrator
 *  - Detects file type and routes to the correct parser
 *  - Extracts clean plain text from PDF, DOCX, TXT, or MD
 *  - Returns a validated ExtractionResult to the orchestrator
 */
export class ExtractionAgent {
  constructor(private orchestrator: EventEmitter) {}

  async run(payload: FileUploadPayload): Promise<ExtractionResult> {
    console.log(`📑  [ExtractionAgent] Processing: ${payload.filename} (${payload.fileType})`);

    const rawText = await this.extract(payload);

    if (!rawText || rawText.trim().length === 0) {
      throw new Error(`ExtractionAgent: No text could be extracted from ${payload.filename}`);
    }

    const wordCount = rawText.trim().split(/\s+/).length;

    console.log(`📑  [ExtractionAgent] Extracted ${wordCount} words from ${payload.filename}`);

    // Update status → chunking
    await (this.orchestrator as AgentOrchestrator).updateDocumentStatus(
      payload.documentId,
      'chunking',
    );

    return {
      documentId:  payload.documentId,
      rawText:     rawText.trim(),
      wordCount,
      extractedAt: new Date().toISOString(),
    };
  }

  // ── Parsers ───────────────────────────────────────────────────────────────

  private async extract(payload: FileUploadPayload): Promise<string> {
    switch (payload.fileType) {
      case 'pdf':
        return this.extractPdf(payload.fileBuffer);
      case 'docx':
        return this.extractDocx(payload.fileBuffer);
      case 'txt':
      case 'md':
        return this.extractPlainText(payload.fileBuffer);
      default:
        throw new Error(`ExtractionAgent: Unsupported file type "${payload.fileType}"`);
    }
  }

  private async extractPdf(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      return data.text;
    } catch (err) {
      throw new Error(`ExtractionAgent: PDF parse failed — ${(err as Error).message}`);
    }
  }

  private async extractDocx(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      if (result.messages.length > 0) {
        result.messages.forEach(m => {
          if (m.type === 'warning') console.warn(`[ExtractionAgent] DOCX warning: ${m.message}`);
        });
      }
      return result.value;
    } catch (err) {
      throw new Error(`ExtractionAgent: DOCX parse failed — ${(err as Error).message}`);
    }
  }

  private extractPlainText(buffer: Buffer): string {
    return buffer.toString('utf-8');
  }
}
