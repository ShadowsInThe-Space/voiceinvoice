/**
 * Voice Processing API Route
 *
 * Handles voice-to-invoice processing:
 * 1. Receives audio blob
 * 2. Transcribes with Gemini 2.0 Flash (multimodal audio support)
 * 3. Extracts entities with Gemini 2.5 Flash
 * 4. Returns invoice data
 *
 * @module api/voice/process
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';
import formidable from 'formidable';
import fs from 'fs';

/**
 * Disable body parser to handle multipart/form-data.
 */
export const config = {
  api: {
    bodyParser: false,
  },
};

interface VoiceProcessResponse {
  success: boolean;
  transcription: string;
  confidence: number;
  invoice?: {
    id: string;
    number: string;
    customerId: string;
    customer: { id: string; name: string };
    items: Array<{
      id: string;
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    total: number;
    status: string;
    createdAt: string;
  };
}

interface VoiceProcessErrorResponse {
  success: false;
  error: string;
}

/**
 * Voice processing API endpoint.
 *
 * POST /api/voice/process
 * Body: multipart/form-data with 'audio' file
 * Returns: { success, transcription, confidence, invoice? }
 * @param req
 * @param res
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VoiceProcessResponse | VoiceProcessErrorResponse>
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    // Parse multipart form data
    const form = formidable({});
    const [, files] = await form.parse(req);

    const audioFile = files.audio?.[0];
    if (!audioFile) {
      res.status(400).json({ success: false, error: 'Missing audio file' });
      return;
    }

    console.log('[Voice API] Processing audio:', {
      size: audioFile.size,
      type: audioFile.mimetype,
      path: audioFile.filepath,
    });

    // Read audio file as base64
    const audioBuffer = await fs.promises.readFile(audioFile.filepath);
    const audioBase64 = audioBuffer.toString('base64');

    // Step 1: Transcribe with Gemini (Audio-to-Text capability)
    console.log('[Voice API] Starting Gemini audio transcription...');
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    if (!geminiApiKey) {
      throw new Error('Missing Gemini API key');
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const transcriptionModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const transcriptionPrompt = [
      {
        inlineData: {
          mimeType: audioFile.mimetype || 'audio/webm',
          data: audioBase64,
        },
      },
      {
        text: 'Transkribiere dieses deutsche Audio präzise. Gib nur den transkribierten Text zurück, keine Erklärungen.',
      },
    ];

    const transcriptionResponse = await transcriptionModel.generateContent(transcriptionPrompt);
    const transcription = transcriptionResponse.response.text().trim();
    console.log('[Voice API] Gemini transcription:', transcription);

    if (!transcription || transcription.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: 'Keine Sprache im Audio erkannt',
      });
      return;
    }

    // Step 2: Extract invoice data with Gemini
    console.log('[Voice API] Extracting invoice data with Gemini...');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const extractionPrompt = `Du bist ein Rechnungs-Extraktions-Assistent für deutsche Buchhaltung.

TRANSKRIPT: "${transcription}"

Extrahiere die folgenden Informationen und gib sie als JSON zurück:
{
  "customerName": "Name des Kunden (falls erwähnt, sonst 'Unbekannt')",
  "description": "Leistungsbeschreibung",
  "amount": <Netto-Betrag als Zahl>,
  "taxRate": <MwSt-Satz als Zahl, Standard 19>
}

WICHTIG:
- Wenn kein Betrag genannt wird, setze amount auf 0
- Wenn kein MwSt-Satz genannt wird, nutze 19
- Gib NUR valides JSON zurück, keine Erklärungen, kein Markdown`;

    const extractionResult = await model.generateContent(extractionPrompt);
    let extractedData: any;

    try {
      const jsonText = extractionResult.response.text().trim();
      // Remove markdown code blocks if present
      const cleanJson = jsonText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      extractedData = JSON.parse(cleanJson);
      console.log('[Voice API] Extracted data:', extractedData);
    } catch (err) {
      console.error('[Voice API] JSON parse error:', err);
      console.error('[Voice API] Raw response:', extractionResult.response.text());
      // Fallback to default values
      extractedData = {
        customerName: 'Unbekannt',
        description: transcription,
        amount: 0,
        taxRate: 19,
      };
    }

    // Step 3: Build invoice object
    const amount = extractedData.amount || 0;
    const taxRate = extractedData.taxRate || 19;
    const taxAmount = amount * (taxRate / 100);
    const total = amount + taxAmount;

    const invoice = {
      id: 'inv-' + Date.now(),
      number: 'RE-2025-' + String(Math.floor(Math.random() * 1000)).padStart(3, '0'),
      customerId: 'c-voice',
      customer: {
        id: 'c-voice',
        name: extractedData.customerName || 'Unbekannter Kunde',
      },
      items: [
        {
          id: 'item-1',
          description: extractedData.description || 'Leistung',
          quantity: 1,
          unitPrice: amount,
          total: amount,
        },
      ],
      subtotal: amount,
      taxRate,
      taxAmount,
      total,
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
    };

    console.log('[Voice API] Invoice created:', invoice.number);

    // Clean up temp file
    await fs.promises.unlink(audioFile.filepath).catch(() => {});

    res.status(200).json({
      success: true,
      transcription,
      confidence: 0.9, // Gemini audio transcription confidence estimate
      invoice,
    });
  } catch (error) {
    console.error('[Voice API] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Voice processing failed';

    // Don't expose internal errors in production
    const sanitizedMessage =
      process.env.NODE_ENV === 'production'
        ? 'Voice processing temporarily unavailable'
        : errorMessage;

    res.status(500).json({ success: false, error: sanitizedMessage });
  }
}
