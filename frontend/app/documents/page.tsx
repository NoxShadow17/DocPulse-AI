'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, FileText, UploadCloud } from 'lucide-react';
import { UploadZone } from '@/components/UploadZone';
import { DocumentCard } from '@/components/DocumentCard';
import { fetchDocuments, Document } from '@/lib/api';
import styles from './page.module.css';

export default function DocumentsPage() {
  const [docs,    setDocs]    = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDocuments();
      setDocs(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Auto-refresh every 5s if any document is processing
    const interval = setInterval(() => {
      setDocs(prev => {
        const anyProcessing = prev.some(d =>
          ['pending','extracting','chunking'].includes(d.status)
        );
        if (anyProcessing) load();
        return prev;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [load]);

  const handleDeleted = (id: string) =>
    setDocs(prev => prev.filter(d => d.id !== id));

  const handleUploadComplete = () => {
    setTimeout(load, 1000);
  };

  const processing = docs.filter(d => ['pending','extracting','chunking'].includes(d.status));
  const complete   = docs.filter(d => d.status === 'complete');
  const errored    = docs.filter(d => d.status === 'error');

  return (
    <div className={styles.page}>
      <div className="container">

        {/* Page header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>
              <FileText size={28} style={{ color: 'var(--accent-light)' }} />
              Document Library
            </h1>
            <p className={styles.subtitle}>
              Upload files — agents extract and index them automatically.
            </p>
          </div>
          <button
            className="btn btn-ghost"
            onClick={load}
            disabled={loading}
            aria-label="Refresh documents"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Upload zone */}
        <section className={styles.uploadSection}>
          <UploadZone onComplete={handleUploadComplete} />
        </section>

        {error && (
          <div className={styles.errorBanner}>
            ⚠ Could not connect to backend: {error}
          </div>
        )}

        {/* Processing */}
        {processing.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <span className="badge badge-chunking"><span className="dot" />Processing</span>
              {processing.length} document{processing.length !== 1 ? 's' : ''}
            </h2>
            <div className={styles.grid}>
              {processing.map(d => (
                <DocumentCard key={d.id} document={d} onDeleted={handleDeleted} />
              ))}
            </div>
          </section>
        )}

        {/* Indexed */}
        {loading && docs.length === 0 ? (
          <div className={styles.grid}>
            {[1,2,3].map(i => <div key={i} className={`skeleton ${styles.skeletonCard}`} />)}
          </div>
        ) : complete.length > 0 ? (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <span className="badge badge-complete">Indexed</span>
              {complete.length} document{complete.length !== 1 ? 's' : ''}
            </h2>
            <div className={styles.grid}>
              {complete.map(d => (
                <DocumentCard key={d.id} document={d} onDeleted={handleDeleted} />
              ))}
            </div>
          </section>
        ) : !loading && docs.length === 0 ? (
          <div className={styles.empty}>
            <UploadCloud size={40} style={{ color: 'var(--text-muted)' }} />
            <p>No documents yet. Upload your first file above.</p>
          </div>
        ) : null}

        {/* Errored */}
        {errored.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <span className="badge badge-error">Failed</span>
              {errored.length} document{errored.length !== 1 ? 's' : ''}
            </h2>
            <div className={styles.grid}>
              {errored.map(d => (
                <DocumentCard key={d.id} document={d} onDeleted={handleDeleted} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
