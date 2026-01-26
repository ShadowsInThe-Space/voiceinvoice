/**
 * Mock RAG Chat API Route
 *
 * Uses local SQLite invoices instead of Supabase.
 * Fallback for demo when Supabase is not available.
 *
 * @module api/chat/rag-mock
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaClient, Invoice, Customer } from '@/generated/prisma';

const prisma = new PrismaClient();

interface RAGRequest {
  query: string;
}

interface RAGResponse {
  answer: string;
  sources?: Array<{
    invoiceNumber?: string;
    customerName?: string;
    amount?: number;
  }>;
  latencyMs?: number;
}

interface RAGErrorResponse {
  error: string;
}

/**
 *
 * @param req
 * @param res
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RAGResponse | RAGErrorResponse>
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { query }: RAGRequest = req.body;
  const startTime = Date.now();

  if (!query || typeof query !== 'string') {
    res.status(400).json({ error: 'Missing or invalid query parameter' });
    return;
  }

  try {
    // Get all invoices from SQLite
    const invoices = await prisma.invoice.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
      },
    });

    if (invoices.length === 0) {
      res.status(200).json({
        answer:
          'Sie haben noch keine Rechnungen erstellt. Erstellen Sie zuerst eine Rechnung über die Sprachsteuerung!',
        sources: [],
        latencyMs: Date.now() - startTime,
      });
      return;
    }

    // Build context from invoices
    const contextText = invoices
      .map((inv: Invoice & { customer: Customer | null }, idx: number) => {
        return `[Rechnung ${idx + 1}]
Rechnungsnummer: ${inv.number}
Kunde: ${inv.customer?.name || 'Unbekannt'}
Betrag: ${inv.total}€
Datum: ${inv.issuedAt?.toISOString().split('T')[0] || 'N/A'}
Status: ${inv.status || 'Offen'}
`;
      })
      .join('\n\n');

    // Generate answer with Gemini
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    if (!geminiApiKey) {
      throw new Error('Missing Gemini API key');
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `Du bist ein Finanz-Assistent für ein deutsches Buchhaltungssystem.

KONTEXT (Aktuelle Rechnungen):
${contextText}

FRAGE: ${query}

ANWEISUNG:
- Beantworte die Frage basierend NUR auf den gegebenen Rechnungen
- Verwende konkrete Zahlen und Daten
- Antworte auf Deutsch in einem freundlichen, professionellen Ton
- Wenn die Informationen nicht vorhanden sind, sage das ehrlich
- Fasse die Antwort kurz und präzise zusammen (max 3-4 Sätze)

ANTWORT:`;

    const result = await model.generateContent(prompt);
    const answer = result.response.text().trim();

    // Map sources
    const sources = invoices.slice(0, 5).map((inv: Invoice & { customer: Customer | null }) => ({
      invoiceNumber: inv.number,
      customerName: inv.customer?.name || 'Unbekannt',
      amount: inv.total || 0,
    }));

    res.status(200).json({
      answer,
      sources,
      latencyMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error('[Mock RAG API] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'RAG query failed';

    res.status(500).json({ error: errorMessage });
  }
}
