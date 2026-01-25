/**
 * Transcript Cleaner for VoiceInvoice Enterprise.
 *
 * Removes filler words, repetitions, and noise markers from raw transcripts
 * to improve downstream classification accuracy.
 *
 * Uses Gemini to intelligently clean transcripts while preserving
 * critical invoice information (amounts, dates, names).
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Input for the transcript cleaner.
 */
export interface CleanerInput {
  /** Raw transcript from speech-to-text */
  rawTranscript: string;
}

/**
 * Output from the transcript cleaner.
 */
export interface CleanerOutput {
  /** Cleaned transcript with filler words removed */
  cleanedTranscript: string;

  /** List of removed elements for transparency */
  removedElements: string[];

  /** Processing time in milliseconds */
  latencyMs: number;
}

/**
 * German filler words commonly found in dictated speech.
 */
const GERMAN_FILLER_WORDS = [
  'äh',
  'ähm',
  'uhm',
  'hmm',
  'also',
  'quasi',
  'sozusagen',
  'irgendwie',
  'gewissermaßen',
  'praktisch',
  'eigentlich',
];

/**
 * Cleans a raw transcript by removing filler words and noise.
 *
 * Uses Gemini to intelligently remove:
 * - Filler words (äh, ähm, also, etc.)
 * - Repetitions (duplicate words)
 * - Noise markers ([unverständlich], [Husten], etc.)
 * - Sentence restarts and corrections
 *
 * Preserves:
 * - All content-relevant information
 * - Numbers and amounts
 * - Names and descriptions
 * - Dates
 *
 * @param input - Raw transcript to clean
 * @returns Cleaned transcript with removed elements list
 *
 * @example
 * const result = await cleanTranscript({
 *   rawTranscript: 'Äh, Rechnung für, ähm, Müller GmbH über 1000 Euro'
 * });
 * // result.cleanedTranscript: 'Rechnung für Müller GmbH über 1000 Euro'
 * // result.removedElements: ['äh (1x)', 'ähm (1x)']
 */
export async function cleanTranscript(input: CleanerInput): Promise<CleanerOutput> {
  const startTime = Date.now();

  // Skip cleaning for very short transcripts
  if (!input.rawTranscript || input.rawTranscript.trim().length < 10) {
    return {
      cleanedTranscript: input.rawTranscript.trim(),
      removedElements: [],
      latencyMs: Date.now() - startTime,
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable not set');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  const prompt = `Du bist ein Transkript-Bereiniger für Rechnungsdiktate. Deine Aufgabe ist es, das folgende Diktat zu säubern.

ENTFERNE:
- Füllwörter: äh, ähm, uhm, hmm, also, quasi, sozusagen, irgendwie
- Wiederholungen: wenn Wörter doppelt gesagt werden
- Störgeräusche: [unverständlich], [Husten], [Räuspern]
- Satzabbrüche: unvollständige Sätze die neu begonnen werden

BEHALTE UNBEDINGT:
- Alle inhaltlich relevanten Informationen
- Zahlen und Beträge (z.B. "1500 Euro", "19%")
- Namen und Beschreibungen (z.B. "Müller GmbH", "Webdesign")
- Datumsangaben (z.B. "15. März", "nächste Woche")
- Zeitangaben (z.B. "10 Stunden", "2 Tage")

ORIGINAL TRANSKRIPT:
"${input.rawTranscript}"

Antworte NUR mit dem bereinigten Text, ohne Erklärungen oder zusätzliche Formatierung.`;

  try {
    console.log('[Cleaner] Starting transcript cleaning...');
    const result = await model.generateContent(prompt);
    const cleanedTranscript = result.response.text().trim();

    // Identify what was removed for transparency
    const removedElements = identifyRemovedElements(input.rawTranscript, cleanedTranscript);

    const latencyMs = Date.now() - startTime;
    console.log('[Cleaner] Cleaning complete:', {
      originalLength: input.rawTranscript.length,
      cleanedLength: cleanedTranscript.length,
      removedCount: removedElements.length,
      latencyMs,
    });

    return {
      cleanedTranscript,
      removedElements,
      latencyMs,
    };
  } catch (error) {
    console.error('[Cleaner] Cleaning failed:', error);
    throw new Error(
      `Transcript cleaning failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Identifies which filler words were removed by comparing original and cleaned text.
 *
 * @param original - Original transcript
 * @param cleaned - Cleaned transcript
 * @returns List of removed elements with counts (e.g., ["äh (2x)", "ähm (1x)"])
 */
function identifyRemovedElements(original: string, cleaned: string): string[] {
  const removed: string[] = [];

  for (const word of GERMAN_FILLER_WORDS) {
    const originalCount = countOccurrences(original.toLowerCase(), word);
    const cleanedCount = countOccurrences(cleaned.toLowerCase(), word);

    if (originalCount > cleanedCount) {
      const removedCount = originalCount - cleanedCount;
      removed.push(`${word} (${removedCount}x)`);
    }
  }

  return removed;
}

/**
 * Counts occurrences of a word in text (case-insensitive, word boundaries).
 *
 * @param text - Text to search in
 * @param word - Word to count
 * @returns Number of occurrences
 */
function countOccurrences(text: string, word: string): number {
  const regex = new RegExp(`\\b${word}\\b`, 'gi');
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}
