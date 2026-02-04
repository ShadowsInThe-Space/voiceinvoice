# Code Review Report: Privacy Engine Update

**Review-Level:** full
**Status:** ⚠️ Changes Requested / Security Review Required
**Commit:** 85d8c7f6cfc313ea31f82be73cb38fba2df57d1c

## Zusammenfassung
Der Pull Request führt kritische Sicherheitslücken und Logikfehler ein. Besonders schwerwiegend sind die unzureichende Unicode-Unterstützung bei der PII-Erkennung (Datenleck-Gefahr) und die Verwendung eines schwachen Hash-Algorithmus für die Pseudonymisierung (Datenkorruptions-Gefahr). Zudem fehlt eine Datei (`anonymizer.ts`), die laut PR-Statistiken enthalten sein sollte.

**Empfehlung:** Für Security-Review: @claude

---

## 1. Bugs und Logic-Fehler

### [CRITICAL] Fehlende Datei `anonymizer.ts`
- **Datei:** `packages/privacy-engine/src/anonymizer.ts`
- **Problem:** Die Datei wird in den PR-Statistiken mit 189 Zeilen aufgeführt, ist aber im Dateisystem nicht vorhanden. Die Logik scheint stattdessen weiterhin (oder teilweise) in `packages/privacy-engine/src/index.ts` zu liegen.
- **Fix:** Stellen Sie sicher, dass die Datei korrekt eingecheckt wurde oder bereinigen Sie die PR-Referenzen.

### [CRITICAL] Hash-Kollisionsrisiko (Datenkorruption)
- **Datei:** `packages/privacy-engine/src/index.ts` (Funktion `generateHash`)
- **Problem:** Die Funktion verwendet einen einfachen 32-Bit-Integer-Hash (Java String Hash Variante) und schneidet das Ergebnis auf 8 Zeichen ab. Bei einem Adressraum von nur ~4 Milliarden Werten ist die Wahrscheinlichkeit von Kollisionen (Birthday Paradox) bei der Verarbeitung großer Kundenbestände inakzeptabel hoch (~65.000 Einträge für 50% Kollisionswahrscheinlichkeit).
- **Folge:** Unterschiedliche PII-Werte erhalten denselben Token. Bei der De-Anonymisierung wird der falsche Originalwert wiederhergestellt (Identitätsvertauschung).
- **Fix:** Verwenden Sie kryptografisch sichere Hashes (z.B. SHA-256, gekürzt auf 16+ Hex-Zeichen) oder UUIDs v4, sofern Determinsmus nicht zwingend über Sessions hinweg erforderlich ist.

### [CRITICAL] Unicode PII Leak
- **Datei:** `packages/privacy-engine/src/index.ts` (Regex `PII_PATTERNS.EMAIL`)
- **Problem:** Das Regex `/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g` unterstützt keine Unicode-Zeichen.
- **Beispiel:** `müller@firma.de` wird nur als `ller@firma.de` erkannt.
- **Folge:** `mü` bleibt im Klartext stehen (`mü[EMAIL_REDACTED]`). Dies ist ein DSGVO-Verstoß.
- **Fix:** Nutzung von Unicode Property Escapes (`\p{L}`) oder entsprechenden Libraries/Flags (Flag `u`).

### [HIGH] Fehlerhafter Test (False Positive)
- **Datei:** `packages/privacy-engine/tests/anonymize.test.ts`
- **Problem:** Der Test `should handle unicode characters` prüft nur `matches.length`, nicht aber den extrahierten Wert. Er besteht fälschlicherweise, obwohl nur ein Teil der E-Mail erkannt wird.
- **Fix:** Assert auf `match.value` hinzufügen (`expect(matches[0].value).toBe('müller@firma.de')`).

### [MEDIUM] Case-Sensitivity bei Firmenerkennung
- **Datei:** `packages/privacy-engine/src/dual-layer-privacy.ts` (`extractPotentialNames`)
- **Problem:** Die Regex-Muster suchen nur nach großgeschriebenen Wörtern (`[A-Z...]`) und spezifischen Suffixen wie `GmbH` (case-sensitive). Kleingeschriebene Tippfehler (z.B. "schmidt gmbh") werden ignoriert und nicht fuzzy-gematcht.
- **Fix:** Case-Insensitive Regex (`i` Flag) oder Normalisierung des Textes vor der Extraktion.

---

## 2. Potenzielle Runtime-Exceptions

### [HIGH] Performance Bottleneck (O(M*N))
- **Datei:** `packages/privacy-engine/src/dual-layer-privacy.ts` (`ClientPrivacyLayer.maskCustomerNames`)
- **Problem:** Es wird über alle `customerNames` (N) und alle extrahierten `words` (M) iteriert. Innerhalb der Schleife wird für jeden Vergleich die Levenshtein-Distanz berechnet.
- **Szenario:** Bei 10.000 Kunden und einem langen Dokument kann dies den Main-Thread blockieren (DoS-Gefahr).
- **Fix:**
    1. Invertierter Index für Kunden (z.B. Trigram-Index).
    2. Berechnung des phonetischen Codes für Kunden *vor* der Schleife (beim Hinzufügen).
    3. Nur Fuzzy-Match prüfen, wenn kein exakter Match vorliegt.

---

## 3. Edge Cases

### Token-Generierung (Placeholder Kollision)
- **Datei:** `packages/privacy-engine/src/dual-layer-privacy.ts` (`PrivacyTokenManager`)
- **Problem:** `placeholder` verwendet `id.slice(4)`. Wenn `generateTokenId` (basierend auf `Math.random`) Kollisionen in den letzten 8 Zeichen erzeugt, sind die Placeholder identisch.
- **Fix:** Prüfung auf Existenz des IDs in `this.tokens` vor der Zuweisung.

### Validierung von Telefonnummern
- **Datei:** `packages/privacy-engine/src/index.ts`
- **Problem:** Das Pattern `0\d{2,4}...` ist sehr generisch und könnte Produkt-IDs oder Datumsangaben (z.B. `01.02.2023` -> `01` `022023` wenn Trenner ignoriert werden) fälschlicherweise als Telefonnummer erkennen und redigieren.
- **Fix:** Strengere Validierung der Länge und Struktur (z.B. `libphonenumber-js`).

---

## Zusammenfassung der Action Items

1. **Datei `anonymizer.ts` wiederherstellen/fixen.**
2. **Hash-Algorithmus durch SHA-256 ersetzen.**
3. **E-Mail Regex auf Unicode erweitern.**
4. **Tests reparieren (Value Assertions).**
5. **Fuzzy-Matching Performance optimieren.**
