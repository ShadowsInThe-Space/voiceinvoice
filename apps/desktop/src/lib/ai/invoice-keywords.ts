/**
 * Invoice Extraction Keywords & Patterns
 *
 * Comprehensive keyword dictionary for German voice-to-invoice extraction.
 * Used by Gemini AI to understand voice commands and extract structured data.
 *
 * @module lib/ai/invoice-keywords
 */

/**
 * Field category with keywords and examples
 */
export interface KeywordCategory {
  field: string;
  keywords: string[];
  examples: string[];
  notes?: string;
}

/**
 * Complete keyword database for invoice extraction
 */
export interface InvoiceKeywords {
  customer: KeywordCategory[];
  invoice: KeywordCategory[];
  items: KeywordCategory[];
  special: {
    numbers: string[];
    currencies: string[];
    units: string[];
    dates: string[];
    taxRates: number[];
  };
}

/**
 * German invoice extraction keywords
 */
export const INVOICE_KEYWORDS: InvoiceKeywords = {
  customer: [
    {
      field: 'name',
      keywords: ['Rechnung an', 'Kunde', 'Firma', 'für', 'Auftraggeber', 'Name'],
      examples: ['Rechnung an Müller GmbH', 'Kunde Max Mustermann', 'für die Sparkasse Frankfurt'],
    },
    {
      field: 'email',
      keywords: ['E-Mail', 'Email', 'Mailadresse', 'per E-Mail an'],
      examples: ['E-Mail max@mustermann.de', 'per E-Mail an info@firma.com'],
      notes: 'Phonetik: "at" → "@", "punkt" → ".", "minus" → "-"',
    },
    {
      field: 'phone',
      keywords: ['Telefon', 'Telefonnummer', 'Tel', 'Mobil', 'Handy'],
      examples: ['Telefon 069 123456', 'Mobil 0171 987654'],
    },
    {
      field: 'address',
      keywords: ['Adresse', 'Straße', 'wohnhaft in', 'Hausnummer'],
      examples: ['Adresse Bahnhofstraße 12', 'wohnhaft in Musterweg 5'],
    },
    {
      field: 'city',
      keywords: ['in', 'Stadt', 'aus'],
      examples: ['60313 Frankfurt', 'Stadt München', 'aus Berlin'],
    },
    {
      field: 'zipCode',
      keywords: ['PLZ', 'Postleitzahl'],
      examples: ['PLZ 60313', '12345 Musterhausen'],
    },
    {
      field: 'taxId',
      keywords: ['USt-IdNr', 'Umsatzsteuer-ID', 'Steuernummer', 'Tax ID'],
      examples: ['USt-IdNr DE123456789', 'Steuernummer 12/345/67890'],
    },
  ],

  invoice: [
    {
      field: 'number',
      keywords: ['Rechnungsnummer', 'Rechnung Nummer', 'RE', 'Invoice'],
      examples: ['Rechnungsnummer 2024-001', 'RE 001'],
      notes: 'Auto-generiert falls nicht angegeben: RE-YYYY-XXXX',
    },
    {
      field: 'taxRate',
      keywords: [
        'mit',
        'Prozent Mehrwertsteuer',
        'Prozent MwSt',
        'Umsatzsteuer',
        'inklusive',
        'plus',
      ],
      examples: ['mit 7 Prozent Mehrwertsteuer', '19 Prozent MwSt', 'plus 7 Prozent'],
      notes: 'Standard: 19% (Deutschland)',
    },
    {
      field: 'status',
      keywords: ['Status', 'als', 'markieren', 'Rechnung ist'],
      examples: ['Status Entwurf', 'als bezahlt markieren', 'Rechnung ist versendet'],
      notes: 'Werte: DRAFT, SENT, PAID, OVERDUE, CANCELLED',
    },
    {
      field: 'issuedAt',
      keywords: ['Rechnungsdatum', 'ausgestellt am', 'vom', 'Datum'],
      examples: [
        'Rechnungsdatum 25. Januar 2026',
        'vom 15.01.2026',
        'ausgestellt am ersten Februar',
      ],
      notes: 'Default: aktuelles Datum',
    },
    {
      field: 'dueAt',
      keywords: ['fällig am', 'Zahlungsziel', 'zahlbar bis', 'Fälligkeit', 'in', 'Tagen fällig'],
      examples: ['fällig am 15. Februar 2026', 'Zahlungsziel 14 Tage', 'in 30 Tagen fällig'],
      notes: 'Default: issuedAt + 14 Tage',
    },
    {
      field: 'paymentTerms',
      keywords: ['Zahlungsbedingungen', 'Zahlbar', 'Zahlungsziel', 'Skonto'],
      examples: [
        'Zahlungsbedingungen 14 Tage netto',
        'Zahlbar innerhalb 30 Tagen',
        '2 Prozent Skonto bei Zahlung innerhalb 10 Tagen',
      ],
    },
    {
      field: 'notes',
      keywords: ['Notiz', 'Bemerkung', 'Hinweis', 'Anmerkung'],
      examples: [
        'Notiz: Rechnung wurde per E-Mail versendet',
        'Hinweis: Nachlass von 10 Prozent bereits abgezogen',
      ],
    },
  ],

  items: [
    {
      field: 'description',
      keywords: ['Position', 'Stunden', 'Stück', 'für'],
      examples: [
        '2 Stunden Webentwicklung',
        'Position Beratungsleistung',
        'Webhosting für 50 Euro',
        '10 Pizzen',
      ],
    },
    {
      field: 'quantity',
      keywords: ['Stück', 'Stunden', 'Tage', 'mal'],
      examples: ['3 Stück', '2,5 Stunden', '10 Kilometer'],
      notes: 'Einheiten: Stk, Std/h, Tage, Wochen, Monate, km, qm, kg, l',
    },
    {
      field: 'unitPrice',
      keywords: ['zu', 'à', 'je', 'pro', 'Stückpreis'],
      examples: ['zu 50 Euro', 'à 80 Euro pro Stunde', 'je 15 Euro'],
    },
    {
      field: 'total',
      keywords: ['macht', 'ergibt', 'gesamt', 'insgesamt'],
      examples: ['macht 100 Euro', 'ergibt 450 Euro'],
      notes: 'Wird automatisch berechnet: quantity × unitPrice',
    },
    {
      field: 'category',
      keywords: ['Kategorie', 'unter', 'als'],
      examples: ['Kategorie Beratung', 'unter Entwicklung'],
      notes:
        'Kategorien: Beratung, Entwicklung, Design, Support, Hosting, Lizenz, Hardware, Software, Material, Reisekosten, Sonstiges',
    },
  ],

  special: {
    numbers: [
      'null',
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
      'dreizehn',
      'vierzehn',
      'fünfzehn',
      'zwanzig',
      'dreißig',
      'vierzig',
      'fünfzig',
      'sechzig',
      'siebzig',
      'achtzig',
      'neunzig',
      'hundert',
      'tausend',
      'million',
    ],
    currencies: [
      'Euro',
      'EUR',
      '€',
      'Dollar',
      'USD',
      '$',
      'Schweizer Franken',
      'CHF',
      'Pfund',
      'GBP',
      '£',
    ],
    units: [
      'Stück',
      'Stk',
      'Stunden',
      'Std',
      'h',
      'Tage',
      'Wochen',
      'Monate',
      'Kilometer',
      'km',
      'Quadratmeter',
      'qm',
      'm²',
      'Kilogramm',
      'kg',
      'Liter',
      'l',
      'Paket',
      'Packung',
    ],
    dates: [
      'heute',
      'morgen',
      'übermorgen',
      'nächste Woche',
      'nächsten Monat',
      'Januar',
      'Februar',
      'März',
      'April',
      'Mai',
      'Juni',
      'Juli',
      'August',
      'September',
      'Oktober',
      'November',
      'Dezember',
    ],
    taxRates: [19, 7, 0, 20, 8.1], // DE 19%/7%, AT 20%, CH 8.1%
  },
};

/**
 * Generate enhanced extraction prompt with keyword guidance
 * @param transcription
 */
export function generateExtractionPrompt(transcription: string): string {
  return `Du bist ein Experte für deutsche Rechnungsextraktion aus gesprochenem Text.

AUFGABE:
Extrahiere alle Rechnungsinformationen aus dem Transkript und gib sie als strukturiertes JSON zurück.

SCHEMA:
{
  "customerName": string (REQUIRED),
  "customerEmail": string | null,
  "customerPhone": string | null,
  "customerAddress": string | null,
  "customerCity": string | null,
  "customerZipCode": string | null,
  "customerCountry": string (default: "DE"),
  "customerTaxId": string | null,
  "invoiceNumber": string | null,
  "currency": string (default: "EUR"),
  "taxRate": number (default: 19.0),
  "status": string (default: "DRAFT"),
  "issuedAt": ISO8601 | null,
  "dueAt": ISO8601 | null,
  "paymentTerms": string | null,
  "notes": string | null,
  "items": [
    {
      "description": string (REQUIRED),
      "quantity": number (default: 1),
      "unitPrice": number (REQUIRED),
      "category": string | null
    }
  ],
  "confidence": number (0.0 - 1.0)
}

KEYWORD-ERKENNUNG:

Kunde:
- Name: "Rechnung an [Name]", "Kunde [Name]", "Firma [Name]"
- E-Mail: "E-Mail [email]", "per E-Mail an [email]" (at → @, punkt → .)
- Telefon: "Telefon [nummer]", "Mobil [nummer]"
- Adresse: "Adresse [straße]", "[straße] Hausnummer [nummer]"
- Stadt: "in [stadt]", "[PLZ] [stadt]"
- USt-IdNr: "USt-IdNr [nummer]", "Steuernummer [nummer]"

Rechnung:
- Nummer: "Rechnungsnummer [nummer]", "RE [nummer]"
- MwSt: "[zahl] Prozent MwSt", "plus [zahl] Prozent" (Standard: 19)
- Fälligkeit: "fällig am [datum]", "in [tage] Tagen fällig"
- Zahlungsbedingungen: "[tage] Tage netto", "Skonto [prozent] Prozent"

Positionen:
- "[anzahl] [einheit] [beschreibung]"
- "zu [betrag]", "à [betrag]", "je [betrag]"
- "macht [betrag]", "ergibt [betrag]"

Einheiten: Stück, Stunden/Std/h, Tage, Wochen, Monate, km, qm, kg, l

REGELN:
1. customerName ist PFLICHT - ohne Namen Confidence < 0.85
2. Mindestens 1 Item mit description + unitPrice
3. Berechne totals automatisch: quantity × unitPrice
4. Deutsche Zahlen konvertieren: "zweihundert" → 200
5. Relative Daten auflösen: "in 14 Tagen" → ISO8601
6. E-Mail Phonetik: "at" → "@", "punkt" → "."
7. Mehrere Positionen durch "Position 1", "Position 2" oder Aufzählungen erkennbar
8. Bei fehlenden Daten: null verwenden (außer defaults)
9. Confidence = 1.0 nur wenn alle REQUIRED Felder korrekt

BEISPIEL-EXTRAKTION:

Input: "Rechnung an Max Mustermann, Frankfurt. 2 Stunden Webentwicklung zu 80 Euro macht 160 Euro."

Output:
{
  "customerName": "Max Mustermann",
  "customerCity": "Frankfurt",
  "customerEmail": null,
  "customerPhone": null,
  "customerAddress": null,
  "customerZipCode": null,
  "customerCountry": "DE",
  "customerTaxId": null,
  "invoiceNumber": null,
  "currency": "EUR",
  "taxRate": 19.0,
  "status": "DRAFT",
  "issuedAt": null,
  "dueAt": null,
  "paymentTerms": null,
  "notes": null,
  "items": [
    {
      "description": "Webentwicklung",
      "quantity": 2,
      "unitPrice": 80,
      "category": null
    }
  ],
  "confidence": 0.9
}

TRANSKRIPT:
${transcription}

Antworte NUR mit dem JSON-Objekt, ohne zusätzlichen Text.`;
}

/**
 * Get formatted keyword help text for UI display
 */
export function getKeywordHelpText(): string {
  let help = '# Voice-Diktat Hilfe\n\n';

  help += '## Kunde\n';
  INVOICE_KEYWORDS.customer.forEach((cat) => {
    help += `### ${cat.field}\n`;
    help += `Keywords: ${cat.keywords.join(', ')}\n`;
    help += `Beispiele:\n`;
    cat.examples.forEach((ex) => (help += `- ${ex}\n`));
    if (cat.notes) help += `> ${cat.notes}\n`;
    help += '\n';
  });

  help += '## Rechnung\n';
  INVOICE_KEYWORDS.invoice.forEach((cat) => {
    help += `### ${cat.field}\n`;
    help += `Keywords: ${cat.keywords.join(', ')}\n`;
    help += `Beispiele:\n`;
    cat.examples.forEach((ex) => (help += `- ${ex}\n`));
    if (cat.notes) help += `> ${cat.notes}\n`;
    help += '\n';
  });

  help += '## Positionen\n';
  INVOICE_KEYWORDS.items.forEach((cat) => {
    help += `### ${cat.field}\n`;
    help += `Keywords: ${cat.keywords.join(', ')}\n`;
    help += `Beispiele:\n`;
    cat.examples.forEach((ex) => (help += `- ${ex}\n`));
    if (cat.notes) help += `> ${cat.notes}\n`;
    help += '\n';
  });

  return help;
}

/**
 * Get keyword categories for structured UI display
 */
export function getKeywordCategories(): {
  customer: KeywordCategory[];
  invoice: KeywordCategory[];
  items: KeywordCategory[];
} {
  return {
    customer: INVOICE_KEYWORDS.customer,
    invoice: INVOICE_KEYWORDS.invoice,
    items: INVOICE_KEYWORDS.items,
  };
}
