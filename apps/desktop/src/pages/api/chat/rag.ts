/**
 * RAG Chat API Route
 *
 * Handles RAG queries using direct Supabase Vector DB integration.
 * Inline implementation for Next.js compatibility.
 *
 * @module api/chat/rag
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

/**
 * Request body for RAG query.
 */
interface RAGRequest {
  /** User's question */
  query: string;
  /** Optional: max documents to retrieve */
  maxDocuments?: number;
}

/**
 * Response from RAG query.
 */
interface RAGResponse {
  /** Generated answer */
  answer: string;
  /** Source documents */
  sources?: Array<{
    invoiceNumber?: string;
    customerName?: string;
    amount?: number;
    similarity: number;
  }>;
  /** Processing latency in ms */
  latencyMs?: number;
}

/**
 * Error response.
 */
interface RAGErrorResponse {
  /** Error message */
  error: string;
}

/**
 * RAG Chat API endpoint.
 *
 * POST /api/chat/rag
 * Body: { query, maxDocuments? }
 * Returns: { answer, sources?, latencyMs? }
 *
 * @param {NextApiRequest} req - Next.js API request
 * @param {NextApiResponse} res - Next.js API response
 * @returns {Promise<void>} Response with answer or error
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RAGResponse | RAGErrorResponse>
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { query, maxDocuments = 5 }: RAGRequest = req.body;
  const startTime = Date.now();

  // Validate input
  if (!query || typeof query !== 'string') {
    res.status(400).json({ error: 'Missing or invalid query parameter' });
    return;
  }

  try {
    // Get environment variables
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!geminiApiKey) {
      throw new Error('Missing Gemini API key');
    }
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    // Initialize clients
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Generate embedding for user query
    const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const embeddingResult = await embeddingModel.embedContent(query);
    const queryEmbedding = embeddingResult.embedding.values;

    // Step 2: Search Supabase vector database
    const { data: matches, error: searchError } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: maxDocuments,
    });

    if (searchError) {
      console.error('[RAG API] Supabase search error:', searchError);
      throw new Error(`Vector search failed: ${searchError.message}`);
    }

    // Step 3: Build context from search results
    const sources = (matches || []).map((doc: any) => ({
      id: doc.id,
      content: doc.content,
      metadata: doc.metadata,
      similarity: doc.similarity,
    }));

    if (sources.length === 0) {
      // No documents found
      res.status(200).json({
        answer:
          'Ich konnte keine relevanten Rechnungen oder Dokumente zu Ihrer Frage finden. Bitte stellen Sie sicher, dass Daten vorhanden sind.',
        sources: [],
        latencyMs: Date.now() - startTime,
      });
      return;
    }

    // Build context text
    const contextText = sources
      .map((doc: any, idx: number) => {
        const meta = doc.metadata as {
          invoiceNumber?: string;
          customerName?: string;
          amount?: number;
          date?: string;
        };
        return `[Dokument ${idx + 1}]
Rechnung: ${meta.invoiceNumber || 'N/A'}
Kunde: ${meta.customerName || 'N/A'}
Betrag: ${meta.amount || 'N/A'}€
Datum: ${meta.date || 'N/A'}
Details: ${doc.content}
`;
      })
      .join('\n\n');

    // Step 4: Generate answer with Gemini
    const chatModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `Du bist ein Finanz-Assistent für ein deutsches Buchhaltungssystem.

KONTEXT (Relevante Rechnungen):
${contextText}

FRAGE: ${query}

ANWEISUNG:
- Beantworte die Frage basierend NUR auf dem gegebenen Kontext
- Verwende konkrete Zahlen und Daten aus den Rechnungen
- Antworte auf Deutsch in einem freundlichen, professionellen Ton
- Wenn die Informationen nicht im Kontext sind, sage das ehrlich
- Fasse die Antwort kurz und präzise zusammen

ANTWORT:`;

    const result = await chatModel.generateContent(prompt);
    const answer = result.response.text().trim();

    // Map sources for response
    const responseSources = sources.map((source: any) => {
      const meta = source.metadata as {
        invoiceNumber?: string;
        customerName?: string;
        amount?: number;
      };
      return {
        invoiceNumber: meta.invoiceNumber,
        customerName: meta.customerName,
        amount: meta.amount,
        similarity: source.similarity,
      };
    });

    res.status(200).json({
      answer,
      sources: responseSources,
      latencyMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error('[RAG API] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'RAG query failed';

    // Don't expose internal errors in production
    const sanitizedMessage =
      process.env.NODE_ENV === 'production' ? 'Chat service temporarily unavailable' : errorMessage;

    res.status(500).json({ error: sanitizedMessage });
  }
}
