/**
 * Entity Extraction Tests for VoiceInvoice Enterprise.
 *
 * Tests for extracting structured invoice data from transcribed text
 * using pattern matching and rule-based extraction.
 */

import { describe, it, expect } from 'vitest';
import {
  extractEntities,
  parseGermanAmount,
  parseGermanDate,
  parsePercentage,
  extractInvoiceItems,
} from '../src/entity-extraction';

describe('Entity Extraction', () => {
  describe('extractEntities', () => {
    describe('customer name extraction', () => {
      it('should extract customer name after "für"', async () => {
        const result = await extractEntities('Rechnung für Müller GmbH');
        expect(result.entity.customerName).toBe('Müller GmbH');
      });

      it('should extract customer name after "an"', async () => {
        const result = await extractEntities('Rechnung an Schmidt AG');
        expect(result.entity.customerName).toBe('Schmidt AG');
      });

      it('should extract customer name with common suffixes', async () => {
        const result = await extractEntities('Rechnung für Acme Corporation GmbH & Co. KG');
        expect(result.entity.customerName).toBe('Acme Corporation GmbH & Co. KG');
      });

      it('should extract customer name before "über"', async () => {
        const result = await extractEntities('Rechnung für Weber Industries über 5000 Euro');
        expect(result.entity.customerName).toBe('Weber Industries');
      });

      it('should handle customer names with umlauts', async () => {
        const result = await extractEntities('Rechnung an Größer & Söhne KG');
        expect(result.entity.customerName).toBe('Größer & Söhne KG');
      });
    });

    describe('amount extraction', () => {
      it('should extract amount with Euro symbol', async () => {
        const result = await extractEntities('Rechnung über 1500€');
        expect(result.entity.amount).toBe(1500);
        expect(result.entity.currency).toBe('EUR');
      });

      it('should extract amount with EUR text', async () => {
        const result = await extractEntities('Rechnung über 2500 EUR');
        expect(result.entity.amount).toBe(2500);
        expect(result.entity.currency).toBe('EUR');
      });

      it('should extract amount with "Euro" word', async () => {
        const result = await extractEntities('Rechnung über 3000 Euro');
        expect(result.entity.amount).toBe(3000);
        expect(result.entity.currency).toBe('EUR');
      });

      it('should handle German decimal format (comma)', async () => {
        const result = await extractEntities('Betrag: 1234,56 Euro');
        expect(result.entity.amount).toBe(1234.56);
      });

      it('should handle German thousand separator (dot)', async () => {
        const result = await extractEntities('Rechnungsbetrag 1.234,56€');
        expect(result.entity.amount).toBe(1234.56);
      });

      it('should handle large amounts with multiple thousand separators', async () => {
        const result = await extractEntities('Gesamtbetrag: 1.234.567,89 EUR');
        expect(result.entity.amount).toBe(1234567.89);
      });

      it('should extract written number "tausend"', async () => {
        const result = await extractEntities('Rechnung über tausend Euro');
        expect(result.entity.amount).toBe(1000);
      });

      it('should extract "fünftausend"', async () => {
        const result = await extractEntities('Rechnung über fünftausend Euro');
        expect(result.entity.amount).toBe(5000);
      });

      it('should extract combined written numbers', async () => {
        const result = await extractEntities('zweitausendfünfhundert Euro');
        expect(result.entity.amount).toBe(2500);
      });
    });

    describe('date extraction', () => {
      it('should extract date in DD.MM.YYYY format', async () => {
        const result = await extractEntities('Fällig am 15.03.2024');
        expect(result.entity.dueDate).toEqual(new Date(2024, 2, 15));
      });

      it('should extract date in DD.MM.YY format', async () => {
        const result = await extractEntities('Fälligkeit: 20.06.24');
        expect(result.entity.dueDate).toEqual(new Date(2024, 5, 20));
      });

      it('should extract date after "bis"', async () => {
        const result = await extractEntities('Zahlbar bis 31.12.2024');
        expect(result.entity.dueDate).toEqual(new Date(2024, 11, 31));
      });

      it('should extract date after "fällig"', async () => {
        const result = await extractEntities('Fällig 01.01.2025');
        expect(result.entity.dueDate).toEqual(new Date(2025, 0, 1));
      });

      it('should handle date with written month', async () => {
        const result = await extractEntities('Fällig am 15. März 2024');
        expect(result.entity.dueDate).toEqual(new Date(2024, 2, 15));
      });

      it('should handle date with abbreviated month', async () => {
        const result = await extractEntities('Fällig am 10. Dez. 2024');
        expect(result.entity.dueDate).toEqual(new Date(2024, 11, 10));
      });
    });

    describe('tax rate extraction', () => {
      it('should extract standard 19% VAT', async () => {
        const result = await extractEntities('Rechnung plus 19% MwSt');
        expect(result.entity.taxRate).toBe(19);
      });

      it('should extract reduced 7% VAT', async () => {
        const result = await extractEntities('inklusive 7% Mehrwertsteuer');
        expect(result.entity.taxRate).toBe(7);
      });

      it('should extract percentage after "Steuer"', async () => {
        const result = await extractEntities('Steuer: 19 Prozent');
        expect(result.entity.taxRate).toBe(19);
      });

      it('should default to 19% when MwSt mentioned without percentage', async () => {
        const result = await extractEntities('Betrag plus MwSt');
        expect(result.entity.taxRate).toBe(19);
      });

      it('should handle 0% tax rate (tax exempt)', async () => {
        const result = await extractEntities('Steuerfrei 0% MwSt');
        expect(result.entity.taxRate).toBe(0);
      });
    });

    describe('payment terms extraction', () => {
      it('should extract "sofort fällig"', async () => {
        const result = await extractEntities('Rechnung sofort fällig');
        expect(result.entity.paymentTerms).toBe('sofort fällig');
      });

      it('should extract "zahlbar innerhalb" terms', async () => {
        const result = await extractEntities('Zahlbar innerhalb 14 Tagen');
        expect(result.entity.paymentTerms).toBe('Zahlbar innerhalb 14 Tagen');
      });

      it('should extract "Netto" payment terms', async () => {
        const result = await extractEntities('Zahlungsziel Netto 30 Tage');
        expect(result.entity.paymentTerms).toBe('Netto 30 Tage');
      });

      it('should extract "bei Erhalt" terms', async () => {
        const result = await extractEntities('Fällig bei Erhalt');
        expect(result.entity.paymentTerms).toBe('bei Erhalt');
      });

      it('should extract skonto terms', async () => {
        const result = await extractEntities('2% Skonto bei Zahlung innerhalb 7 Tagen');
        expect(result.entity.paymentTerms).toContain('Skonto');
      });
    });

    describe('invoice items extraction', () => {
      it('should extract single item with quantity and price', async () => {
        const result = await extractEntities('5 Stück Widgets zu je 100 Euro');
        expect(result.entity.items).toHaveLength(1);
        expect(result.entity.items![0]).toEqual({
          description: 'Widgets',
          quantity: 5,
          unitPrice: 100,
          total: 500,
        });
      });

      it('should extract item with "mal" quantity', async () => {
        const result = await extractEntities('3 mal Beratungsstunde à 150€');
        expect(result.entity.items).toHaveLength(1);
        expect(result.entity.items![0].quantity).toBe(3);
        expect(result.entity.items![0].unitPrice).toBe(150);
      });

      it('should extract multiple items', async () => {
        const result = await extractEntities(
          '2 Stück Produkt A zu 50 Euro und 3 Stück Produkt B zu 30 Euro'
        );
        expect(result.entity.items).toHaveLength(2);
        expect(result.entity.items![0].total).toBe(100);
        expect(result.entity.items![1].total).toBe(90);
      });

      it('should extract items with "Stunden" unit', async () => {
        const result = await extractEntities('8 Stunden Entwicklung à 120 Euro');
        expect(result.entity.items).toHaveLength(1);
        expect(result.entity.items![0].description).toContain('Entwicklung');
        expect(result.entity.items![0].quantity).toBe(8);
      });

      it('should calculate total from quantity and unit price', async () => {
        const result = await extractEntities('10 Einheiten Service zu 25,50 Euro');
        expect(result.entity.items![0].total).toBeCloseTo(255, 2);
      });
    });

    describe('confidence scoring', () => {
      it('should have high confidence for complete invoice data', async () => {
        const result = await extractEntities(
          'Rechnung für Müller GmbH über 1500 Euro plus 19% MwSt fällig am 15.03.2024'
        );
        expect(result.entity.confidence).toBeGreaterThanOrEqual(0.8);
      });

      it('should have medium confidence for partial data', async () => {
        const result = await extractEntities('Rechnung über 500 Euro');
        expect(result.entity.confidence).toBeGreaterThanOrEqual(0.4);
        expect(result.entity.confidence).toBeLessThan(0.8);
      });

      it('should have low confidence for minimal data', async () => {
        const result = await extractEntities('Rechnung erstellen');
        expect(result.entity.confidence).toBeLessThan(0.4);
      });
    });

    describe('extraction result metadata', () => {
      it('should include extraction method', async () => {
        const result = await extractEntities('Test');
        expect(result.method).toBe('RULES');
      });

      it('should include latency measurement', async () => {
        const result = await extractEntities('Rechnung für Test GmbH');
        expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      });

      it('should include field-level confidence', async () => {
        const result = await extractEntities('Rechnung für Test GmbH über 1000 Euro');
        expect(result.fieldConfidences).toBeDefined();
        expect(result.fieldConfidences.customerName).toBeGreaterThan(0);
        expect(result.fieldConfidences.amount).toBeGreaterThan(0);
      });
    });

    describe('complex real-world examples', () => {
      it('should handle full German invoice dictation', async () => {
        const result = await extractEntities(
          'Erstelle eine Rechnung für die Firma Meyer & Partner GmbH über 2.500 Euro ' +
            'plus 19 Prozent Mehrwertsteuer zahlbar innerhalb von 30 Tagen'
        );
        expect(result.entity.customerName).toBe('Meyer & Partner GmbH');
        expect(result.entity.amount).toBe(2500);
        expect(result.entity.taxRate).toBe(19);
        expect(result.entity.paymentTerms).toContain('30');
      });

      it('should handle spoken numbers and amounts', async () => {
        const result = await extractEntities(
          'Rechnung an Schmidt Consulting fünftausend Euro netto'
        );
        expect(result.entity.customerName).toBe('Schmidt Consulting');
        expect(result.entity.amount).toBe(5000);
      });

      it('should handle itemized invoice dictation', async () => {
        const result = await extractEntities(
          'Rechnung für Acme Corp: 5 Stück Software-Lizenzen zu je 200 Euro ' +
            'und 10 Stunden Support zu 80 Euro pro Stunde'
        );
        expect(result.entity.customerName).toBe('Acme Corp');
        expect(result.entity.items).toHaveLength(2);
      });
    });
  });

  describe('parseGermanAmount', () => {
    it('should parse simple integer', () => {
      expect(parseGermanAmount('1500')).toBe(1500);
    });

    it('should parse German decimal format', () => {
      expect(parseGermanAmount('1234,56')).toBe(1234.56);
    });

    it('should parse German format with thousand separator', () => {
      expect(parseGermanAmount('1.234,56')).toBe(1234.56);
    });

    it('should parse large numbers', () => {
      expect(parseGermanAmount('1.234.567,89')).toBe(1234567.89);
    });

    it('should return null for invalid input', () => {
      expect(parseGermanAmount('abc')).toBeNull();
    });

    it('should handle amount with trailing whitespace', () => {
      expect(parseGermanAmount('1500 ')).toBe(1500);
    });
  });

  describe('parseGermanDate', () => {
    it('should parse DD.MM.YYYY format', () => {
      expect(parseGermanDate('15.03.2024')).toEqual(new Date(2024, 2, 15));
    });

    it('should parse DD.MM.YY format', () => {
      expect(parseGermanDate('20.06.24')).toEqual(new Date(2024, 5, 20));
    });

    it('should return null for invalid date', () => {
      expect(parseGermanDate('invalid')).toBeNull();
    });

    it('should handle single digit day and month', () => {
      expect(parseGermanDate('5.3.2024')).toEqual(new Date(2024, 2, 5));
    });

    it('should parse date with written German month', () => {
      expect(parseGermanDate('15. Januar 2024')).toEqual(new Date(2024, 0, 15));
    });

    it('should parse date with abbreviated German month', () => {
      expect(parseGermanDate('15. Jan. 2024')).toEqual(new Date(2024, 0, 15));
    });
  });

  describe('parsePercentage', () => {
    it('should parse percentage with % symbol', () => {
      expect(parsePercentage('19%')).toBe(19);
    });

    it('should parse percentage with "Prozent"', () => {
      expect(parsePercentage('19 Prozent')).toBe(19);
    });

    it('should parse decimal percentage', () => {
      expect(parsePercentage('7,5%')).toBe(7.5);
    });

    it('should return null for invalid input', () => {
      expect(parsePercentage('abc')).toBeNull();
    });
  });

  describe('extractInvoiceItems', () => {
    it('should extract item with Stück pattern', () => {
      const items = extractInvoiceItems('5 Stück Widgets zu 100 Euro');
      expect(items).toHaveLength(1);
      expect(items[0].quantity).toBe(5);
      expect(items[0].description).toBe('Widgets');
      expect(items[0].unitPrice).toBe(100);
    });

    it('should extract item with Stunden pattern', () => {
      const items = extractInvoiceItems('8 Stunden Beratung à 150€');
      expect(items).toHaveLength(1);
      expect(items[0].quantity).toBe(8);
      expect(items[0].unitPrice).toBe(150);
    });

    it('should handle empty text', () => {
      const items = extractInvoiceItems('');
      expect(items).toHaveLength(0);
    });

    it('should extract multiple items with "und"', () => {
      const items = extractInvoiceItems('3 Stück A zu 10€ und 2 Stück B zu 20€');
      expect(items).toHaveLength(2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty input', async () => {
      const result = await extractEntities('');
      expect(result.entity.confidence).toBe(0);
    });

    it('should handle text with no extractable entities', async () => {
      const result = await extractEntities('Guten Morgen');
      expect(result.entity.customerName).toBeUndefined();
      expect(result.entity.amount).toBeUndefined();
    });

    it('should handle very long input', async () => {
      const longText = 'Rechnung für Test GmbH über 1000 Euro ' + 'mit vielen Details '.repeat(100);
      const result = await extractEntities(longText);
      expect(result.entity.customerName).toBe('Test GmbH');
      expect(result.entity.amount).toBe(1000);
    });

    it('should handle special characters in customer name', async () => {
      const result = await extractEntities('Rechnung für ABC & DEF GmbH');
      expect(result.entity.customerName).toBe('ABC & DEF GmbH');
    });

    it('should handle mixed case input', async () => {
      const result = await extractEntities('RECHNUNG FÜR MÜLLER GMBH ÜBER 1000 EURO');
      expect(result.entity.amount).toBe(1000);
    });
  });
});
