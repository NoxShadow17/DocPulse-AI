import Groq from 'groq-sdk';

if (!process.env.GROQ_API_KEY) {
  // Gracefully log or throw depending on environment lifecycle
  console.warn('⚠️  [LLM] Missing GROQ_API_KEY in environment variables.');
}

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

// A robust free tier model on Groq
export const LLM_MODEL = 'llama-3.3-70b-versatile';

/**
 * Synthesizes an answer to the query using retrieved document chunks.
 */
export async function synthesizeAnswer(query: string, chunks: string[]): Promise<string> {
  if (chunks.length === 0) {
    return 'No relevant document sections were found to answer your question.';
  }

  const context = chunks.map((c, i) => `[Source ${i + 1}]:\n${c}`).join('\n\n');

  try {
    const response = await groq.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are DocuPulse AI, an advanced document analysis assistant. 
Your goal is to answer the user's query comprehensively and accurately, relying strictly on the provided document source chunks below.

Guidelines:
1. Ground your answers strictly on the source chunks. Do not hallucinate or assume facts not present in the sources.
2. If the provided chunks do not contain enough information to answer, explain that clearly.
3. Be professional, direct, and construct well-formatted answers in markdown (using lists, bolding, and clear paragraphs for excellent premium presentation).`,
        },
        {
          role: 'user',
          content: `Document Source Chunks:\n${context}\n\nUser Query: ${query}\n\nProvide a comprehensive synthesized answer based only on the sources:`,
        },
      ],
      temperature: 0.2,
      max_tokens: 1024,
    });

    return response.choices[0]?.message?.content || 'No response generated.';
  } catch (error) {
    console.error('❌  [LLM] Groq API synthesis failed:', error);
    return `Failed to synthesize AI answer. (Error: ${(error as Error).message})`;
  }
}
