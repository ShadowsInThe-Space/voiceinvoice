/**
 * Google AI client for VoiceInvoice.
 *
 * Provides voice transcription (Chirp 3) and invoice parsing (Gemini 2.5 Flash).
 *
 * @module lib/ai/gemini-client
 */

/**
 * Configuration for GeminiClient.
 */
export interface GeminiClientConfig {
  apiKey: string;
  projectId?: string;
  location?: string;
  recognizer?: string;
  locale?: 'de' | 'en';
  maxRetries?: number;
}

/**
 * Result of transcription using Chirp 3.
 */
export interface TranscriptionResult {
  success: boolean;
  text?: string;
  error?: string;
  duration?: number;
  confidence?: number;
}

/**
 * Invoice item extracted from text.
 */
export interface ParsedInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  category?: string;
}

/**
 * Invoice data extracted from text.
 */
export interface ParsedInvoice {
  customerName: string;
  customerEmail?: string;
  customerAddress?: string;
  items: ParsedInvoiceItem[];
  notes?: string;
  dueDate?: string;
  paymentTerms?: string;
}

/**
 * Result of invoice parsing.
 */
export interface InvoiceParseResult {
  success: boolean;
  invoice?: ParsedInvoice;
  confidence: number;
  error?: string;
}

/**
 * Result of invoice completion suggestions.
 */
export interface InvoiceCompletionResult {
  success: boolean;
  suggestions?: Record<string, unknown>;
  reason?: string;
  error?: string;
}

/**
 * Usage statistics.
 */
export interface UsageStats {
  requestCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

/**
 * Gemini API response content.
 */
interface GeminiContent {
  parts: Array<{
    text?: string;
    functionCall?: {
      name: string;
      args: Record<string, unknown>;
    };
  }>;
}

/**
 * Gemini API response.
 */
interface GeminiResponse {
  candidates?: Array<{
    content: GeminiContent;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
  };
}

/**
 * Prompt templates for different locales.
 */
const PROMPTS = {
  de: {
    parseInvoice: `Du bist ein Assistent für Rechnungsdaten-Extraktion.
Analysiere den folgenden Text und extrahiere alle Rechnungsdaten.
Antworte ausschließlich mit einem JSON-Objekt im folgenden Format:
{
  "customerName": "Name des Kunden",
  "customerEmail": "email@example.com",
  "customerAddress": "Adresse",
  "items": [
    { "description": "Beschreibung", "quantity": 1, "unitPrice": 100.00 }
  ],
  "notes": "Anmerkungen",
  "paymentTerms": "Zahlungsbedingungen"
}

Text: {text}`,
    completeInvoice: `Du bist ein Assistent für Rechnungsvervollständigung.
Analysiere die vorhandene Rechnung und schlage sinnvolle Ergänzungen vor.
Antworte mit einem JSON-Objekt:
{
  "suggestions": { "feldname": "vorgeschlagener Wert" },
  "reason": "Begründung"
}

Vorhandene Daten: {invoice}`,
  },
  en: {
    parseInvoice: `You are an invoice data extraction assistant.
Analyze the following text and extract all invoice data.
Respond only with a JSON object in this format:
{
  "customerName": "Customer Name",
  "customerEmail": "email@example.com",
  "customerAddress": "Address",
  "items": [
    { "description": "Description", "quantity": 1, "unitPrice": 100.00 }
  ],
  "notes": "Notes",
  "paymentTerms": "Payment terms"
}

Text: {text}`,
    completeInvoice: `You are an invoice completion assistant.
Analyze the existing invoice and suggest meaningful additions.
Respond with a JSON object:
{
  "suggestions": { "fieldName": "suggested value" },
  "reason": "Reason"
}

Existing data: {invoice}`,
  },
};

/**
 * Google AI client for voice transcription (Chirp 3) and invoice parsing (Gemini 2.5 Flash).
 */
export class GeminiClient {
  private apiKey: string;
  private projectId?: string;
  private location?: string;
  private recognizer?: string;
  private locale: 'de' | 'en';
  private maxRetries: number;

  private readonly GEMINI_MODEL = 'gemini-2.5-flash-preview-05-20';
  private readonly GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
  private readonly CHIRP_BASE_URL = 'https://speech.googleapis.com/v1';

  private stats: UsageStats = {
    requestCount: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
  };

  /**
   *
   * @param config
   */
  constructor(config: GeminiClientConfig) {
    this.apiKey = config.apiKey;
    this.projectId = config.projectId;
    this.location = config.location;
    this.recognizer = config.recognizer;
    this.locale = config.locale ?? 'de';
    this.maxRetries = config.maxRetries ?? 3;
  }

  /**
   * Transcribes audio to text using Chirp 3.
   * @param audioBase64
   * @param mimeType
   * @param options
   * @param options.language
   */
  async transcribe(
    audioBase64: string,
    mimeType: string,
    options?: { language?: string }
  ): Promise<TranscriptionResult> {
    const language = options?.language ?? 'de-DE';
    const languageCode = language === 'de' ? 'de-DE' : language;

    // Map MIME type to encoding
    const encoding = this.getEncodingFromMimeType(mimeType);

    // Build request body with custom recognizer if available
    const requestBody: Record<string, unknown> = {
      config: {
        encoding,
        sampleRateHertz: 48000,
        languageCode,
        enableAutomaticPunctuation: true,
        useEnhanced: true,
      },
      audio: {
        content: audioBase64,
      },
    };

    // Add custom recognizer if configured (Chirp 3)
    if (this.recognizer && this.projectId && this.location) {
      // Use custom recognizer format: projects/{project}/locations/{location}/recognizers/{recognizer}
      const recognizerPath = `projects/${this.projectId}/locations/${this.location}/recognizers/${this.recognizer}`;
      (requestBody.config as Record<string, unknown>).model = recognizerPath;
    } else {
      // Fallback to chirp_2
      (requestBody.config as Record<string, unknown>).model = 'chirp_2';
    }

    const response = await this.makeChirpRequest(requestBody);

    if (!response.success) {
      return { success: false, error: response.error ?? 'Unknown error during transcription' };
    }

    const results = response.data?.results ?? [];
    const transcripts = results
      .map((r: unknown) => {
        const item = r as { alternatives?: Array<{ transcript?: string; confidence?: number }> };
        return item.alternatives?.[0]?.transcript ?? '';
      })
      .join(' ');

    const firstResult = results[0] as
      | { alternatives?: Array<{ transcript?: string; confidence?: number }> }
      | undefined;
    const confidence = firstResult?.alternatives?.[0]?.confidence ?? 0;

    return {
      success: true,
      text: transcripts,
      confidence,
    };
  }

  /**
   * Parses text to extract invoice data using Gemini 2.5 Flash.
   * @param text
   */
  async parseInvoice(text: string): Promise<InvoiceParseResult> {
    const prompt = PROMPTS[this.locale].parseInvoice.replace('{text}', text);

    const response = await this.makeGeminiRequest(prompt);

    if (!response.success) {
      return {
        success: false,
        confidence: 0,
        error: response.error ?? 'Unknown error during invoice parsing',
      };
    }

    const responseText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { success: false, confidence: 0 };
      }

      const invoice = JSON.parse(jsonMatch[0]) as ParsedInvoice;
      const confidence = this.calculateConfidence(invoice);

      return {
        success: true,
        invoice,
        confidence,
      };
    } catch {
      return { success: false, confidence: 0 };
    }
  }

  /**
   * Suggests completions for a partial invoice.
   * @param partialInvoice
   */
  async completeInvoice(partialInvoice: Partial<ParsedInvoice>): Promise<InvoiceCompletionResult> {
    const prompt = PROMPTS[this.locale].completeInvoice.replace(
      '{invoice}',
      JSON.stringify(partialInvoice, null, 2)
    );

    const response = await this.makeGeminiRequest(prompt);

    if (!response.success) {
      return { success: false, error: response.error ?? 'Unknown error during invoice completion' };
    }

    const responseText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { success: false };
      }

      const result = JSON.parse(jsonMatch[0]) as {
        suggestions?: Record<string, unknown>;
        reason?: string;
      };

      const output: InvoiceCompletionResult = {
        success: true,
      };
      if (result.suggestions) output.suggestions = result.suggestions;
      if (result.reason) output.reason = result.reason;

      return output;
    } catch {
      return { success: false };
    }
  }

  /**
   * Gets usage statistics.
   */
  getUsageStats(): UsageStats {
    return { ...this.stats };
  }

  /**
   * Makes a request to Gemini API.
   * @param prompt
   */
  private async makeGeminiRequest(
    prompt: string
  ): Promise<{ success: boolean; data?: GeminiResponse; error?: string }> {
    let lastError = '';
    let retryCount = 0;

    while (retryCount < this.maxRetries) {
      try {
        const url = `${this.GEMINI_BASE_URL}/models/${this.GEMINI_MODEL}:generateContent?key=${this.apiKey}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 4096,
            },
          }),
        });

        this.stats.requestCount++;

        if (!response.ok) {
          const status = response.status;

          if (status === 429 || status >= 500) {
            retryCount++;
            await this.sleep(1000 * retryCount);
            continue;
          }

          return {
            success: false,
            error: `API error: ${status} ${response.statusText}`,
          };
        }

        const data = (await response.json()) as GeminiResponse;

        if (data.usageMetadata) {
          this.stats.totalInputTokens += data.usageMetadata.promptTokenCount;
          this.stats.totalOutputTokens += data.usageMetadata.candidatesTokenCount;
        }

        return { success: true, data };
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Unknown error occurred';
        retryCount++;

        if (retryCount < this.maxRetries) {
          await this.sleep(1000 * retryCount);
        }
      }
    }

    return { success: false, error: `Network error: ${lastError}` };
  }

  /**
   * Makes a request to Google Speech-to-Text (Chirp) API.
   * @param body
   */
  private async makeChirpRequest(
    body: Record<string, unknown>
  ): Promise<{ success: boolean; data?: { results?: unknown[] }; error?: string }> {
    let lastError = '';
    let retryCount = 0;

    while (retryCount < this.maxRetries) {
      try {
        const url = `${this.CHIRP_BASE_URL}/speech:recognize?key=${this.apiKey}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        this.stats.requestCount++;

        if (!response.ok) {
          const status = response.status;

          if (status === 429 || status >= 500) {
            retryCount++;
            await this.sleep(1000 * retryCount);
            continue;
          }

          return {
            success: false,
            error: `API error: ${status} ${response.statusText}`,
          };
        }

        const data = await response.json();
        return { success: true, data };
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Unknown error occurred';
        retryCount++;

        if (retryCount < this.maxRetries) {
          await this.sleep(1000 * retryCount);
        }
      }
    }

    return { success: false, error: `Network error: ${lastError}` };
  }

  /**
   * Maps MIME type to Google Speech encoding.
   * @param mimeType
   */
  private getEncodingFromMimeType(mimeType: string): string {
    if (mimeType.includes('webm')) {
      return 'WEBM_OPUS';
    }
    if (mimeType.includes('ogg')) {
      return 'OGG_OPUS';
    }
    if (mimeType.includes('flac')) {
      return 'FLAC';
    }
    if (mimeType.includes('wav')) {
      return 'LINEAR16';
    }
    return 'WEBM_OPUS';
  }

  /**
   * Calculates confidence score for parsed invoice.
   * @param invoice
   */
  private calculateConfidence(invoice: ParsedInvoice): number {
    let score = 0;
    let maxScore = 0;

    maxScore += 2;
    if (invoice.customerName && invoice.customerName.length > 0) {
      score += 2;
    }

    maxScore += 1;
    if (invoice.customerEmail) {
      score += 1;
    }

    maxScore += 3;
    if (invoice.items && invoice.items.length > 0) {
      score += 2;
      const completeItems = invoice.items.filter(
        (item) => item.description && item.quantity > 0 && item.unitPrice > 0
      );
      if (completeItems.length === invoice.items.length) {
        score += 1;
      }
    }

    maxScore += 1;
    if (invoice.notes) {
      score += 1;
    }

    return score / maxScore;
  }

  /**
   * Sleeps for the specified duration.
   * @param ms
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
