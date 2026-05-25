'use client';

import { useCallback, useRef, useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';
import { uploadFile, UploadResponse } from '@/lib/api';
import styles from './UploadZone.module.css';

interface UploadedFile {
  file:     File;
  status:   'uploading' | 'processing' | 'complete' | 'error';
  progress: number;
  result?:  UploadResponse;
  error?:   string;
}

interface Props {
  onComplete?: (result: UploadResponse) => void;
}

const ACCEPTED = '.pdf,.docx,.txt,.md';
const MAX_SIZE = 50 * 1024 * 1024;

export function UploadZone({ onComplete }: Props) {
  const [isDragging,  setIsDragging]  = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (file.size > MAX_SIZE) {
      setUploadedFiles(prev => [...prev, {
        file, status: 'error', progress: 0,
        error: 'File too large — maximum 50 MB',
      }]);
      return;
    }

    const entry: UploadedFile = { file, status: 'uploading', progress: 0 };
    setUploadedFiles(prev => [...prev, entry]);

    try {
      const result = await uploadFile(file, (pct) => {
        setUploadedFiles(prev =>
          prev.map(f => f.file === file ? { ...f, progress: pct } : f)
        );
      });

      setUploadedFiles(prev =>
        prev.map(f => f.file === file
          ? { ...f, status: 'processing', progress: 100, result }
          : f
        )
      );

      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/documents/${result.documentId}`
          );
          const data = await res.json();
          const status = data.document?.status;

          if (status === 'complete' || status === 'error') {
            clearInterval(pollInterval);
            setUploadedFiles(prev =>
              prev.map(f => f.file === file
                ? { ...f, status: status === 'complete' ? 'complete' : 'error',
                    error: status === 'error' ? data.document.error_msg : undefined }
                : f
              )
            );
            if (status === 'complete') onComplete?.(result);
          }
        } catch {
          clearInterval(pollInterval);
        }
      }, 2000);

      // Max wait 3 minutes
      setTimeout(() => clearInterval(pollInterval), 180_000);

    } catch (err) {
      setUploadedFiles(prev =>
        prev.map(f => f.file === file
          ? { ...f, status: 'error', error: (err as Error).message }
          : f
        )
      );
    }
  }, [onComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    Array.from(e.dataTransfer.files).forEach(processFile);
  }, [processFile]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach(processFile);
    if (inputRef.current) inputRef.current.value = '';
  }, [processFile]);

  const remove = (file: File) =>
    setUploadedFiles(prev => prev.filter(f => f.file !== file));

  return (
    <div className={styles.wrapper}>
      {/* Drop zone */}
      <div
        className={`${styles.dropzone} ${isDragging ? styles.dragging : ''}`}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
        aria-label="Upload document — click or drag and drop"
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          multiple
          onChange={handleInput}
          style={{ display: 'none' }}
        />

        <div className={styles.icon}>
          <UploadCloud size={32} />
        </div>

        <p className={styles.title}>
          {isDragging ? 'Drop files here' : 'Drop files or click to upload'}
        </p>
        <p className={styles.subtitle}>PDF, DOCX, TXT, MD — up to 50 MB each</p>

        <div className={styles.formatBadges}>
          {['PDF', 'DOCX', 'TXT', 'MD'].map(f => (
            <span key={f} className={styles.formatBadge}>{f}</span>
          ))}
        </div>
      </div>

      {/* File list */}
      {uploadedFiles.length > 0 && (
        <div className={styles.fileList}>
          {uploadedFiles.map((uf, i) => (
            <div key={i} className={styles.fileItem}>
              <div className={styles.fileIcon}>
                <FileText size={18} />
              </div>

              <div className={styles.fileInfo}>
                <span className={styles.fileName}>{uf.file.name}</span>
                <span className={styles.fileMeta}>
                  {(uf.file.size / 1024).toFixed(0)} KB
                  {uf.status === 'uploading' && ` · Uploading ${uf.progress}%`}
                  {uf.status === 'processing' && ' · Agents processing…'}
                  {uf.status === 'complete'   && ' · Indexed ✓'}
                  {uf.status === 'error'      && ` · ${uf.error}`}
                </span>

                {uf.status === 'uploading' && (
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${uf.progress}%` }}
                    />
                  </div>
                )}

                {uf.status === 'processing' && (
                  <div className={styles.agentStatus}>
                    <AgentStep label="ExtractionAgent" active />
                    <AgentStep label="ChunkingAgent"   active />
                  </div>
                )}
              </div>

              <div className={styles.fileStatusIcon}>
                {uf.status === 'uploading'  && <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent-light)' }} />}
                {uf.status === 'processing' && <Loader2 size={16} className="animate-spin" style={{ color: 'var(--status-chunk)' }} />}
                {uf.status === 'complete'   && <CheckCircle2 size={16} style={{ color: 'var(--status-complete)' }} />}
                {uf.status === 'error'      && <AlertCircle  size={16} style={{ color: 'var(--status-error)' }} />}
              </div>

              <button
                className={styles.removeBtn}
                onClick={(e) => { e.stopPropagation(); remove(uf.file); }}
                aria-label="Remove file"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentStep({ label, active }: { label: string; active: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: active ? 'var(--accent-light)' : 'var(--text-muted)' }}>
      {active
        ? <Loader2 size={10} className="animate-spin" />
        : <CheckCircle2 size={10} />
      }
      {label}
    </div>
  );
}
