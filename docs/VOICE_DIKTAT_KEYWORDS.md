# Voice-Diktat Keyword-Liste für Rechnungserstellung

**Zweck:** Definiert alle erkennbaren Felder und zugehörige Keywords für das Voice-to-Invoice System

Dokumentiert am: 2026-01-25

---

## 📊 Datenbank-Felder Übersicht

### Invoice (Rechnung)

- ✅ Kunde (Customer-Relation)
- ✅ Rechnungsnummer (number)
- ✅ Positionen (InvoiceItem[])
- ✅ Finanzdaten (subtotal, taxRate, taxAmount, total)
- ✅ Status & Termine (status, issuedAt, dueAt, paidAt)
- ✅ Zahlungsbedingungen (paymentTerms)
- ✅ Notizen (notes)
- ✅ Währung (currency)

### Customer (Kunde)

- ✅ Name
- ✅ E-Mail
- ✅ Telefon
- ✅ Adresse (address, city, zipCode, country)
- ✅ Steuernummer (taxId / USt-IdNr)
- ✅ Notizen (notes)

### InvoiceItem (Rechnungsposition)

- ✅ Beschreibung (description)
- ✅ Menge (quantity)
- ✅ Einzelpreis (unitPrice)
- ✅ Gesamt (total)
- ✅ Kategorie (category)

---

## 🎯 Keyword-Kategorien

### 1. Kundeninformationen

#### **Name** (`customer.name`)

**Keywords:**

- "Rechnung an [Name]"
- "Kunde [Name]"
- "Firma [Name]"
- "für [Name]"
- "Auftraggeber [Name]"

**Beispiele:**

- ✅ "Rechnung an Müller GmbH"
- ✅ "Kunde Max Mustermann"
- ✅ "für die Sparkasse Frankfurt"

#### **E-Mail** (`customer.email`)

**Keywords:**

- "E-Mail [email]"
- "Email [email]"
- "Mailadresse [email]"
- "per E-Mail an [email]"

**Beispiele:**

- ✅ "E-Mail max@mustermann.de"
- ✅ "per E-Mail an info@firma.com"

**Hinweis:** E-Mail-Erkennung erfordert Phonetik-Mapping:

- "at" → "@"
- "punkt" → "."
- "minus" → "-"
- "unterstrich" → "\_"

#### **Telefon** (`customer.phone`)

**Keywords:**

- "Telefon [nummer]"
- "Telefonnummer [nummer]"
- "Tel [nummer]"
- "Mobil [nummer]"
- "Handy [nummer]"

**Beispiele:**

- ✅ "Telefon 069 123456"
- ✅ "Mobil 0171 987654"

#### **Adresse** (`customer.address`)

**Keywords:**

- "Adresse [straße]"
- "Straße [straße]"
- "wohnhaft in [straße]"
- "[straße] Hausnummer [nummer]"

**Beispiele:**

- ✅ "Adresse Bahnhofstraße 12"
- ✅ "wohnhaft in Musterweg 5"

#### **Stadt** (`customer.city`)

**Keywords:**

- "in [stadt]"
- "Stadt [stadt]"
- "[PLZ] [stadt]"
- "aus [stadt]"

**Beispiele:**

- ✅ "60313 Frankfurt"
- ✅ "Stadt München"
- ✅ "aus Berlin"

#### **Postleitzahl** (`customer.zipCode`)

**Keywords:**

- "PLZ [plz]"
- "Postleitzahl [plz]"
- "[plz] [stadt]" (kombiniert)

**Beispiele:**

- ✅ "PLZ 60313"
- ✅ "12345 Musterhausen"

#### **Land** (`customer.country`)

**Keywords:**

- "Land [land]"
- "in [land]"
- "aus [land]"

**Standard:** Deutschland (DE)

**Beispiele:**

- ✅ "Land Österreich"
- ✅ "aus der Schweiz"

#### **Steuernummer** (`customer.taxId`)

**Keywords:**

- "USt-IdNr [nummer]"
- "Umsatzsteuer-ID [nummer]"
- "Steuernummer [nummer]"
- "Tax ID [nummer]"

**Beispiele:**

- ✅ "USt-IdNr DE123456789"
- ✅ "Steuernummer 12/345/67890"

---

### 2. Rechnungsinformationen

#### **Rechnungsnummer** (`invoice.number`)

**Keywords:**

- "Rechnungsnummer [nummer]"
- "Rechnung Nummer [nummer]"
- "RE [nummer]"
- "Invoice [nummer]"

**Beispiele:**

- ✅ "Rechnungsnummer 2024-001"
- ✅ "RE 001"

**Hinweis:** Falls nicht angegeben, wird automatisch generiert (RE-YYYY-XXXX)

#### **Währung** (`invoice.currency`)

**Keywords:**

- "in [währung]"
- "Betrag in [währung]"
- "[währung]"

**Standard:** EUR

**Beispiele:**

- ✅ "in Euro"
- ✅ "Betrag in CHF"
- ✅ "USD"

#### **Steuersatz** (`invoice.taxRate`)

**Keywords:**

- "mit [prozent] Prozent Mehrwertsteuer"
- "[prozent] Prozent MwSt"
- "Umsatzsteuer [prozent] Prozent"
- "inklusive [prozent] Prozent"
- "plus [prozent] Prozent"

**Standard:** 19% (deutscher Standardsteuersatz)

**Beispiele:**

- ✅ "mit 7 Prozent Mehrwertsteuer"
- ✅ "19 Prozent MwSt"
- ✅ "plus 7 Prozent"

**Varianten:**

- 19% - Standardsatz Deutschland
- 7% - Ermäßigter Satz Deutschland
- 0% - Steuerbefreit
- 20% - Österreich Standard
- 8.1% - Schweiz Standard

#### **Status** (`invoice.status`)

**Keywords:**

- "Status [status]"
- "als [status] markieren"
- "Rechnung ist [status]"

**Werte:**

- DRAFT (Entwurf) - Standard
- SENT (Versendet)
- PAID (Bezahlt)
- OVERDUE (Überfällig)
- CANCELLED (Storniert)

**Beispiele:**

- ✅ "Status Entwurf"
- ✅ "als bezahlt markieren"
- ✅ "Rechnung ist versendet"

#### **Rechnungsdatum** (`invoice.issuedAt`)

**Keywords:**

- "Rechnungsdatum [datum]"
- "ausgestellt am [datum]"
- "vom [datum]"
- "Datum [datum]"

**Beispiele:**

- ✅ "Rechnungsdatum 25. Januar 2026"
- ✅ "vom 15.01.2026"
- ✅ "ausgestellt am ersten Februar"

**Hinweis:** Falls nicht angegeben, wird aktuelles Datum verwendet

#### **Fälligkeitsdatum** (`invoice.dueAt`)

**Keywords:**

- "fällig am [datum]"
- "Zahlungsziel [datum]"
- "zahlbar bis [datum]"
- "Fälligkeit [datum]"
- "in [tage] Tagen fällig"

**Beispiele:**

- ✅ "fällig am 15. Februar 2026"
- ✅ "Zahlungsziel 14 Tage"
- ✅ "in 30 Tagen fällig"

#### **Zahlungsbedingungen** (`invoice.paymentTerms`)

**Keywords:**

- "Zahlungsbedingungen [text]"
- "Zahlbar [text]"
- "Zahlungsziel [text]"
- "Skonto [text]"

**Beispiele:**

- ✅ "Zahlungsbedingungen 14 Tage netto"
- ✅ "Zahlbar innerhalb 30 Tagen"
- ✅ "2 Prozent Skonto bei Zahlung innerhalb 10 Tagen"

**Standard-Templates:**

- "14 Tage netto"
- "30 Tage netto"
- "2% Skonto bei Zahlung innerhalb 10 Tagen, sonst 30 Tage netto"
- "Sofort fällig"

#### **Notizen** (`invoice.notes`)

**Keywords:**

- "Notiz [text]"
- "Bemerkung [text]"
- "Hinweis [text]"
- "Anmerkung [text]"

**Beispiele:**

- ✅ "Notiz: Rechnung wurde per E-Mail versendet"
- ✅ "Hinweis: Nachlass von 10 Prozent bereits abgezogen"

---

### 3. Rechnungspositionen

#### **Positionsbeschreibung** (`invoiceItem.description`)

**Keywords:**

- "[anzahl] [einheit] [produkt]"
- "Position [text]"
- "[produkt] für [betrag]"
- "[leistung]"

**Beispiele:**

- ✅ "2 Stunden Webentwicklung"
- ✅ "Position Beratungsleistung"
- ✅ "Webhosting für 50 Euro"
- ✅ "10 Pizzen"

#### **Menge** (`invoiceItem.quantity`)

**Keywords:**

- "[zahl] [einheit]"
- "[zahl] Stück"
- "[zahl] mal"

**Einheiten:**

- Stück / Stk
- Stunden / Std / h
- Tage
- Wochen
- Monate
- Kilometer / km
- Quadratmeter / qm / m²
- Kilogramm / kg
- Liter / l

**Beispiele:**

- ✅ "3 Stück"
- ✅ "2,5 Stunden"
- ✅ "10 Kilometer"

#### **Einzelpreis** (`invoiceItem.unitPrice`)

**Keywords:**

- "zu [betrag]"
- "à [betrag]"
- "je [betrag]"
- "pro [einheit] [betrag]"
- "Stückpreis [betrag]"

**Beispiele:**

- ✅ "zu 50 Euro"
- ✅ "à 80 Euro pro Stunde"
- ✅ "je 15 Euro"

#### **Gesamtpreis** (`invoiceItem.total`)

**Keywords:**

- "macht [betrag]"
- "ergibt [betrag]"
- "gesamt [betrag]"
- "insgesamt [betrag]"

**Beispiele:**

- ✅ "macht 100 Euro"
- ✅ "ergibt 450 Euro"

**Hinweis:** Wird automatisch berechnet: `quantity × unitPrice`

#### **Kategorie** (`invoiceItem.category`)

**Keywords:**

- "Kategorie [kategorie]"
- "unter [kategorie]"
- "als [kategorie]"

**Beispiel-Kategorien:**

- Beratung
- Entwicklung
- Design
- Support
- Hosting
- Lizenz
- Hardware
- Software
- Material
- Reisekosten
- Sonstiges

**Beispiele:**

- ✅ "Kategorie Beratung"
- ✅ "unter Entwicklung"

---

## 🗣️ Beispiel-Diktate

### Beispiel 1: Einfache Rechnung

```
"Rechnung an Max Mustermann, Bahnhofstraße 12, 60313 Frankfurt.
E-Mail max@mustermann.de, Telefon 069 123456.

2 Stunden Webentwicklung zu 80 Euro pro Stunde macht 160 Euro.

Fällig in 14 Tagen."
```

**Extrahierte Daten:**

- Customer:
  - name: "Max Mustermann"
  - address: "Bahnhofstraße 12"
  - zipCode: "60313"
  - city: "Frankfurt"
  - email: "max@mustermann.de"
  - phone: "069 123456"
- Invoice:
  - dueAt: +14 Tage
- InvoiceItem[0]:
  - quantity: 2
  - description: "Webentwicklung"
  - unitPrice: 80
  - total: 160

### Beispiel 2: Komplexe Rechnung mit mehreren Positionen

```
"Rechnung Nummer 2024-001 an Müller GmbH, Musterweg 5, 12345 Berlin.
USt-IdNr DE123456789.

Position 1: 5 Stunden Beratung à 120 Euro, Kategorie Beratung.
Position 2: 10 Stunden Entwicklung zu 100 Euro pro Stunde, Kategorie Entwicklung.
Position 3: 1 Jahr Hosting für 240 Euro.

Mit 19 Prozent Mehrwertsteuer.

Zahlungsbedingungen: 30 Tage netto.
Fällig am 25. Februar 2026.

Notiz: Rechnung wurde per E-Mail versendet."
```

**Extrahierte Daten:**

- Invoice:
  - number: "2024-001"
  - taxRate: 19
  - dueAt: "2026-02-25"
  - paymentTerms: "30 Tage netto"
  - notes: "Rechnung wurde per E-Mail versendet"
- Customer:
  - name: "Müller GmbH"
  - address: "Musterweg 5"
  - zipCode: "12345"
  - city: "Berlin"
  - taxId: "DE123456789"
- InvoiceItem[0]:
  - quantity: 5
  - description: "Beratung"
  - unitPrice: 120
  - total: 600
  - category: "Beratung"
- InvoiceItem[1]:
  - quantity: 10
  - description: "Entwicklung"
  - unitPrice: 100
  - total: 1000
  - category: "Entwicklung"
- InvoiceItem[2]:
  - quantity: 1
  - description: "Hosting"
  - unitPrice: 240
  - total: 240

### Beispiel 3: Umgangssprachliches Diktat

```
"Pizza-Bestellung für McDonald's Mannheim.
Kontakt: 0621 987654.

10 Pizza Margherita je 9 Euro macht 90 Euro.
5 Pizza Salami zu 11 Euro ergibt 55 Euro.
8 Getränke à 3 Euro ist 24 Euro.

7 Prozent MwSt.
Zahlbar sofort bar."
```

**Extrahierte Daten:**

- Customer:
  - name: "McDonald's Mannheim"
  - phone: "0621 987654"
- Invoice:
  - taxRate: 7
  - paymentTerms: "Zahlbar sofort bar"
- InvoiceItem[0]:
  - quantity: 10
  - description: "Pizza Margherita"
  - unitPrice: 9
  - total: 90
- InvoiceItem[1]:
  - quantity: 5
  - description: "Pizza Salami"
  - unitPrice: 11
  - total: 55
- InvoiceItem[2]:
  - quantity: 8
  - description: "Getränke"
  - unitPrice: 3
  - total: 24

---

## 🔍 Spezial-Keywords

### Beträge & Zahlen

**Zahlen-Wörter:**

- null, eins, zwei, drei, vier, fünf, sechs, sieben, acht, neun, zehn
- elf, zwölf, dreizehn, ..., neunzehn
- zwanzig, dreißig, vierzig, fünfzig, ..., neunzig
- hundert, tausend, million

**Kommazahlen:**

- "Komma" → "."
- "Punkt" → "."
- "zwei fünfzig" → "2,50"
- "hundert fünfzig Euro" → "150"

**Währungen:**

- Euro / EUR / €
- Dollar / USD / $
- Schweizer Franken / CHF
- Pfund / GBP / £

### Datum & Zeit

**Relative Daten:**

- "heute" → aktuelles Datum
- "morgen" → +1 Tag
- "übermorgen" → +2 Tage
- "in [X] Tagen" → +X Tage
- "nächste Woche" → +7 Tage
- "nächsten Monat" → +30 Tage

**Absolute Daten:**

- "am 25. Januar" → 25.01.
- "am ersten Februar" → 01.02.
- "am fünfzehnten" → 15.
- "15.01.2026" → 15.01.2026

**Monatsnamen:**

- Januar, Februar, März, April, Mai, Juni
- Juli, August, September, Oktober, November, Dezember

### Prozentsätze

**MwSt-Sätze (Deutschland):**

- 19% - Standardsatz
- 7% - Ermäßigter Satz (Lebensmittel, Bücher, ÖPNV)
- 0% - Steuerbefreit (Export, innergemeinschaftlich)

**Keywords:**

- "Prozent" → %
- "MwSt" → Mehrwertsteuer
- "USt" → Umsatzsteuer
- "netto" → ohne MwSt
- "brutto" → inkl. MwSt

---

## 🧠 Intelligente Extraktion

### Intent-Erkennung

**Primäre Intents:**

1. `CREATE_INVOICE` - Neue Rechnung erstellen
2. `UPDATE_CUSTOMER` - Kundendaten aktualisieren
3. `ADD_ITEM` - Position hinzufügen
4. `QUERY_STATUS` - Rechnungsstatus abfragen
5. `PAYMENT_RECEIVED` - Zahlung verbuchen

**Trigger-Keywords:**

- "Rechnung an" → CREATE_INVOICE
- "Kunde ändern" → UPDATE_CUSTOMER
- "Position" / "noch" → ADD_ITEM
- "Status" / "bezahlt?" → QUERY_STATUS
- "Zahlung erhalten" → PAYMENT_RECEIVED

### Konfidenz-Schwellwerte

**Auto-Save (≥ 0.85):**

- Alle Pflichtfelder erkannt
- Kunde eindeutig identifiziert
- Mindestens 1 Position mit Betrag
- Keine widersprüchlichen Daten

**Preview-Modus (< 0.85):**

- Fehlende Pflichtfelder
- Kunde nicht eindeutig
- Mehrdeutige Beträge
- Unklare Datumswerte

### Fehlerbehandlung

**Fehlende Daten:**

- Customer.name → "Unbekannter Kunde" (muss ergänzt werden)
- InvoiceItem.description → "Position X" (muss ergänzt werden)
- InvoiceItem.unitPrice → 0.00 (muss ergänzt werden)
- Invoice.issuedAt → aktuelles Datum
- Invoice.dueAt → issuedAt + 14 Tage (Standard)

**Standardwerte:**

- currency: "EUR"
- taxRate: 19.0
- country: "DE"
- status: "DRAFT"

---

## 📝 Checkliste für Gemini Prompt

**Pflichtfelder für erfolgreiche Extraktion:**

Customer:

- [x] name (REQUIRED)
- [ ] email (optional)
- [ ] phone (optional)
- [ ] address (optional)
- [ ] city (optional)
- [ ] zipCode (optional)

Invoice:

- [x] number (auto-generated if missing)
- [x] customerId (REQUIRED - via name matching)
- [x] subtotal (calculated from items)
- [x] taxAmount (calculated)
- [x] total (calculated)

InvoiceItem (mindestens 1):

- [x] description (REQUIRED)
- [x] quantity (default: 1)
- [x] unitPrice (REQUIRED)
- [x] total (calculated)

---

## 🎯 Gemini Extraction Prompt Template

```
Du bist ein Experte für deutsche Rechnungsextraktion aus gesprochenem Text.

EINGABE:
Transkribiertes Diktat einer Rechnung auf Deutsch.

AUFGABE:
Extrahiere alle Rechnungsinformationen und gib sie als strukturiertes JSON zurück.

SCHEMA:
{
  "customer": {
    "name": string (REQUIRED),
    "email": string | null,
    "phone": string | null,
    "address": string | null,
    "city": string | null,
    "zipCode": string | null,
    "country": string (default: "DE"),
    "taxId": string | null
  },
  "invoice": {
    "number": string | null (auto-generate if null),
    "currency": string (default: "EUR"),
    "taxRate": number (default: 19.0),
    "status": string (default: "DRAFT"),
    "issuedAt": ISO8601 | null (default: today),
    "dueAt": ISO8601 | null (default: issuedAt + 14 days),
    "paymentTerms": string | null,
    "notes": string | null
  },
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

REGELN:
1. Customer.name ist PFLICHT - ohne Namen Confidence < 0.85
2. Mindestens 1 Item mit description + unitPrice
3. Berechne totals automatisch: quantity × unitPrice
4. Deutsche Zahlen konvertieren: "zweihundert" → 200
5. Relative Daten auflösen: "in 14 Tagen" → ISO8601
6. E-Mail Phonetik: "at" → "@", "punkt" → "."
7. Confidence = 1.0 nur wenn alle REQUIRED Felder korrekt

TRANSKRIPT:
{transcription}
```

---

**Dokumentiert durch:** Claude Sonnet 4.5
**Basierend auf:** `apps/desktop/prisma/schema.prisma`
