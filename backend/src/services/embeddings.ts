import { pipeline } from '@xenova/transformers';

let extractorPromise: any = null;

async function getExtractor() {
  if (!extractorPromise) {
    console.log('🔄  [Embeddings] Initializing local Xenova/all-MiniLM-L6-v2 pipeline...');
    extractorPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return extractorPromise;
}

export const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
export const EMBEDDING_DIMENSIONS = 384;

/**
 * Generate a single 384-dimensional embedding vector for the given text.
 */
export async function embedText(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text.replace(/\n/g, ' '), {
    pooling: 'mean',
    normalize: true,
  });
  return Array.from(output.data);
}

/**
 * Generate embedding vectors for a batch of texts.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const extractor = await getExtractor();
  const results: number[][] = [];
  
  // Extract individually to handle varying text sequences smoothly in JS
  for (const text of texts) {
    const output = await extractor(text.replace(/\n/g, ' '), {
      pooling: 'mean',
      normalize: true,
    });
    results.push(Array.from(output.data));
  }
  
  return results;
}
