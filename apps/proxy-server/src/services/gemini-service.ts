/**
 * Gemini AI Service for Invoice Data Extraction
 *
 * Uses Gemini 2.5 Flash to extract structured invoice data
 * from transcribed voice recordings.
 *
 * @module gemini-service
 */

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type { TaxRate } from '@voiceinvoice/shared-types';

/**
 * Line item in an invoice.
 */
export interface InvoiceItem {
  /** Item description */
  description: string;
  /** Quantity (default: 1) */
  quantity: number;
  /** Unit price in EUR */
  unitPrice: number;
  /** Total price (quantity * unitPrice) */
  total: number;
}

/**
 * Extracted invoice data structure.
 */
export interface ExtractedInvoice {
  /** Customer or company name */
  customerName: string;
  /** Contact person name (if mentioned) */
  contactPerson?: string;
  /** Line items */
  items: InvoiceItem[];
  /** Net amount before tax */
  netAmount: number;
  /** Tax rate (0, 7, or 19) */
  taxRate: TaxRate;
  /** Calculated tax amount */
  taxAmount: number;
  /** Gross amount including tax */
  grossAmount: number;
  /** Currency (default: EUR) */
  currency: string;
  /** Invoice description or notes */
  description?: string;
  /** Due date if mentioned */
  dueDate?: string;
  /** Invoice date if mentioned */
  invoiceDate?: string;
}

/**
 * Result of invoice extraction.
 */
export interface ExtractionResult {
  /** Extracted invoice data */
  invoice: ExtractedInvoice;
  /** Confidence score (0.0 - 1.0) */
  confidence: number;
}

/**
 * Get the Gemini API client.
 */
function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY environment variable is not set');
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * JSON schema for structured invoice output.
 */
const invoiceSchema = {
  type: SchemaType.OBJECT,
  properties: {
    customerName: {
      type: SchemaType.STRING,
      description: 'Name of the customer or company',
    },
    contactPerson: {
      type: SchemaType.STRING,
      description: 'Contact person name if mentioned',
      nullable: true,
    },
    items: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          description: { type: SchemaType.STRING },
          quantity: { type: SchemaType.NUMBER },
          unitPrice: { type: SchemaType.NUMBER },
          total: { type: SchemaType.NUMBER },
        },
        required: ['description', 'quantity', 'unitPrice', 'total'],
      },
    },
    netAmount: {
      type: SchemaType.NUMBER,
      description: 'Net amount before tax in EUR',
    },
    taxRate: {
      type: SchemaType.NUMBER,
      description: 'German tax rate: 0, 7, or 19',
    },
    taxAmount: {
      type: SchemaType.NUMBER,
      description: 'Calculated tax amount',
    },
    grossAmount: {
      type: SchemaType.NUMBER,
      description: 'Total amount including tax',
    },
    currency: {
      type: SchemaType.STRING,
      description: 'Currency code (default EUR)',
    },
    description: {
      type: SchemaType.STRING,
      description: 'Invoice description or notes',
      nullable: true,
    },
    dueDate: {
      type: SchemaType.STRING,
      description: 'Payment due date in ISO format',
      nullable: true,
    },
    invoiceDate: {
      type: SchemaType.STRING,
      description: 'Invoice date in ISO format',
      nullable: true,
    },
    confidence: {
      type: SchemaType.NUMBER,
      description: 'Extraction confidence score 0.0-1.0',
    },
  },
  required: [
    'customerName',
    'items',
    'netAmount',
    'taxRate',
    'taxAmount',
    'grossAmount',
    'currency',
    'confidence',
  ],
};

/**
 * Extract structured invoice data from a transcript.
 *
 * Uses Gemini 2.5 Flash with structured output to reliably
 * extract invoice information from German voice recordings.
 *
 * @param transcript - Transcribed text from voice recording
 * @returns Promise with extracted invoice data and confidence
 *
 * @example
 * ```typescript
 * const result = await extractInvoiceData(
 *   'Rechnung an Firma Mustermann, zweihundert Euro netto'
 * );
 * console.log(result.invoice.customerName); // "Firma Mustermann"
 * console.log(result.invoice.netAmount); // 200
 * ```
 */
export async function extractInvoiceData(transcript: string): Promise<ExtractionResult> {
  const client = getClient();

  // Use Gemini 2.5 Flash for invoice extraction
  const model = client.getGenerativeModel({
    model: 'gemini-2.5-flash-preview-05-20',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: invoiceSchema,
    },
  });

  const prompt = `You are an expert German accountant assistant. Extract invoice data from this voice transcript.

TRANSCRIPT:
"${transcript}"

RULES:
1. Extract the customer/company name accurately (e.g., "Firma Mustermann GmbH")
2. Convert German number words to digits (e.g., "zweihundert" = 200, "eintausendfünfhundert" = 1500)
3. Use the correct German tax rate:
   - 19% (standard rate) for most goods and services
   - 7% (reduced rate) for food, books, newspapers, public transport
   - 0% for exports or explicitly tax-exempt items
4. If tax rate is not specified, assume 19%
5. Calculate tax and gross amounts correctly
6. Default currency is EUR unless otherwise specified
7. Extract line items if mentioned, otherwise create a single item from the description
8. Set confidence based on how clear and complete the information is:
   - 0.9-1.0: Clear, complete information
   - 0.7-0.9: Most information clear, some assumptions made
   - 0.5-0.7: Partial information, significant assumptions
   - 0.3-0.5: Unclear, many assumptions needed
   - 0.0-0.3: Very unclear or insufficient information

If key information is missing or unclear, make reasonable assumptions but lower the confidence score accordingly.
If the transcript mentions "netto" (net), the amount is before tax.
If the transcript mentions "brutto" (gross), calculate backwards to get the net amount.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    const parsed = JSON.parse(text);

    // Ensure tax rate is valid
    const validTaxRates: TaxRate[] = [0, 7, 19];
    const taxRate = validTaxRates.includes(parsed.taxRate) ? parsed.taxRate : 19;

    // Recalculate amounts to ensure consistency
    const netAmount = Number(parsed.netAmount) || 0;
    const taxAmount = netAmount * (taxRate / 100);
    const grossAmount = netAmount + taxAmount;

    const invoice: ExtractedInvoice = {
      customerName: parsed.customerName || 'Unknown Customer',
      contactPerson: parsed.contactPerson,
      items: parsed.items || [],
      netAmount,
      taxRate: taxRate as TaxRate,
      taxAmount: Math.round(taxAmount * 100) / 100,
      grossAmount: Math.round(grossAmount * 100) / 100,
      currency: parsed.currency || 'EUR',
      description: parsed.description,
      dueDate: parsed.dueDate,
      invoiceDate: parsed.invoiceDate,
    };

    return {
      invoice,
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Invoice extraction failed: ${errorMessage}`);
  }
}

/**
 * Check if the Gemini service is available.
 * Used for health checks.
 */
export async function checkAvailability(): Promise<boolean> {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    return !!apiKey;
  } catch {
    return false;
  }
}
