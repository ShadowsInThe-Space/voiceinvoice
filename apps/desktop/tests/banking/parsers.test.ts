import { describe, it, expect } from 'vitest';
import { CsvParser } from '../../src/lib/banking/parsers/CsvParser';
import { Mt940Parser } from '../../src/lib/banking/parsers/Mt940Parser';

describe('CsvParser', () => {
  it('should parse a standard german csv', async () => {
    const csv = `Datum;Betrag;Währung;Verwendungszweck;Begünstigter/Zahlungspflichtiger;IBAN
01.01.2023;-10,50;EUR;Test Buchung;Musterladen;DE123456789`;

    const parser = new CsvParser();
    const result = await parser.parse(csv);

    expect(result).toHaveLength(1);
    expect(result[0].date).toEqual(new Date(Date.UTC(2023, 0, 1)));
    expect(result[0].amount).toBe(-10.50);
    expect(result[0].description).toBe('Test Buchung');
    expect(result[0].senderName).toBe('Musterladen');
    expect(result[0].senderIban).toBe('DE123456789');
  });

  it('should handle variations in headers', async () => {
      const csv = `Buchungstag,Umsatz,Waehrung,Buchungstext,Name,Konto
2023-02-15,1000.00,EUR,Gehalt,Arbeitgeber,DE987654321`;

      const parser = new CsvParser();
      const result = await parser.parse(csv);

      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(1000);
      expect(result[0].senderName).toBe('Arbeitgeber');
  });
});

describe('Mt940Parser', () => {
    it('should parse a simple MT940 message', async () => {
        const mt940 = `:20:REF123
:25:DE1234567890
:28C:1/1
:60F:C230101EUR0,00
:61:2301020102D123,45NMSCNONREF
:86:Payment Description
:62F:C230131EUR123,45`;

        const parser = new Mt940Parser();
        const result = await parser.parse(mt940);

        expect(result).toHaveLength(1);
        expect(result[0].amount).toBe(-123.45);
        expect(result[0].date).toEqual(new Date(Date.UTC(2023, 0, 2)));
        expect(result[0].description).toBe('Payment Description');
        expect(result[0].accountIban).toBe('DE1234567890');
    });

    it('should handle multiline description', async () => {
        const mt940 = `:25:DE99
:61:230101C50,00N
:86:Line 1
Line 2
:61:230102D20,00N
:86:Next Trans`;

        const parser = new Mt940Parser();
        const result = await parser.parse(mt940);

        expect(result).toHaveLength(2);
        expect(result[0].description).toBe('Line 1 Line 2');
        expect(result[1].description).toBe('Next Trans');
    });
});
