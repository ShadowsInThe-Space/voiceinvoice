/**
 * Tests for Bank CSV Parser.
 *
 * Tests parsing of CSV files from various German bank formats:
 * - Sparkasse
 * - Deutsche Bank
 * - Volksbank
 *
 * @module tests/bank/csv-parser
 */

import { describe, it, expect } from 'vitest';
import {
  parseCSV,
  detectBankFormat,
  parseGermanDate,
  parseGermanAmount,
} from '../../src/lib/bank/csv-parser';

describe('CSV Parser', () => {
  describe('parseGermanDate', () => {
    it('should parse date in DD.MM.YYYY format', () => {
      const result = parseGermanDate('15.03.2024');
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(2); // March is 2 (0-indexed)
      expect(result.getDate()).toBe(15);
    });

    it('should parse date in DD.MM.YY format', () => {
      const result = parseGermanDate('15.03.24');
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(2);
      expect(result.getDate()).toBe(15);
    });

    it('should throw error for invalid date format', () => {
      expect(() => parseGermanDate('invalid')).toThrow();
      expect(() => parseGermanDate('2024-03-15')).toThrow();
    });
  });

  describe('parseGermanAmount', () => {
    it('should parse positive amount with comma decimal', () => {
      expect(parseGermanAmount('1.234,56')).toBe(1234.56);
    });

    it('should parse negative amount with minus sign', () => {
      expect(parseGermanAmount('-1.234,56')).toBe(-1234.56);
    });

    it('should parse amount without thousands separator', () => {
      expect(parseGermanAmount('234,56')).toBe(234.56);
    });

    it('should parse amount with S suffix (Soll/debit)', () => {
      expect(parseGermanAmount('234,56 S')).toBe(-234.56);
    });

    it('should parse amount with H suffix (Haben/credit)', () => {
      expect(parseGermanAmount('234,56 H')).toBe(234.56);
    });

    it('should handle whitespace', () => {
      expect(parseGermanAmount('  1.234,56  ')).toBe(1234.56);
    });
  });

  describe('detectBankFormat', () => {
    it('should detect Sparkasse format by header', () => {
      const csv = `Auftragskonto;Buchungstag;Valutadatum;Buchungstext;Verwendungszweck;Beguenstigter/Zahlungspflichtiger;Kontonummer;BLZ;Betrag;Waehrung;Info
DE12345678901234567890;15.03.2024;15.03.2024;GUTSCHR;Test;Max Mustermann;1234567890;12345678;100,00;EUR;`;
      expect(detectBankFormat(csv)).toBe('sparkasse');
    });

    it('should detect Deutsche Bank format by header', () => {
      const csv = `Buchungstag;Wert;Umsatzart;Begünstigter / Auftraggeber;Verwendungszweck;IBAN;BIC;Betrag (EUR);
15.03.2024;15.03.2024;Gutschrift;Max Mustermann;Test;;123,45;`;
      expect(detectBankFormat(csv)).toBe('deutschebank');
    });

    it('should detect Volksbank format by header', () => {
      const csv = `Bezeichnung Auftragskonto;IBAN Auftragskonto;BIC Auftragskonto;Bankname Auftragskonto;Buchungstag;Valutadatum;Name Zahlungsbeteiligter;IBAN Zahlungsbeteiligter;BIC (SWIFT-Code) Zahlungsbeteiligter;Buchungstext;Verwendungszweck;Betrag;Waehrung;Saldo nach Buchung;Bemerkung;Kategorie;Steuerrelevant;Glaeubiger ID;Mandatsreferenz
Mein Konto;DE12345678901234567890;GENODED1234;Volksbank;15.03.2024;15.03.2024;Max Mustermann;;GUTSCHR;Test;100,00;EUR;1000,00;;;;`;
      expect(detectBankFormat(csv)).toBe('volksbank');
    });

    it('should return null for unknown format', () => {
      const csv = `Unknown;Header;Format
data1;data2;data3`;
      expect(detectBankFormat(csv)).toBeNull();
    });
  });

  describe('parseCSV - Sparkasse format', () => {
    const sparkasseCSV = `Auftragskonto;Buchungstag;Valutadatum;Buchungstext;Verwendungszweck;Beguenstigter/Zahlungspflichtiger;Kontonummer;BLZ;Betrag;Waehrung;Info
DE12345678901234567890;15.03.2024;15.03.2024;GUTSCHR;RE-2024-001 Zahlung fuer Beratung;Max Mustermann GmbH;1234567890;12345678;1.234,56;EUR;Umsatz gebucht
DE12345678901234567890;16.03.2024;16.03.2024;LASTSCHRIFT;Miete Maerz;Vermieter AG;0987654321;87654321;-800,00;EUR;Umsatz gebucht`;

    it('should parse Sparkasse CSV with multiple transactions', () => {
      const result = parseCSV(sparkasseCSV, 'sparkasse');

      expect(result).toHaveLength(2);
    });

    it('should parse positive transaction (income) correctly', () => {
      const result = parseCSV(sparkasseCSV, 'sparkasse');
      const income = result[0];

      expect(income.date).toBeInstanceOf(Date);
      expect(income.date.getDate()).toBe(15);
      expect(income.date.getMonth()).toBe(2);
      expect(income.date.getFullYear()).toBe(2024);
      expect(income.amount).toBe(1234.56);
      expect(income.counterparty).toBe('Max Mustermann GmbH');
      expect(income.reference).toBe('RE-2024-001 Zahlung fuer Beratung');
      expect(income.description).toBe('GUTSCHR');
    });

    it('should parse negative transaction (expense) correctly', () => {
      const result = parseCSV(sparkasseCSV, 'sparkasse');
      const expense = result[1];

      expect(expense.amount).toBe(-800.0);
      expect(expense.counterparty).toBe('Vermieter AG');
      expect(expense.reference).toBe('Miete Maerz');
    });

    it('should handle empty CSV', () => {
      const emptyCSV = `Auftragskonto;Buchungstag;Valutadatum;Buchungstext;Verwendungszweck;Beguenstigter/Zahlungspflichtiger;Kontonummer;BLZ;Betrag;Waehrung;Info`;
      const result = parseCSV(emptyCSV, 'sparkasse');
      expect(result).toHaveLength(0);
    });

    it('should skip invalid rows', () => {
      const csvWithInvalid = `Auftragskonto;Buchungstag;Valutadatum;Buchungstext;Verwendungszweck;Beguenstigter/Zahlungspflichtiger;Kontonummer;BLZ;Betrag;Waehrung;Info
DE12345678901234567890;15.03.2024;15.03.2024;GUTSCHR;Test;Max Mustermann;1234567890;12345678;100,00;EUR;Umsatz gebucht
invalid;row;with;missing;fields
DE12345678901234567890;16.03.2024;16.03.2024;GUTSCHR;Test2;Maria Mueller;1234567890;12345678;200,00;EUR;Umsatz gebucht`;
      const result = parseCSV(csvWithInvalid, 'sparkasse');
      expect(result).toHaveLength(2);
    });
  });

  describe('parseCSV - Deutsche Bank format', () => {
    const deutscheBankCSV = `Buchungstag;Wert;Umsatzart;Beguenstigter / Auftraggeber;Verwendungszweck;IBAN;BIC;Kundenreferenz;Mandatsreferenz;Glaeubigerkennung;Fremde Gebuehren;Betrag;Abweichender Empfaenger;Anzahl der Auftraege;Anzahl der Schecks
15.03.2024;15.03.2024;Gutschrift;Kunde ABC;INV-2024-0042 Projektarbeit;DE98765432109876543210;DEUTDEDB;;;;;;;2.500,00;;;
16.03.2024;16.03.2024;Lastschrift;Telekom;Rechnung Februar;DE11111111111111111111;COBADEFF;;;;;;;-49,99;;;`;

    it('should parse Deutsche Bank CSV correctly', () => {
      const result = parseCSV(deutscheBankCSV, 'deutschebank');

      expect(result).toHaveLength(2);

      const income = result[0];
      expect(income.amount).toBe(2500.0);
      expect(income.counterparty).toBe('Kunde ABC');
      expect(income.reference).toBe('INV-2024-0042 Projektarbeit');
      expect(income.iban).toBe('DE98765432109876543210');

      const expense = result[1];
      expect(expense.amount).toBe(-49.99);
      expect(expense.counterparty).toBe('Telekom');
    });
  });

  describe('parseCSV - Volksbank format', () => {
    const volksbankCSV = `Bezeichnung Auftragskonto;IBAN Auftragskonto;BIC Auftragskonto;Bankname Auftragskonto;Buchungstag;Valutadatum;Name Zahlungsbeteiligter;IBAN Zahlungsbeteiligter;BIC (SWIFT-Code) Zahlungsbeteiligter;Buchungstext;Verwendungszweck;Betrag;Waehrung;Saldo nach Buchung;Bemerkung;Kategorie;Steuerrelevant;Glaeubiger ID;Mandatsreferenz
Geschaeftskonto;DE12345678901234567890;GENODED1234;Volksbank Musterstadt;20.03.2024;20.03.2024;Schmidt und Partner;DE55555555555555555555;GENODED5555;Ueberweisung;RE-2024-0099 Honorar Q1;3.750,00;EUR;15.000,00;;;;;
Geschaeftskonto;DE12345678901234567890;GENODED1234;Volksbank Musterstadt;21.03.2024;21.03.2024;Stromversorger AG;;COBADEFF;Lastschrift;Abschlag Maerz;-125,50;EUR;14.874,50;;;;;`;

    it('should parse Volksbank CSV correctly', () => {
      const result = parseCSV(volksbankCSV, 'volksbank');

      expect(result).toHaveLength(2);

      const income = result[0];
      expect(income.date.getDate()).toBe(20);
      expect(income.amount).toBe(3750.0);
      expect(income.counterparty).toBe('Schmidt und Partner');
      expect(income.reference).toBe('RE-2024-0099 Honorar Q1');
      expect(income.iban).toBe('DE55555555555555555555');

      const expense = result[1];
      expect(expense.amount).toBe(-125.5);
    });
  });

  describe('Edge cases', () => {
    it('should handle CRLF line endings', () => {
      const csvWithCRLF = `Auftragskonto;Buchungstag;Valutadatum;Buchungstext;Verwendungszweck;Beguenstigter/Zahlungspflichtiger;Kontonummer;BLZ;Betrag;Waehrung;Info\r\nDE12345678901234567890;15.03.2024;15.03.2024;GUTSCHR;Test;Max Mustermann;1234567890;12345678;100,00;EUR;Umsatz gebucht\r\n`;
      const result = parseCSV(csvWithCRLF, 'sparkasse');
      expect(result).toHaveLength(1);
    });

    it('should handle quoted fields with semicolons', () => {
      const csvWithQuotes = `Auftragskonto;Buchungstag;Valutadatum;Buchungstext;Verwendungszweck;Beguenstigter/Zahlungspflichtiger;Kontonummer;BLZ;Betrag;Waehrung;Info
DE12345678901234567890;15.03.2024;15.03.2024;GUTSCHR;"Zahlung; Ref: 12345";Max Mustermann;1234567890;12345678;100,00;EUR;Umsatz gebucht`;
      const result = parseCSV(csvWithQuotes, 'sparkasse');
      expect(result).toHaveLength(1);
      expect(result[0].reference).toBe('Zahlung; Ref: 12345');
    });

    it('should handle special German characters', () => {
      const csvWithUmlauts = `Auftragskonto;Buchungstag;Valutadatum;Buchungstext;Verwendungszweck;Beguenstigter/Zahlungspflichtiger;Kontonummer;BLZ;Betrag;Waehrung;Info
DE12345678901234567890;15.03.2024;15.03.2024;GUTSCHR;Buerobedarf fuer Maerz;Mueller und Soehne GmbH;1234567890;12345678;100,00;EUR;Umsatz gebucht`;
      const result = parseCSV(csvWithUmlauts, 'sparkasse');
      expect(result[0].counterparty).toBe('Mueller und Soehne GmbH');
      expect(result[0].reference).toBe('Buerobedarf fuer Maerz');
    });

    it('should throw error for invalid format', () => {
      expect(() => parseCSV('test', 'invalid' as BankFormat)).toThrow('Unsupported bank format');
    });
  });
});
