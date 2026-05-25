'use client';

import { useState, useRef, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { semanticSearch, SearchResponse } from '@/lib/api';
import styles from './SearchBar.module.css';

interface Props {
  onResults?: (res: SearchResponse | null) => void;
  documentId?: string;
}

export function SearchBar({ onResults, documentId }: Props) {
  const [query,     setQuery]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) { onResults?.(null); return; }
    setLoading(true);
    setError(null);
    try {
      const results = await semanticSearch(q, 0.65, 10, documentId);
      onResults?.(results);
    } catch (err) {
      setError((err as Error).message);
      onResults?.(null);
    } finally {
      setLoading(false);
    }
  }, [onResults, documentId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), 500);
  };

  const clear = () => {
    setQuery('');
    setError(null);
    onResults?.(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.inputWrap} ${error ? styles.hasError : ''}`}>
        <Search size={18} className={styles.searchIcon} />
        <input
          id="semantic-search-input"
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="Ask anything about your documents…"
          className={styles.input}
          autoComplete="off"
          spellCheck={false}
        />
        {loading && <Loader2 size={16} className={`animate-spin ${styles.loader}`} />}
        {query && !loading && (
          <button onClick={clear} className={styles.clearBtn} aria-label="Clear search">
            <X size={14} />
          </button>
        )}
      </div>
      {error && <p className={styles.errorMsg}>{error}</p>}
    </div>
  );
}
