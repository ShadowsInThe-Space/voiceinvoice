/**
 * AI module exports.
 *
 * Provides Google AI integration (Gemini 2.5 Flash + Chirp 3).
 *
 * @module lib/ai
 */

export {
  GeminiClient,
  type GeminiClientConfig,
  type TranscriptionResult,
  type ParsedInvoice,
  type ParsedInvoiceItem,
  type InvoiceParseResult,
  type InvoiceCompletionResult,
  type UsageStats,
} from './gemini-client';
