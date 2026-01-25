/**
 * RAG Agent - Retrieval-Augmented Generation for Invoice Search
 *
 * Provides semantic search over invoices using Supabase Vector DB
 * and Gemini embeddings + chat.
 *
 * @module ai-orchestrator/rag-agent
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Input for RAG query.
 */
export interface RAGQueryInput {
  /** User's question */
  query: string;
  /** Maximum number of documents to retrieve */
  maxDocuments?: number;
  /** Minimum similarity threshold (0-1) */
  similarityThreshold?: number;
}

/**
 * Single search result from vector database.
 */
export interface RAGSearchResult {
  /** Document ID */
  id: number;
  /** Document content */
  content: string;
  /** Document metadata (invoice data) */
  metadata: Record<string, unknown>;
  /** Similarity score (0-1) */
  similarity: number;
}

/**
 * Output from RAG query.
 */
export interface RAGQueryOutput {
  /** Generated answer */
  answer: string;
  /** Source documents used for answer */
  sources: RAGSearchResult[];
  /** Confidence score (0-1) */
  confidence: number;
  /** Processing time in ms */
  latencyMs: number;
}

/**
 * RAG Agent configuration.
 */
export interface RAGConfig {
  /** Gemini API key */
  geminiApiKey: string;
  /** Supabase URL */
  supabaseUrl: string;
  /** Supabase service role key */
  supabaseKey: string;
  /** Embedding model (default: text-embedding-004) */
  embeddingModel?: string;
  /** Chat model (default: gemini-2.0-flash-exp) */
  chatModel?: string;
}

/**
 * RAG Agent for semantic invoice search.
 *
 * Combines vector search with LLM generation for natural language
 * queries about invoices and financial data.
 */
export class RAGAgent {
  private genAI: GoogleGenerativeAI;
  private supabase: SupabaseClient;
  private embeddingModel: string;
  private chatModel: string;

  /**
   * Creates a new RAG Agent.
   *
   * @param {RAGConfig} config - Agent configuration
   */
  constructor(config: RAGConfig) {
    this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.embeddingModel = config.embeddingModel || 'text-embedding-004';
    this.chatModel = config.chatModel || 'gemini-2.0-flash-exp';
  }

  /**
   * Query documents using RAG.
   *
   * @param {RAGQueryInput} input - Query input
   * @returns {Promise<RAGQueryOutput>} Query results with answer
   *
   * @example
   * ```typescript
   * const result = await agent.query({
   *   query: 'Wie viel Umsatz hatten wir letzten Monat?',
   *   maxDocuments: 5
   * });
   * console.log(result.answer);
   * ```
   */
  async query(input: RAGQueryInput): Promise<RAGQueryOutput> {
    const startTime = Date.now();
    const maxDocs = input.maxDocuments || 5;
    const threshold = input.similarityThreshold || 0.7;

    try {
      // Step 1: Generate embedding for user query
      const queryEmbedding = await this.generateEmbedding(input.query);

      // Step 2: Search vector database
      const searchResults = await this.searchDocuments(queryEmbedding, threshold, maxDocs);

      // Step 3: Generate answer with context
      const answer = await this.generateAnswer(input.query, searchResults);

      const latencyMs = Date.now() - startTime;

      return {
        answer,
        sources: searchResults,
        confidence: this.calculateConfidence(searchResults),
        latencyMs,
      };
    } catch (error) {
      console.error('[RAG Agent] Error:', error);
      throw new Error(
        `RAG query failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate embedding vector for text using Gemini.
   *
   * @param {string} text - Text to embed
   * @returns {Promise<number[]>} 768-dimensional embedding vector
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: this.embeddingModel,
      });

      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      console.error('[RAG Agent] Embedding error:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  /**
   * Search documents using vector similarity.
   *
   * @param {number[]} queryEmbedding - Query embedding vector
   * @param {number} threshold - Minimum similarity (0-1)
   * @param {number} limit - Maximum results
   * @returns {Promise<RAGSearchResult[]>} Matching documents
   */
  private async searchDocuments(
    queryEmbedding: number[],
    threshold: number,
    limit: number
  ): Promise<RAGSearchResult[]> {
    try {
      const { data, error } = await this.supabase.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: limit,
      });

      if (error) {
        throw error;
      }

      return (data || []).map((doc: RAGSearchResult) => ({
        id: doc.id,
        content: doc.content,
        metadata: doc.metadata,
        similarity: doc.similarity,
      }));
    } catch (error) {
      console.error('[RAG Agent] Search error:', error);
      throw new Error('Vector search failed');
    }
  }

  /**
   * Generate answer using retrieved context.
   *
   * @param {string} query - User's question
   * @param {RAGSearchResult[]} context - Retrieved documents
   * @returns {Promise<string>} Generated answer
   */
  private async generateAnswer(query: string, context: RAGSearchResult[]): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.chatModel });

      // Build context from search results
      const contextText = context
        .map((doc, idx) => {
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

      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      console.error('[RAG Agent] Generation error:', error);
      throw new Error('Answer generation failed');
    }
  }

  /**
   * Calculate confidence score based on search results.
   *
   * @param {RAGSearchResult[]} results - Search results
   * @returns {number} Confidence score (0-1)
   */
  private calculateConfidence(results: RAGSearchResult[]): number {
    if (results.length === 0) return 0;

    // Average similarity of top results
    const avgSimilarity = results.reduce((sum, r) => sum + r.similarity, 0) / results.length;

    return avgSimilarity;
  }

  /**
   * Ingest a document into the vector database.
   *
   * @param {string} content - Document content
   * @param {Record<string, unknown>} metadata - Document metadata
   * @returns {Promise<number>} Inserted document ID
   *
   * @example
   * ```typescript
   * await agent.ingestDocument(
   *   'Rechnung RE-2024-001 für Kunde Mustermann GmbH...',
   *   { invoiceNumber: 'RE-2024-001', amount: 5000, date: '2024-01-15' }
   * );
   * ```
   */
  async ingestDocument(content: string, metadata: Record<string, unknown>): Promise<number> {
    try {
      // Generate embedding
      const embedding = await this.generateEmbedding(content);

      // Insert into database
      const { data, error } = await this.supabase
        .from('documents')
        .insert({
          content,
          metadata,
          embedding,
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      return data.id;
    } catch (error) {
      console.error('[RAG Agent] Ingest error:', error);
      throw new Error('Document ingestion failed');
    }
  }
}

/**
 * Create RAG Agent from environment variables.
 *
 * @returns {RAGAgent} Configured RAG agent
 * @throws {Error} If required environment variables are missing
 */
export function createRAGAgentFromEnv(): RAGAgent {
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!geminiApiKey) {
    throw new Error('Missing GEMINI_API_KEY or NEXT_PUBLIC_GOOGLE_API_KEY');
  }
  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!supabaseKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return new RAGAgent({
    geminiApiKey,
    supabaseUrl,
    supabaseKey,
  });
}
