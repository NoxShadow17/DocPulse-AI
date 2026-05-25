'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  UploadCloud, FileText, Search, Zap, Brain, GitBranch, ChevronRight,
  TrendingUp, Clock, CheckCircle2,
} from 'lucide-react';
import { fetchDocuments, Document } from '@/lib/api';
import styles from './page.module.css';

const FEATURES = [
  {
    icon: Brain,
    title: 'Multi-Agent Pipeline',
    desc:  'ExtractionAgent and ChunkingAgent spawn automatically on upload, processing documents in parallel.',
  },
  {
    icon: Zap,
    title: 'Semantic Vector Search',
    desc:  'Supabase pgvector with HNSW index enables sub-second similarity search across millions of chunks.',
  },
  {
    icon: GitBranch,
    title: 'Enterprise Architecture',
    desc:  'Modular skill manifest, concurrency control, retry logic, and full TypeScript type safety.',
  },
];

export default function HomePage() {
  const [docs,    setDocs]    = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocuments()
      .then(setDocs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const complete   = docs.filter(d => d.status === 'complete').length;
  const processing = docs.filter(d => ['pending','extracting','chunking'].includes(d.status)).length;
  const totalChunks = docs.reduce((s, d) => s + d.chunk_count, 0);

  return (
    <div className={styles.page}>
      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroBadge}>
          <Zap size={12} />
          Multi-Agent AI Pipeline
        </div>

        <h1 className={styles.heroTitle}>
          Document Intelligence<br />
          <span className="gradient-text">Powered by Agents</span>
        </h1>

        <p className={styles.heroSubtitle}>
          Upload any document. ExtractionAgent and ChunkingAgent process it
          automatically — then search your entire knowledge base with semantic AI.
        </p>

        <div className={styles.heroCta}>
          <Link href="/documents" className="btn btn-primary">
            <UploadCloud size={16} />
            Upload Document
          </Link>
          <Link href="/search" className="btn btn-ghost">
            <Search size={16} />
            Semantic Search
          </Link>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className={`container ${styles.statsRow}`}>
        <StatCard icon={FileText}    label="Total Documents" value={loading ? '—' : docs.length.toString()} />
        <StatCard icon={CheckCircle2} label="Indexed"         value={loading ? '—' : complete.toString()} color="var(--status-complete)" />
        <StatCard icon={Clock}       label="Processing"       value={loading ? '—' : processing.toString()} color="var(--status-chunk)" />
        <StatCard icon={TrendingUp}  label="Total Chunks"     value={loading ? '—' : totalChunks.toLocaleString()} />
      </section>

      {/* ── Features ── */}
      <section className={`container ${styles.features}`}>
        <h2 className={styles.sectionTitle}>How It Works</h2>
        <div className={styles.featureGrid}>
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className={`glass-card ${styles.featureCard}`}>
              <div className={styles.featureIcon}>
                <Icon size={22} />
              </div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pipeline diagram ── */}
      <section className={`container ${styles.pipeline}`}>
        <h2 className={styles.sectionTitle}>Agent Pipeline</h2>
        <div className={styles.pipelineFlow}>
          {['File Upload', 'ExtractionAgent', 'ChunkingAgent', 'Supabase Vector'].map((step, i, arr) => (
            <div key={step} className={styles.pipelineStep}>
              <div className={`glass-card ${styles.pipelineBox}`}>
                <span className={styles.pipelineIndex}>{i + 1}</span>
                <span className={styles.pipelineLabel}>{step}</span>
              </div>
              {i < arr.length - 1 && (
                <ChevronRight size={20} className={styles.pipelineArrow} />
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, color,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className={`glass-card ${styles.statCard}`}>
      <div className={styles.statIcon} style={{ color: color ?? 'var(--accent-light)' }}>
        <Icon size={20} />
      </div>
      <div>
        <div className={styles.statValue} style={{ color: color ?? 'var(--text-primary)' }}>
          {value}
        </div>
        <div className={styles.statLabel}>{label}</div>
      </div>
    </div>
  );
}
