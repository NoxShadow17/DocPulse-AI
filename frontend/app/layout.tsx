import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'DocuPulse AI — Intelligent Document Intelligence',
  description:
    'Enterprise-grade AI document processing with multi-agent extraction, semantic chunking, and vector search powered by OpenAI and Supabase.',
  keywords: ['document AI', 'vector search', 'RAG', 'document intelligence', 'multi-agent'],
  authors: [{ name: 'DocuPulse AI' }],
  openGraph: {
    title: 'DocuPulse AI',
    description: 'Intelligent Document Intelligence Platform',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Navbar />
        <main style={{ position: 'relative', zIndex: 1 }}>
          {children}
        </main>
      </body>
    </html>
  );
}
