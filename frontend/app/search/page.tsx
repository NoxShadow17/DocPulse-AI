'use client';

import { useState } from 'react';
import { Search, FileText, Sparkles, Hash, Layers } from 'lucide-react';
import { SearchBar } from '@/components/SearchBar';
import { SearchResponse, SearchResult } from '@/lib/api';
import styles from './page.module.css';

export default function SearchPage() {
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [searched, setSearched] = useState(false);

  const handleResults = (res: SearchResponse | null) => {
    setResponse(res);
    setSearched(true);
  };

  return (
    <div className={styles.page}>
      <div className="container">
        {/* Page header */}
        <div className={styles.header}>
          <h1 className={styles.title}>
            <Search size={28} style={{ color: 'var(--accent-light)' }} />
            Semantic Search
          </h1>
          <p className={styles.subtitle}>
            Ask questions or search topics. AI retrieves relevant document chunks matching the semantic concept.
          </p>
        </div>

        {/* Search bar */}
        <section className={styles.searchSection}>
          <SearchBar onResults={handleResults} />
        </section>

        {/* Results */}
        {searched && (
          <section className={styles.resultsSection}>
            {response && response.results.length > 0 ? (
              <div className={styles.resultsHeader}>
                <span>Found {response.count} match{response.count !== 1 ? 'es' : ''} for query</span>
                <span className={styles.queryDisplay}>"{response.query}"</span>
              </div>
            ) : response && response.results.length === 0 ? (
              <div className={styles.empty}>
                <Sparkles size={32} style={{ color: 'var(--text-muted)' }} />
                <p>No semantic matches found above the similarity threshold.</p>
              </div>
            ) : null}

            {/* AI Synthesized Answer Box */}
            {response && response.aiAnswer && (
              <div className={`glass-card ${styles.aiPanel}`}>
                <div className={styles.aiHeader}>
                  <Sparkles size={20} className={styles.aiIcon} />
                  <h3 className={styles.aiTitle}>AI synthesized answer</h3>
                </div>
                <div className={styles.aiBody}>
                  {response.aiAnswer.split('\n').map((line, idx) => {
                    const trimmed = line.trim();
                    if (!trimmed) return <div key={idx} style={{ height: '0.75rem' }} />;
                    
                    // Simple bullet list support
                    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                      return (
                        <ul key={idx} style={{ paddingLeft: '1.25rem', margin: '0.25rem 0' }}>
                          <li style={{ listStyleType: 'disc' }}>{trimmed.substring(2)}</li>
                        </ul>
                      );
                    }
                    
                    // Simple numbered list support
                    const match = trimmed.match(/^(\d+)\.\s(.*)/);
                    if (match) {
                      return (
                        <ol key={idx} style={{ paddingLeft: '1.25rem', margin: '0.25rem 0' }}>
                          <li style={{ listStyleType: 'decimal' }}>{match[2]}</li>
                        </ol>
                      );
                    }

                    return <p key={idx}>{trimmed}</p>;
                  })}
                </div>
              </div>
            )}

            {response && response.results.length > 0 && (
              <div className={styles.grid}>
                {response.results.map((result: SearchResult) => (
                  <div key={result.chunkId} className={`glass-card ${styles.card}`}>
                    <div className={styles.cardHeader}>
                      <div className={styles.docInfo}>
                        <FileText size={16} className={styles.docIcon} />
                        <span className={styles.docName} title={result.document?.filename ?? 'Unknown File'}>
                          {result.document?.filename ?? 'Unknown Document'}
                        </span>
                      </div>
                      <div className={styles.scoreBadge} title="Cosine Similarity Score">
                        <Sparkles size={12} />
                        {(result.similarity * 100).toFixed(0)}% Match
                      </div>
                    </div>

                    <p className={styles.content}>{result.content}</p>

                    <div className={styles.cardFooter}>
                      <div className={styles.metaItem}>
                        <Layers size={12} />
                        <span>ChunkIndex {result.chunkIndex}</span>
                      </div>
                      {result.metadata && typeof result.metadata.totalChunks === 'number' && (
                        <div className={styles.metaItem}>
                          <Hash size={12} />
                          <span>of {result.metadata.totalChunks}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
