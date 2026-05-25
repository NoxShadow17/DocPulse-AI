'use client';

import { FileText, Trash2, Clock, Hash } from 'lucide-react';
import { Document, deleteDocument, formatFileSize, formatDate } from '@/lib/api';
import styles from './DocumentCard.module.css';

interface Props {
  document:  Document;
  onDeleted: (id: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  pending:    'Pending',
  extracting: 'Extracting',
  chunking:   'Chunking',
  complete:   'Indexed',
  error:      'Error',
};

export function DocumentCard({ document: doc, onDeleted }: Props) {
  const handleDelete = async () => {
    if (!confirm(`Delete "${doc.filename}"? This cannot be undone.`)) return;
    try {
      await deleteDocument(doc.id);
      onDeleted(doc.id);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className={`glass-card ${styles.card}`}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.fileIcon}>
          <FileText size={20} />
        </div>
        <div className={styles.meta}>
          <span className={styles.filename} title={doc.filename}>
            {doc.filename}
          </span>
          <span className={styles.filetype}>
            {doc.file_type.toUpperCase()} · {formatFileSize(doc.file_size)}
          </span>
        </div>
        <span className={`badge badge-${doc.status}`}>
          {['pending','extracting','chunking'].includes(doc.status) && (
            <span className="dot" />
          )}
          {STATUS_LABELS[doc.status] ?? doc.status}
        </span>
      </div>

      {/* Error message */}
      {doc.status === 'error' && doc.error_msg && (
        <div className={styles.errorMsg}>{doc.error_msg}</div>
      )}

      {/* Stats */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <Hash size={13} />
          <span>{doc.chunk_count.toLocaleString()} chunks</span>
        </div>
        <div className={styles.stat}>
          <Clock size={13} />
          <span>{formatDate(doc.created_at)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <button
          className="btn btn-danger"
          onClick={handleDelete}
          aria-label={`Delete ${doc.filename}`}
          style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
        >
          <Trash2 size={13} />
          Delete
        </button>
      </div>
    </div>
  );
}
