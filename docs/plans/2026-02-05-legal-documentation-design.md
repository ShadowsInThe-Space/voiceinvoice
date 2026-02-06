# Legal Documentation Design - VoiceInvoice Enterprise

**Datum:** 2026-02-05
**Status:** Validiert
**Rechtsform:** UG (haftungsbeschränkt) in Gründung

---

## Überblick

Erstellung DSGVO-konformer Legal-Dokumentation für VoiceInvoice Enterprise SaaS:

- ✅ **AGB** (Allgemeine Geschäftsbedingungen)
- ✅ **Datenschutzerklärung** (DSGVO Art. 13/14)
- ✅ **Impressum** (§5 TMG)

---

## Architektur

### Dateistruktur

```
docs/legal/
├── agb.md                    # Source of Truth
├── datenschutz.md            # DSGVO-konform
└── impressum.md              # §5 TMG

apps/desktop/src/
├── pages/legal/
│   ├── agb.tsx              # Rendert agb.md
│   ├── datenschutz.tsx      # Rendert datenschutz.md
│   └── impressum.tsx        # Rendert impressum.md
└── components/
    └── LegalDocument.tsx    # Reusable Markdown-Renderer
```

### Build-Prozess

1. Markdown-Files liegen in `docs/legal/` (Version Control)
2. Next.js Pages lesen Markdown beim Build
3. Rendering mit `react-markdown` oder `next-mdx-remote`
4. Styling: Tailwind Typography Plugin
5. URLs: `/legal/agb`, `/legal/datenschutz`, `/legal/impressum`

---

## AGB (Allgemeine Geschäftsbedingungen)

**Umfang:** ~4-5 Seiten

### Hauptabschnitte

#### 1. Geltungsbereich & Vertragsgegenstand

- VoiceInvoice = SaaS für Rechnungserstellung via Voice
- Nutzung nur für gewerbliche Zwecke
- Software "as-is" während Beta-Phase

#### 2. Registrierung & Account

- Stripe-basierte Registrierung
- Lizenzschlüssel-Aktivierung
- Pflicht zur Angabe korrekter Unternehmensdaten

#### 3. Leistungsumfang

- Desktop-App (Electron)
- Cloud-Synchronisation (Hetzner Frankfurt)
- Voice-to-Invoice (Google Cloud AI)
- Feature-Set je nach Abo-Plan

#### 4. Voice-Daten-Verarbeitung ⭐

- Aufnahmen werden **nur bis Rechnungsbezahlung** gespeichert
- Dient als **Nachweis/Beweis** für Transaktionen
- Automatische Löschung nach Zahlungseingang
- Nutzer erlaubt Aufnahme und Verarbeitung

#### 5. AI-Features & Haftungsausschluss ⭐

- KI-generierte Rechnungen sind **Vorschläge**
- Nutzer **verantwortlich** für Korrektheit
- Keine Gewähr für AI-Genauigkeit
- VoiceInvoice haftet nicht für fehlerhafte KI-Ausgaben

#### 6. Preise und Zahlungsbedingungen ⭐

- Monatliche/jährliche Abrechnung via Stripe
- Zahlung im Voraus für kommenden Monat
- **Keine Rückerstattung** bei vorzeitiger Kündigung
- **Bezahlter Monat = Zugangsmonat** (anteilig)

#### 7. Laufzeit und Kündigung ⭐

- Vertrag läuft auf **unbestimmte Zeit**
- **Kündigungsfrist: 1 Monat** zum Monatsende
- Kündigung über Stripe Customer Portal
- Nach Kündigungsfrist: Zugang wird deaktiviert
- Bereits bezahlter Zeitraum bleibt nutzbar (kein Refund)

**Beispiel:**

```
Abo gebucht am: 15. Januar
Kündigung am: 10. Februar
→ Zugang bis: 28. Februar (bezahlter Monat)
→ Kein Refund für Feb 15-28
```

#### 8. Gewährleistung & Haftung (Beta-Phase) ⭐

- Software wird **"wie besehen"** bereitgestellt
- Keine Garantie für 100% Verfügbarkeit
- Haftung nur bei Vorsatz/grober Fahrlässigkeit
- Datensicherung liegt beim Nutzer

#### 9. Datenschutz

- Verweis auf separate Datenschutzerklärung
- DSGVO-konforme Verarbeitung
- Dual-Layer Privacy Engine

#### 10. Änderungen der AGB

- Änderungen werden per E-Mail angekündigt
- Widerspruchsrecht (1 Monat)

#### 11. Schlussbestimmungen

- Anwendbares Recht: Deutsches Recht
- Gerichtsstand: Sitz der Gesellschaft
- Salvatorische Klausel

---

## Datenschutzerklärung

**Umfang:** ~5-7 Seiten (Standard-SaaS)

### Struktur

#### 1. Verantwortlicher (Art. 13 DSGVO)

```
[Firmenname] UG (haftungsbeschränkt) i.G.
Geschäftsführer: [Platzhalter]
Adresse: [Platzhalter]
E-Mail: datenschutz@[domain]
```

#### 2. Datenverarbeitung - Übersicht

| Datenart        | Zweck                         | Rechtsgrundlage                                     |
| --------------- | ----------------------------- | --------------------------------------------------- |
| Voice-Aufnahmen | Rechnungserstellung, Nachweis | Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung)      |
| Kundendaten     | CRM, Rechnungsstellung        | Art. 6 Abs. 1 lit. b DSGVO                          |
| Rechnungsdaten  | Buchhaltung                   | Art. 6 Abs. 1 lit. c DSGVO (gesetzliche Pflicht)    |
| Nutzungsdaten   | Fehleranalyse, Sicherheit     | Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse) |
| Zahlungsdaten   | Zahlungsabwicklung            | Art. 6 Abs. 1 lit. b DSGVO                          |

#### 3. Sub-Processors (Art. 28 DSGVO) ⭐

**Google Cloud AI** (USA/EU)

- Dienste: Chirp 3 (Speech-to-Text), Gemini 2.5 Flash (NLP)
- Zweck: Voice-Transkription, Entity-Extraction
- Rechtsgrundlage: Standardvertragsklauseln (SCCs)
- Datenschutzerklärung: https://cloud.google.com/privacy

**Stripe** (USA/EU)

- Dienste: Payment Processing, Subscription Management
- Zweck: Zahlungsabwicklung
- Rechtsgrundlage: Standardvertragsklauseln (SCCs)
- Datenschutzerklärung: https://stripe.com/privacy

**Hetzner** (Deutschland, EU)

- Dienste: Server-Hosting (Proxy-Server, PostgreSQL)
- Zweck: Cloud-Synchronisation, Datenspeicherung
- Standort: Frankfurt am Main
- Datenschutzerklärung: https://hetzner.com/rechtliches/datenschutz

**Sentry** (USA/EU)

- Dienste: Error Tracking, Performance Monitoring
- Zweck: Fehleranalyse, Systemüberwachung
- Datenschutzerklärung: https://sentry.io/privacy

#### 4. Rechte der Betroffenen (Art. 15-22 DSGVO)

- ✅ **Auskunft** (Art. 15) - Kopie aller gespeicherten Daten
- ✅ **Berichtigung** (Art. 16) - Korrektur falscher Daten
- ✅ **Löschung** (Art. 17) - "Recht auf Vergessenwerden"
- ✅ **Einschränkung** (Art. 18) - Verarbeitung pausieren
- ✅ **Datenübertragbarkeit** (Art. 20) - Export im JSON-Format
- ✅ **Widerspruch** (Art. 21) - Verarbeitung widersprechen
- ✅ **Beschwerde** (Art. 77) - Bei Aufsichtsbehörde

**Ausübung der Rechte:** E-Mail an `datenschutz@[domain]`

#### 5. Speicherdauer ⭐

| Datenart        | Speicherdauer                         | Begründung                                 |
| --------------- | ------------------------------------- | ------------------------------------------ |
| Voice-Aufnahmen | Bis Rechnungsbezahlung (max. 90 Tage) | Nachweis, dann automatische Löschung       |
| Rechnungen      | 10 Jahre                              | Gesetzliche Aufbewahrungspflicht (§147 AO) |
| Kundendaten     | Geschäftsbeziehung + 3 Jahre          | Verjährungsfristen                         |
| Logs/Analytics  | 90 Tage                               | Fehleranalyse                              |
| Stripe-Daten    | Nach Stripe-Richtlinien               | Payment-Processing                         |

#### 6. Technische und organisatorische Maßnahmen (Art. 32 DSGVO) ⭐

**Dual-Layer Privacy Engine:**

1. **Client-Side Anonymisierung:**
   - Regex-basierte Erkennung von IBANs, Telefonnummern
   - Maskierung vor Upload zu Server

2. **Server-Side Deep Redaction:**
   - NLP-basierte Erkennung von Namen, Adressen
   - Fuzzy-Matching gegen Kundendatenbank
   - Maskierung vor Google Cloud AI

**Verschlüsselung:**

- Transport: TLS 1.3
- Ruhezustand: AES-256
- Ende-zu-Ende optional (künftig)

**Zugriffskontrolle:**

- Lizenzschlüssel-basierte Authentifizierung
- API-Key für Proxy-Server
- Role-Based Access Control (RBAC)

**Server-Standort:**

- Hetzner Frankfurt (EU)
- DSGVO-konformes Hosting

#### 7. Cookies & Tracking

- Keine Third-Party Cookies
- Lokale Analytics (Sentry)
- Kein Google Analytics

#### 8. Datenweitergabe an Dritte

- Nur an Sub-Processors (siehe oben)
- Keine Weitergabe an Werbepartner
- Keine Datenverkauf

#### 9. Datenschutzbeauftragter

- (Optional, erst ab 20 Mitarbeitern Pflicht)

#### 10. Änderungen der Datenschutzerklärung

- Änderungen werden per E-Mail angekündigt
- Aktuelles Datum im Header

---

## Impressum

**Umfang:** ~1 Seite

### Pflichtangaben (§5 TMG)

```markdown
# Impressum

## Angaben gemäß § 5 TMG

[Firmenname] UG (haftungsbeschränkt) in Gründung
Geschäftsführer: [Vorname Nachname]

Sitz der Gesellschaft: [Stadt]
Anschrift: [Straße Hausnummer], [PLZ] [Stadt]

**Kontakt:**
E-Mail: kontakt@[domain]
Telefon: [Platzhalter]

**Handelsregister:** (noch nicht eingetragen)
Registergericht: [Stadt]
Registernummer: (wird nachgetragen)

**Umsatzsteuer-ID:** (wird beantragt)
Gemäß § 27a Umsatzsteuergesetz

## Verantwortlich für den Inhalt (§ 55 Abs. 2 RStV)

[Geschäftsführer Name]
[Anschrift wie oben]

## Streitschlichtung

Die Europäische Kommission stellt eine Plattform zur
Online-Streitbeilegung (OS) bereit:
https://ec.europa.eu/consumers/odr

Wir sind nicht bereit oder verpflichtet, an
Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
teilzunehmen.

## Haftung für Inhalte

Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene
Inhalte auf diesen Seiten nach den allgemeinen Gesetzen
verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter
jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde
Informationen zu überwachen...
```

---

## Technische Implementierung

### LegalDocument.tsx Komponente

```typescript
interface LegalDocumentProps {
  title: string;
  content: string;
  lastUpdated: string;
}

export function LegalDocument({ title, content, lastUpdated }: LegalDocumentProps) {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{title}</h1>
        <p className="text-gray-600">Stand: {lastUpdated}</p>
      </header>

      <article className="prose prose-slate lg:prose-lg">
        <ReactMarkdown>{content}</ReactMarkdown>
      </article>

      <footer className="mt-12 pt-6 border-t">
        <p className="text-sm text-gray-600">
          Bei Fragen wenden Sie sich an:
          <a href="mailto:datenschutz@[domain]">datenschutz@[domain]</a>
        </p>
      </footer>
    </div>
  );
}
```

### Next.js Pages

```typescript
// apps/desktop/src/pages/legal/agb.tsx
import fs from 'fs';
import path from 'path';
import { GetStaticProps } from 'next';
import { LegalDocument } from '@/components/LegalDocument';

export default function AGBPage({ content }: { content: string }) {
  return (
    <LegalDocument
      title="Allgemeine Geschäftsbedingungen"
      content={content}
      lastUpdated="05.02.2026"
    />
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const filePath = path.join(process.cwd(), '../../docs/legal/agb.md');
  const content = fs.readFileSync(filePath, 'utf8');

  return {
    props: { content },
  };
};
```

---

## Akzeptanzkriterien

- [ ] `docs/legal/agb.md` erstellt (~4-5 Seiten)
- [ ] `docs/legal/datenschutz.md` erstellt (~5-7 Seiten)
- [ ] `docs/legal/impressum.md` erstellt (~1 Seite)
- [ ] `LegalDocument.tsx` Komponente implementiert
- [ ] Next.js Pages für `/legal/agb`, `/legal/datenschutz`, `/legal/impressum`
- [ ] Tailwind Typography Plugin konfiguriert
- [ ] Responsive Design (Mobile, Tablet, Desktop)
- [ ] Navigation: Footer-Links zu Legal-Pages
- [ ] Print-Styling (CSS @media print)
- [ ] Platzhalter für Firmendaten klar gekennzeichnet

---

## Nächste Schritte

1. ✅ Design validiert
2. ⏳ Git Worktree erstellen (`legal-documentation`)
3. ⏳ Implementierung der Markdown-Dokumente
4. ⏳ Implementierung der React-Komponenten
5. ⏳ Testing & Review
6. ⏳ PR erstellen

---

**Validiert von:** User
**Design erstellt von:** Claude Code (Brainstorming Skill)
