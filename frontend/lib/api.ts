const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface Document {
  id:          string;
  filename:    string;
  file_type:   string;
  file_size:   number;
  status:      'pending' | 'extracting' | 'chunking' | 'complete' | 'error';
  chunk_count: number;
  error_msg:   string | null;
  created_at:  string;
  updated_at:  string;
}

export interface SearchResult {
  chunkId:    string;
  documentId: string;
  chunkIndex: number;
  content:    string;
  similarity: number;
  metadata:   Record<string, unknown>;
  document:   { filename: string; file_type: string } | null;
}

export interface SearchResponse {
  query:     string;
  count:     number;
  results:   SearchResult[];
  aiAnswer?: string;
}

export interface UploadResponse {
  documentId: string;
  filename:   string;
  fileType:   string;
  fileSize:   number;
  status:     string;
  message:    string;
}

// ── Documents ────────────────────────────────────────────────────────────────

export async function fetchDocuments(): Promise<Document[]> {
  const res = await fetch(`${API_URL}/api/documents`);
  if (!res.ok) throw new Error('Failed to fetch documents');
  const data = await res.json();
  return data.documents;
}

export async function fetchDocument(id: string): Promise<{
  document:   Document;
  chunkCount: number;
  agentRuns:  unknown[];
}> {
  const res = await fetch(`${API_URL}/api/documents/${id}`);
  if (!res.ok) throw new Error('Document not found');
  return res.json();
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/documents/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete document');
}

// ── Upload ───────────────────────────────────────────────────────────────────

export async function uploadFile(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        const msg = JSON.parse(xhr.responseText)?.error ?? 'Upload failed';
        reject(new Error(msg));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));

    xhr.open('POST', `${API_URL}/api/upload`);
    xhr.send(formData);
  });
}

// ── Search ───────────────────────────────────────────────────────────────────

export async function semanticSearch(
  query:          string,
  matchThreshold: number = 0.7,
  matchCount:     number = 10,
  documentId?:    string,
): Promise<SearchResponse> {
  const res = await fetch(`${API_URL}/api/search`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ query, matchThreshold, matchCount, documentId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Search failed');
  }
  return res.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 ** 2)  return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}
