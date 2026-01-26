/**
 * Voice Processing API Route
 *
 * Handles voice-to-invoice processing:
 * 1. Receives audio blob
 * 2. Transcribes with Google Cloud Speech-to-Text Chirp 3
 * 3. Extracts entities with Gemini 2.5 Flash
 * 4. Returns invoice data
 *
 * @module api/voice/process
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleChirpClient } from '@voiceinvoice/privacy-engine';
import { generateExtractionPrompt } from '../../../lib/ai/invoice-keywords';
import { PrismaClient } from '@/generated/prisma';
import formidable from 'formidable';
import fs from 'fs';

const prisma = new PrismaClient();

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
    isExistingCustomer?: boolean;
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

    // Read audio file as Buffer
    const audioBuffer = await fs.promises.readFile(audioFile.filepath);

    // Step 1: Transcribe with Chirp 3
    console.log('[Voice API] Starting Chirp 3 transcription...');
    let transcription = '';

    try {
      const projectId = process.env.GOOGLE_CLOUD_PROJECT;
      if (!projectId) {
        throw new Error('Missing GOOGLE_CLOUD_PROJECT environment variable');
      }

      const chirpClient = new GoogleChirpClient({
        projectId,
        location: process.env.GOOGLE_CLOUD_LOCATION || 'eu',
        recognizerId: process.env.CHIRP3_RECOGNIZER || 'invoice-chirp3-de',
      });

      const transcriptionResult = await chirpClient.transcribeWithRedaction(audioBuffer, 'de-DE', {
        redactEmails: true,
        redactPhoneNumbers: true,
      });

      transcription = transcriptionResult.text;
      console.log('[Voice API] Chirp 3 transcription:', transcription);
    } catch (err: any) {
      console.error('[Voice API] Transcription failed:', err);
      // Fail gracefully or throw?
      // If transcription fails, we can't extract.
      throw new Error(`Transcription service failed: ${err.message || err}`);
    }

    if (!transcription || transcription.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: 'Keine Sprache im Audio erkannt',
      });
      return;
    }

    // Step 2: Extract invoice data with Gemini
    console.log('[Voice API] Extracting invoice data with Gemini...');
    let extractedData: any;

    try {
      const geminiApiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
      if (!geminiApiKey) {
        throw new Error('Missing Gemini API key');
      }

      const genAI = new GoogleGenerativeAI(geminiApiKey);
      // User requested gemini-3-pro-preview
      let model = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' });

      // Use enhanced extraction prompt with keyword guidance
      const extractionPrompt = generateExtractionPrompt(transcription);

      try {
        const extractionResult = await model.generateContent(extractionPrompt);
        const jsonText = extractionResult.response.text().trim();
        const cleanJson = jsonText
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        extractedData = JSON.parse(cleanJson);
      } catch (geminiError: any) {
        console.warn('[Voice API] Gemini 3 Pro failed, trying 2.5-flash fallback:', geminiError);
        // Fallback to 2.5 if 3 Pro fails
        model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const extractionResultFallback = await model.generateContent(extractionPrompt);
        const jsonTextFallback = extractionResultFallback.response.text().trim();
        const cleanJsonFallback = jsonTextFallback
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        extractedData = JSON.parse(cleanJsonFallback);
      }

      console.log('[Voice API] Extracted data:', extractedData);
    } catch (err: any) {
      console.error('[Voice API] Extraction failed:', err);
      // Fallback to manual entry with just transcription
      extractedData = {
        customerName: 'Unbekannt',
        items: [{ description: transcription, quantity: 1, unitPrice: 0 }],
        taxRate: 19,
      };
    }

    // Step 3: Find matching customer in database
    const extractedCustomerName = extractedData.customerName?.trim() || 'Unbekannter Kunde';
    let matchedCustomer: { id: string; name: string } | null = null;

    try {
      // Get all customers for fuzzy matching
      const allCustomers = await prisma.customer.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
      });

      // Normalize extracted name
      const normalizedSearch = extractedCustomerName
        .toLowerCase()
        .replace(/\s*(gmbh|ag|ohg|kg|e\.k\.|ug|gbr|inc\.|ltd\.?|co\.?)\s*/gi, '')
        .trim();

      // Find best matching customer
      let bestMatch: { id: string; name: string; score: number } | null = null;

      for (const c of allCustomers) {
        const normalizedName = c.name
          .toLowerCase()
          .replace(/\s*(gmbh|ag|ohg|kg|e\.k\.|ug|gbr|inc\.|ltd\.?|co\.?)\s*/gi, '')
          .trim();

        // Check if one contains the other
        if (
          normalizedName.includes(normalizedSearch) ||
          normalizedSearch.includes(normalizedName)
        ) {
          const score =
            Math.min(normalizedName.length, normalizedSearch.length) /
            Math.max(normalizedName.length, normalizedSearch.length);

          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { id: c.id, name: c.name, score };
          }
        }
      }

      // Use match if score is good enough (> 50%)
      if (bestMatch && bestMatch.score > 0.5) {
        matchedCustomer = { id: bestMatch.id, name: bestMatch.name };
        console.log(
          '[Voice API] Matched customer:',
          matchedCustomer.name,
          '(score:',
          bestMatch.score.toFixed(2),
          ')'
        );
      }
    } catch (dbError) {
      console.warn('[Voice API] Customer lookup failed:', dbError);
    }

    // Step 4: Build invoice object from extracted data
    const items = (extractedData.items || []).map((item: any, index: number) => {
      const quantity = item.quantity || 1;
      const unitPrice = item.unitPrice || 0;
      return {
        id: `item-${index + 1}`,
        description: item.description || 'Leistung',
        quantity,
        unitPrice,
        total: quantity * unitPrice,
        category: item.category || null,
      };
    });

    const subtotal = items.reduce((sum: number, item: any) => sum + item.total, 0);
    const taxRate = extractedData.taxRate || 19;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    const invoice = {
      id: 'inv-' + Date.now(),
      number:
        extractedData.invoiceNumber ||
        'RE-2025-' + String(Math.floor(Math.random() * 1000)).padStart(3, '0'),
      customerId: matchedCustomer?.id || 'c-new',
      customer: matchedCustomer || {
        id: 'c-new',
        name: extractedCustomerName,
      },
      items,
      subtotal,
      taxRate,
      taxAmount,
      total,
      status: extractedData.status || 'DRAFT',
      createdAt: new Date().toISOString(),
      isExistingCustomer: !!matchedCustomer,
    };

    console.log('[Voice API] Invoice created:', invoice.number);

    // Clean up temp file
    await fs.promises.unlink(audioFile.filepath).catch(() => {});

    res.status(200).json({
      success: true,
      transcription,
      confidence: extractedData.confidence || 0.95,
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
