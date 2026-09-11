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
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

/**
 * Finanz-Guru System Instruction for the AI assistant.
 */
const FINANZ_GURU_INSTRUCTION = `Du bist FINANZ-GURU, ein erfahrener deutscher Finanzexperte und Buchhaltungsberater mit 20 Jahren Erfahrung. Du arbeitest als Analyse-Assistent in einer professionellen Buchhaltungssoftware.

DEINE PERSÖNLICHKEIT:
Professionell aber nahbar. Präzise mit Zahlen. Proaktiv bei Mustern und Risiken.

DEINE EXPERTISE:
Rechnungswesen nach HGB, Cashflow-Analyse, Kundenanalyse, Forderungsmanagement, KPI-Analyse für KMUs.

ANTWORT-FORMAT:
Erste Zeile: Direkte Antwort mit konkreten Zahlen.
Dann: Kurze Einordnung und falls relevant eine Handlungsempfehlung.

WICHTIGE REGELN:
1. Nutze NUR die bereitgestellten Daten, erfinde keine Zahlen
2. Antworte auf Deutsch, professionell aber freundlich
3. Halte Antworten prägnant, maximal drei bis vier Absätze
4. Bei fehlenden Daten sage ehrlich, dass diese nicht verfügbar sind

TEXT-TO-SPEECH REGELN (SEHR WICHTIG):
1. KEINE Markdown-Formatierung verwenden. Keine Sternchen, Unterstriche, Rauten oder Bindestriche als Aufzählungszeichen
2. Schreibe Euro statt dem Eurozeichen
3. Schreibe Prozent statt dem Prozentzeichen
4. Keine Emojis oder Sonderzeichen verwenden
5. Zahlen in Worten wenn es natürlicher klingt
6. Schreibe in natürlichen, flüssigen Sätzen die gut vorgelesen werden können`;

// Allow self-signed certificates in development
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

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
    // Get environment variables (env only, no hardcoded fallback)
    const geminiApiKey =
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      'https://supabase.shadowsinthe.space';

    const supabaseKey =
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ;

    console.log('[RAG API] Using Supabase URL:', supabaseUrl);

    // Initialize clients
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Generate embedding for user query
    const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const embeddingResult = await embeddingModel.embedContent(query);
    const queryEmbedding = embeddingResult.embedding.values;

    // Step 2: Search Supabase vector database
    let matches: any[] = [];
    let useDirectGemini = false;

    try {
      const { data, error: searchError } = await supabase.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: maxDocuments,
      });

      if (searchError) {
        console.warn(
          '[RAG API] Supabase search error, falling back to direct Gemini:',
          searchError
        );
        useDirectGemini = true;
      } else {
        matches = data || [];
      }
    } catch (supabaseError) {
      console.warn('[RAG API] Supabase unavailable, using direct Gemini:', supabaseError);
      useDirectGemini = true;
    }

    // Fallback: Query local database and use Gemini
    if (useDirectGemini || matches.length === 0) {
      // Fetch local database analytics for context
      let localContext = '';
      try {
        // Get all invoices with customer info
        const invoices = await prisma.invoice.findMany({
          include: { customer: true },
          orderBy: { createdAt: 'desc' },
        });

        // Calculate customer revenue
        const customerRevenue = new Map<
          string,
          { name: string; total: number; invoiceCount: number }
        >();
        for (const inv of invoices) {
          const id = inv.customerId;
          const name = inv.customer?.name || 'Unbekannt';
          const current = customerRevenue.get(id) || { name, total: 0, invoiceCount: 0 };
          current.total += inv.total || 0;
          current.invoiceCount += 1;
          customerRevenue.set(id, current);
        }

        // Sort by revenue
        const topCustomers = Array.from(customerRevenue.values())
          .sort((a, b) => b.total - a.total)
          .slice(0, 10);

        // Invoice statistics
        const paidInvoices = invoices.filter((i) => i.status === 'PAID');
        const overdueInvoices = invoices.filter((i) => {
          if (i.status === 'PAID') return false;
          if (!i.dueAt) return false;
          return new Date(i.dueAt) < new Date();
        });
        const totalRevenue = paidInvoices.reduce((sum, i) => sum + (i.total || 0), 0);

        // Get all customers for detailed info
        const customers = await prisma.customer.findMany({
          where: { deletedAt: null },
          include: {
            invoices: {
              where: { deletedAt: null },
              select: { id: true, number: true, total: true, status: true, dueAt: true },
            },
          },
        });

        // Build detailed customer info
        const customerDetails = customers.map((c) => {
          const paid = c.invoices.filter((i) => i.status === 'PAID');
          const open = c.invoices.filter((i) => i.status === 'SENT' || i.status === 'OVERDUE');
          const overdue = c.invoices.filter((i) => i.status === 'OVERDUE');
          const totalPaid = paid.reduce((sum, i) => sum + i.total, 0);
          const totalOpen = open.reduce((sum, i) => sum + i.total, 0);

          return {
            name: c.name,
            email: c.email || 'keine E-Mail',
            phone: c.phone || 'kein Telefon',
            city: c.city || 'keine Stadt',
            taxId: c.taxId || 'keine USt-IdNr',
            invoiceCount: c.invoices.length,
            paidCount: paid.length,
            openCount: open.length,
            overdueCount: overdue.length,
            totalPaid,
            totalOpen,
          };
        });

        // Build context
        localContext = `
LOKALE DATENBANK-ANALYSE:

Gesamtstatistik:
- Anzahl Rechnungen: ${invoices.length}
- Bezahlte Rechnungen: ${paidInvoices.length}
- Überfällige Rechnungen: ${overdueInvoices.length}
- Gesamtumsatz (bezahlt): ${totalRevenue.toFixed(2)} EUR
- Anzahl Kunden: ${customers.length}

Top 10 Kunden nach Umsatz:
${topCustomers.map((c, i) => `${i + 1}. ${c.name}: ${c.total.toFixed(2)} EUR (${c.invoiceCount} Rechnungen)`).join('\n')}

Alle Kunden mit Details:
${customerDetails.map((c) => `- ${c.name} (${c.city}): ${c.invoiceCount} Rechnungen, ${c.totalPaid.toFixed(2)} EUR bezahlt, ${c.totalOpen.toFixed(2)} EUR offen${c.overdueCount > 0 ? `, ${c.overdueCount} überfällig` : ''}, Kontakt: ${c.email}, ${c.phone}`).join('\n')}

Letzte 5 Rechnungen:
${invoices
  .slice(0, 5)
  .map(
    (inv) =>
      `- ${inv.number}: ${inv.customer?.name || 'N/A'} - ${(inv.total || 0).toFixed(2)} EUR (${inv.status})`
  )
  .join('\n')}
`;
      } catch (dbError) {
        console.warn('[RAG API] Local DB query failed:', dbError);
        localContext = 'Lokale Datenbank nicht verfügbar.';
      }

      const chatModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

      const directPrompt = `${FINANZ_GURU_INSTRUCTION}

AKTUELLE GESCHÄFTSDATEN:
${localContext}

BENUTZERANFRAGE: ${query}

DEINE ANTWORT:`;

      const result = await chatModel.generateContent(directPrompt);
      const answer = result.response.text().trim();

      res.status(200).json({
        answer,
        sources: [],
        latencyMs: Date.now() - startTime,
      });
      return;
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
    const chatModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    const prompt = `${FINANZ_GURU_INSTRUCTION}

RELEVANTE DOKUMENTE:
${contextText}

BENUTZERANFRAGE: ${query}

DEINE ANTWORT:`;

    const result = await chatModel.generateContent(prompt);
    const answer = result.response.text().trim();

    // Map sources for response
    const responseSources = sources.map((source: any) => {
      const meta = source.metadata as {
        invoiceNumber?: string;
        customerName?: string;
        amount?: number;
      };
      const result: {
        invoiceNumber?: string;
        customerName?: string;
        amount?: number;
        similarity: number;
      } = { similarity: source.similarity };
      if (meta.invoiceNumber) result.invoiceNumber = meta.invoiceNumber;
      if (meta.customerName) result.customerName = meta.customerName;
      if (meta.amount !== undefined) result.amount = meta.amount;
      return result;
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
