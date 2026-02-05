/**
 * Entity Extraction Module for VoiceInvoice Enterprise.
 *
 * Extracts structured invoice data from transcribed German text
 * using pattern matching and rule-based extraction.
 *
 * Designed for Gemini Function Calling integration (mock for now).
 *
 * @file Rule-based entity extraction for German invoice dictation.
 * @module @voiceinvoice/ai-orchestrator/entity-extraction
 */

/**
 * Represents a single invoice line item.
 */
export interface InvoiceItem {
  /** Description of the item or service */
  description: string;

  /** Quantity of items */
  quantity: number;

  /** Price per unit */
  unitPrice: number;

  /** Total for this line item (quantity * unitPrice) */
  total: number;
}

/**
 * Extracted invoice entity data.
 */
export interface InvoiceEntity {
  /** Customer/company name */
  customerName?: string;

  /** Invoice amount */
  amount?: number;

  /** Currency code (default: EUR) */
  currency?: string;

  /** Due date for payment */
  dueDate?: Date;

  /** List of invoice items/positions */
  items?: InvoiceItem[];

  /** Tax/VAT rate as percentage */
  taxRate?: number;

  /** Payment terms description */
  paymentTerms?: string;

  /** Overall extraction confidence (0.0 to 1.0) */
  confidence: number;
}

/**
 * Result from entity extraction.
 */
export interface ExtractionResult {
  /** Extracted entity data */
  entity: InvoiceEntity;

  /** Extraction method used */
  method: 'RULES' | 'GEMINI';

  /** Processing time in milliseconds */
  latencyMs: number;

  /** Per-field confidence scores */
  fieldConfidences: Record<string, number>;
}

/**
 * German month names for date parsing.
 */
const GERMAN_MONTHS: Record<string, number> = {
  januar: 0,
  jan: 0,
  februar: 1,
  feb: 1,
  märz: 2,
  mar: 2,
  april: 3,
  apr: 3,
  mai: 4,
  juni: 5,
  jun: 5,
  juli: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  oktober: 9,
  okt: 9,
  november: 10,
  nov: 10,
  dezember: 11,
  dez: 11,
};

/**
 * German written numbers mapping.
 */
const GERMAN_NUMBERS: Record<string, number> = {
  null: 0,
  eins: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
  elf: 11,
  zwölf: 12,
  dreizehn: 13,
  vierzehn: 14,
  fünfzehn: 15,
  sechzehn: 16,
  siebzehn: 17,
  achtzehn: 18,
  neunzehn: 19,
  zwanzig: 20,
  dreißig: 30,
  vierzig: 40,
  fünfzig: 50,
  sechzig: 60,
  siebzig: 70,
  achtzig: 80,
  neunzig: 90,
  hundert: 100,
  tausend: 1000,
  eintausend: 1000,
  zweitausend: 2000,
  dreitausend: 3000,
  viertausend: 4000,
  fünftausend: 5000,
  sechstausend: 6000,
  siebentausend: 7000,
  achttausend: 8000,
  neuntausend: 9000,
  zehntausend: 10000,
};

/**
 * Company suffixes for customer name extraction.
 */
const COMPANY_SUFFIXES = [
  'GmbH & Co. KG',
  'GmbH & Co. KGaA',
  'GmbH & Co.',
  'GmbH',
  'AG',
  'KG',
  'OHG',
  'SE',
  'e.V.',
  'eG',
  'KGaA',
  'Ltd.',
  'Ltd',
  'Inc.',
  'Inc',
  'Corporation',
  'Corp.',
  'Corp',
  'UG',
];

/**
 * Parses a German-formatted amount string to a number.
 *
 * German format uses:
 * - Dot (.) as thousand separator
 * - Comma (,) as decimal separator
 *
 * @param amountStr - The amount string to parse
 * @returns The parsed number or null if invalid
 *
 * @example
 * parseGermanAmount('1.234,56') // Returns 1234.56
 * parseGermanAmount('1500') // Returns 1500
 */
export function parseGermanAmount(amountStr: string): number | null {
  if (!amountStr || typeof amountStr !== 'string') {
    return null;
  }

  // Trim whitespace
  const trimmed = amountStr.trim();

  // Check for German format with thousand separators and decimal comma
  // Pattern: optional groups of digits with dots, then optional comma with decimals
  const germanPattern = /^(\d{1,3}(?:\.\d{3})*)(?:,(\d+))?$/;
  const germanMatch = trimmed.match(germanPattern);

  if (germanMatch) {
    // Remove thousand separators (dots) and convert comma to dot
    const integerPart = germanMatch[1].replace(/\./g, '');
    const decimalPart = germanMatch[2] || '0';
    return parseFloat(`${integerPart}.${decimalPart}`);
  }

  // Try simple integer
  const integerPattern = /^(\d+)$/;
  const integerMatch = trimmed.match(integerPattern);

  if (integerMatch) {
    return parseInt(integerMatch[1], 10);
  }

  // Try simple decimal with comma
  const simpleDecimalPattern = /^(\d+),(\d+)$/;
  const simpleDecimalMatch = trimmed.match(simpleDecimalPattern);

  if (simpleDecimalMatch) {
    return parseFloat(`${simpleDecimalMatch[1]}.${simpleDecimalMatch[2]}`);
  }

  return null;
}

/**
 * Parses a German-formatted date string to a Date object.
 *
 * Supports formats:
 * - DD.MM.YYYY (e.g., 15.03.2024)
 * - DD.MM.YY (e.g., 15.03.24)
 * - DD. Month YYYY (e.g., 15. März 2024)
 * - DD. Mon. YYYY (e.g., 15. Mär. 2024)
 *
 * @param dateStr - The date string to parse
 * @returns The parsed Date or null if invalid
 *
 * @example
 * parseGermanDate('15.03.2024') // Returns Date(2024, 2, 15)
 */
export function parseGermanDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }

  const trimmed = dateStr.trim();

  // Try DD.MM.YYYY format
  const fullPattern = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
  const fullMatch = trimmed.match(fullPattern);

  if (fullMatch) {
    const day = parseInt(fullMatch[1], 10);
    const month = parseInt(fullMatch[2], 10) - 1; // JS months are 0-indexed
    const year = parseInt(fullMatch[3], 10);
    return new Date(year, month, day);
  }

  // Try DD.MM.YY format
  const shortPattern = /^(\d{1,2})\.(\d{1,2})\.(\d{2})$/;
  const shortMatch = trimmed.match(shortPattern);

  if (shortMatch) {
    const day = parseInt(shortMatch[1], 10);
    const month = parseInt(shortMatch[2], 10) - 1;
    let year = parseInt(shortMatch[3], 10);
    // Assume 20xx for years < 50, 19xx otherwise
    year = year < 50 ? 2000 + year : 1900 + year;
    return new Date(year, month, day);
  }

  // Try DD. Month YYYY format (with written month)
  const writtenMonthPattern = /^(\d{1,2})\.\s*([A-Za-zäöüÄÖÜß]+)\.?\s*(\d{4})$/i;
  const writtenMonthMatch = trimmed.match(writtenMonthPattern);

  if (writtenMonthMatch) {
    const day = parseInt(writtenMonthMatch[1], 10);
    const monthName = writtenMonthMatch[2].toLowerCase();
    const year = parseInt(writtenMonthMatch[3], 10);

    const month = GERMAN_MONTHS[monthName];
    if (month !== undefined) {
      return new Date(year, month, day);
    }
  }

  return null;
}

/**
 * Parses a percentage string to a number.
 *
 * @param percentStr - The percentage string to parse
 * @returns The parsed percentage or null if invalid
 *
 * @example
 * parsePercentage('19%') // Returns 19
 * parsePercentage('7,5 Prozent') // Returns 7.5
 */
export function parsePercentage(percentStr: string): number | null {
  if (!percentStr || typeof percentStr !== 'string') {
    return null;
  }

  const trimmed = percentStr.trim().toLowerCase();

  // Pattern: number (with optional comma decimal) followed by % or Prozent
  const pattern = /(\d+(?:,\d+)?)\s*(?:%|prozent)/i;
  const match = trimmed.match(pattern);

  if (match) {
    // Convert German decimal to standard
    const numStr = match[1].replace(',', '.');
    return parseFloat(numStr);
  }

  return null;
}

/**
 * Parses German written numbers to numeric values.
 *
 * @param text - Text containing written numbers
 * @returns The numeric value or null if not recognized
 *
 * @example
 * parseWrittenNumber('tausend') // Returns 1000
 * parseWrittenNumber('zweitausendfünfhundert') // Returns 2500
 */
function parseWrittenNumber(text: string): number | null {
  const normalized = text.toLowerCase().trim();

  // Direct lookup
  if (GERMAN_NUMBERS[normalized] !== undefined) {
    return GERMAN_NUMBERS[normalized];
  }

  // Try compound numbers (e.g., zweitausendfünfhundert)
  let total = 0;
  let remaining = normalized;

  // Check for compound thousands first (zweitausend, dreitausend, etc.)
  const compoundThousandMatch = remaining.match(
    /^(zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|ein)tausend/
  );
  if (compoundThousandMatch) {
    const prefix = compoundThousandMatch[1];
    const multiplier = GERMAN_NUMBERS[prefix] || 1;
    total += multiplier * 1000;
    remaining = remaining.slice(compoundThousandMatch[0].length);
  } else if (remaining.startsWith('tausend')) {
    total += 1000;
    remaining = remaining.slice('tausend'.length);
  }

  // Check for hundreds (fünfhundert, etc.)
  const hundertMatch = remaining.match(/^(zwei|drei|vier|fünf|sechs|sieben|acht|neun)?hundert/);
  if (hundertMatch) {
    const prefix = hundertMatch[1];
    if (prefix) {
      const multiplier = GERMAN_NUMBERS[prefix];
      if (multiplier !== undefined && multiplier < 10) {
        total += multiplier * 100;
      }
    } else {
      total += 100;
    }
    remaining = remaining.slice(hundertMatch[0].length);
  }

  // Check for tens and units
  const tensMatch = remaining.match(
    /^(zwanzig|dreißig|vierzig|fünfzig|sechzig|siebzig|achtzig|neunzig)/
  );
  if (tensMatch) {
    const tensValue = GERMAN_NUMBERS[tensMatch[1]];
    if (tensValue) {
      total += tensValue;
    }
    remaining = remaining.slice(tensMatch[0].length);
  }

  // Check for remaining smaller numbers (units, teens, etc.)
  if (remaining && GERMAN_NUMBERS[remaining] !== undefined) {
    total += GERMAN_NUMBERS[remaining];
  }

  return total > 0 ? total : null;
}

/**
 * Extracts invoice items from text.
 *
 * Recognizes patterns like:
 * - "5 Stück Widgets zu 100 Euro"
 * - "8 Stunden Beratung à 150€"
 * - "3 mal Service zu je 200 EUR"
 *
 * @param text - Text to extract items from
 * @returns Array of extracted invoice items
 */
export function extractInvoiceItems(text: string): InvoiceItem[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const items: InvoiceItem[] = [];
  const normalizedText = text.toLowerCase();

  // Pattern: quantity + unit + description + price
  // e.g., "5 Stück Widgets zu 100 Euro"
  const itemPattern =
    /(\d+)\s*(?:stück|stunden|einheiten|mal|x)\s+([a-zäöüß\-\s]+?)\s*(?:zu(?:\s+je)?|à|a)\s*(\d+(?:[.,]\d+)?)\s*(?:€|euro|eur)/gi;

  let match;
  while ((match = itemPattern.exec(text)) !== null) {
    const quantity = parseInt(match[1], 10);
    const description = match[2].trim();
    // Capitalize first letter of description
    const formattedDescription = description.charAt(0).toUpperCase() + description.slice(1);
    const priceStr = match[3].replace(',', '.');
    const unitPrice = parseFloat(priceStr);
    const total = quantity * unitPrice;

    items.push({
      description: formattedDescription,
      quantity,
      unitPrice,
      total,
    });
  }

  // Handle "und" separator for multiple items
  if (items.length === 0 && normalizedText.includes(' und ')) {
    const parts = text.split(/\s+und\s+/i);
    for (const part of parts) {
      const subItems = extractInvoiceItems(part);
      items.push(...subItems);
    }
  }

  return items;
}

/**
 * Extracts customer name from text.
 *
 * @param text - Text to extract customer from
 * @returns Extracted customer name or undefined
 */
function extractCustomerName(text: string): { name: string; confidence: number } | null {
  // Written number words that should stop customer name extraction (sorted by length for greedy matching)
  const writtenNumberWords = [
    'zweitausendfünfhundert',
    'zweitausend',
    'dreitausend',
    'viertausend',
    'fünftausend',
    'sechstausend',
    'siebentausend',
    'achttausend',
    'neuntausend',
    'zehntausend',
    'eintausend',
    'tausend',
    'hundert',
    'eins',
    'zwei',
    'drei',
    'vier',
    'fünf',
    'sechs',
    'sieben',
    'acht',
    'neun',
    'zehn',
    'elf',
    'zwölf',
  ].join('|');

  // Patterns: "für <customer>", "an <customer>"
  const patterns = [
    // Pattern with written numbers as boundary (check first for most specific match)
    new RegExp(
      `(?:rechnung\\s+)?(?:für|an)\\s+(?:die\\s+(?:firma\\s+)?)?([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\\s&\\-\\.]+?)\\s+(?:${writtenNumberWords})`,
      'i'
    ),
    // Pattern with colon separator (e.g., "Rechnung für Acme Corp: 5 Stück...")
    new RegExp(
      `(?:rechnung\\s+)?(?:für|an)\\s+(?:die\\s+(?:firma\\s+)?)?([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\\s&\\-\\.]+?)(?:\\s*:|\\s+über|\\s+\\d|,|$)`,
      'i'
    ),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let name = match[1].trim();

      // Check if name ends with company suffix - if not, look for one after
      const hasCompanySuffix = COMPANY_SUFFIXES.some((suffix) =>
        name.toLowerCase().endsWith(suffix.toLowerCase())
      );

      if (!hasCompanySuffix) {
        // Try to find a company suffix in the remaining text
        for (const suffix of COMPANY_SUFFIXES) {
          const suffixPattern = new RegExp(`${escapeRegex(name)}\\s+(${escapeRegex(suffix)})`, 'i');
          const suffixMatch = text.match(suffixPattern);
          if (suffixMatch) {
            name = `${name} ${suffixMatch[1]}`;
            break;
          }
        }
      }

      return {
        name,
        confidence: hasCompanySuffix ? 0.95 : 0.75,
      };
    }
  }

  return null;
}

/**
 * Escapes special regex characters in a string.
 *
 * @param str - String to escape
 * @returns Escaped string safe for use in regex
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extracts amount and currency from text.
 *
 * @param text - Text to extract amount from
 * @returns Extracted amount, currency, and confidence
 */
function extractAmount(text: string): {
  amount: number;
  currency: string;
  confidence: number;
} | null {
  // Pattern for numeric amounts with Euro currency
  const numericPatterns = [
    /(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)\s*(?:€|euro|eur)/gi,
    /(?:über|betrag[:\s]*|rechnungsbetrag[:\s]*|gesamtbetrag[:\s]*)(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)\s*(?:€|euro|eur)/gi,
  ];

  for (const pattern of numericPatterns) {
    const match = pattern.exec(text);
    if (match) {
      const amount = parseGermanAmount(match[1]);
      if (amount !== null) {
        return {
          amount,
          currency: 'EUR',
          confidence: 0.95,
        };
      }
    }
  }

  // Try written numbers - more comprehensive patterns
  const writtenPatterns = [
    // Compound numbers like "zweitausendfünfhundert"
    /(?:über\s+)?((?:ein|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)?tausend(?:fünfhundert|vierhundert|dreihundert|zweihundert|einhundert|hundert)?)\s+euro/i,
    // Simple written numbers
    /(?:über\s+)?(tausend|fünftausend|zweitausend|dreitausend|viertausend|sechstausend|siebentausend|achttausend|neuntausend|zehntausend)\s+euro/i,
  ];

  for (const pattern of writtenPatterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseWrittenNumber(match[1]);
      if (amount !== null) {
        return {
          amount,
          currency: 'EUR',
          confidence: 0.85,
        };
      }
    }
  }

  return null;
}

/**
 * Extracts due date from text.
 *
 * @param text - Text to extract date from
 * @returns Extracted date and confidence
 */
function extractDueDate(text: string): { date: Date; confidence: number } | null {
  // Patterns with context keywords
  const datePatterns = [
    /(?:fällig(?:keit)?(?:\s+am)?|zahlbar\s+bis|bis(?:\s+zum)?)\s*[:\s]*(\d{1,2}\.\d{1,2}\.\d{2,4})/i,
    /(?:fällig(?:keit)?(?:\s+am)?)\s*[:\s]*(\d{1,2}\.\s*[A-Za-zäöüÄÖÜß]+\.?\s*\d{4})/i,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      const date = parseGermanDate(match[1]);
      if (date) {
        return {
          date,
          confidence: 0.9,
        };
      }
    }
  }

  // Try to find any date in DD.MM.YYYY format
  const generalDatePattern = /(\d{1,2}\.\d{1,2}\.\d{2,4})/;
  const generalMatch = text.match(generalDatePattern);
  if (generalMatch) {
    const date = parseGermanDate(generalMatch[1]);
    if (date) {
      return {
        date,
        confidence: 0.6,
      };
    }
  }

  return null;
}

/**
 * Extracts tax rate from text.
 *
 * @param text - Text to extract tax rate from
 * @returns Extracted tax rate and confidence
 */
function extractTaxRate(text: string): { rate: number; confidence: number } | null {
  // Explicit percentage patterns
  const taxPatterns = [
    /(\d+(?:,\d+)?)\s*(?:%|prozent)\s*(?:mwst|mehrwertsteuer|steuer)/i,
    /(?:mwst|mehrwertsteuer|steuer)[:\s]*(\d+(?:,\d+)?)\s*(?:%|prozent)?/i,
    /(?:plus|inklusive|inkl\.?|zzgl\.?)\s*(\d+(?:,\d+)?)\s*(?:%|prozent)?\s*(?:mwst|mehrwertsteuer)?/i,
    /steuerfrei\s*(\d+)\s*%/i,
  ];

  for (const pattern of taxPatterns) {
    const match = text.match(pattern);
    if (match) {
      const rateStr = match[1].replace(',', '.');
      const rate = parseFloat(rateStr);
      return {
        rate,
        confidence: 0.95,
      };
    }
  }

  // Default 19% if MwSt mentioned without percentage
  if (/(?:mwst|mehrwertsteuer)/i.test(text)) {
    return {
      rate: 19,
      confidence: 0.7,
    };
  }

  return null;
}

/**
 * Extracts payment terms from text.
 *
 * @param text - Text to extract payment terms from
 * @returns Extracted payment terms and confidence
 */
function extractPaymentTerms(text: string): { terms: string; confidence: number } | null {
  const termPatterns = [
    { pattern: /(sofort\s+fällig)/i, confidence: 0.95 },
    { pattern: /(zahlbar\s+innerhalb\s+(?:von\s+)?\d+\s+[Tt]agen?)/i, confidence: 0.9 },
    { pattern: /([Nn]etto\s+\d+\s+[Tt]age?)/i, confidence: 0.9 },
    { pattern: /(bei\s+[Ee]rhalt)/i, confidence: 0.9 },
    { pattern: /(\d+%?\s*[Ss]konto[^.]*)/i, confidence: 0.85 },
    { pattern: /(zahlungsziel[:\s]*[^.]+)/i, confidence: 0.8 },
  ];

  for (const { pattern, confidence } of termPatterns) {
    const match = text.match(pattern);
    if (match) {
      const terms = match[1].trim();
      return {
        terms,
        confidence,
      };
    }
  }

  return null;
}

/**
 * Calculates overall confidence based on extracted fields.
 *
 * @param fieldConfidences - Map of field names to confidence scores
 * @returns Overall confidence score
 */
function calculateOverallConfidence(fieldConfidences: Record<string, number>): number {
  const fields = Object.keys(fieldConfidences);
  const fieldCount = fields.length;

  if (fieldCount === 0) {
    return 0;
  }

  // Weight important fields more heavily
  const weights: Record<string, number> = {
    customerName: 0.3,
    amount: 0.35,
    dueDate: 0.1,
    taxRate: 0.1,
    paymentTerms: 0.1,
    items: 0.05,
  };

  let weightedSum = 0;
  let actualWeight = 0;

  for (const [field, confidence] of Object.entries(fieldConfidences)) {
    const weight = weights[field] || 0.05;
    weightedSum += confidence * weight;
    actualWeight += weight;
  }

  // Normalize by actual weight to get base confidence
  const baseConfidence = actualWeight > 0 ? weightedSum / actualWeight : 0;

  // Bonus based on how many key fields we have
  // Key fields are customerName and amount
  const hasCustomer = 'customerName' in fieldConfidences;
  const hasAmount = 'amount' in fieldConfidences;
  const hasBothKey = hasCustomer && hasAmount;

  // Coverage bonus: having more fields increases confidence
  let coverageBonus = 0;
  if (fieldCount >= 4) {
    coverageBonus = 0.15;
  } else if (fieldCount >= 3) {
    coverageBonus = 0.1;
  } else if (fieldCount >= 2) {
    coverageBonus = 0.05;
  }

  // Additional bonus for having both key fields
  const keyFieldBonus = hasBothKey ? 0.1 : hasCustomer || hasAmount ? 0.05 : 0;

  // Final confidence
  const finalConfidence = baseConfidence * 0.7 + coverageBonus + keyFieldBonus;

  return Math.min(Math.max(finalConfidence, 0), 1.0);
}

/**
 * Extracts structured invoice entities from transcribed text.
 *
 * Uses rule-based pattern matching optimized for German voice input.
 * Designed to be replaced with Gemini Function Calling for production.
 *
 * @param text - Transcribed text to extract entities from
 * @returns Extraction result with entity data and metadata
 *
 * @example
 * const result = await extractEntities(
 *   'Rechnung für Müller GmbH über 1500 Euro plus 19% MwSt'
 * );
 * console.log(result.entity.customerName); // 'Müller GmbH'
 * console.log(result.entity.amount); // 1500
 */
export async function extractEntities(text: string): Promise<ExtractionResult> {
  const startTime = Date.now();

  const entity: InvoiceEntity = {
    confidence: 0,
  };

  const fieldConfidences: Record<string, number> = {};

  // Handle empty input
  if (!text || text.trim().length === 0) {
    return {
      entity,
      method: 'RULES',
      latencyMs: Date.now() - startTime,
      fieldConfidences,
    };
  }

  // Extract customer name
  const customerResult = extractCustomerName(text);
  if (customerResult) {
    entity.customerName = customerResult.name;
    fieldConfidences.customerName = customerResult.confidence;
  }

  // Extract amount
  const amountResult = extractAmount(text);
  if (amountResult) {
    entity.amount = amountResult.amount;
    entity.currency = amountResult.currency;
    fieldConfidences.amount = amountResult.confidence;
  }

  // Extract due date
  const dateResult = extractDueDate(text);
  if (dateResult) {
    entity.dueDate = dateResult.date;
    fieldConfidences.dueDate = dateResult.confidence;
  }

  // Extract tax rate
  const taxResult = extractTaxRate(text);
  if (taxResult) {
    entity.taxRate = taxResult.rate;
    fieldConfidences.taxRate = taxResult.confidence;
  }

  // Extract payment terms
  const termsResult = extractPaymentTerms(text);
  if (termsResult) {
    entity.paymentTerms = termsResult.terms;
    fieldConfidences.paymentTerms = termsResult.confidence;
  }

  // Extract invoice items
  const items = extractInvoiceItems(text);
  if (items.length > 0) {
    entity.items = items;
    fieldConfidences.items = 0.85;
  }

  // Calculate overall confidence
  entity.confidence = calculateOverallConfidence(fieldConfidences);

  return {
    entity,
    method: 'RULES',
    latencyMs: Date.now() - startTime,
    fieldConfidences,
  };
}
