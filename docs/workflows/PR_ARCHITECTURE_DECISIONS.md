# PR Architecture Decisions - VoiceInvoice Enterprise

**Datum:** 2026-01-25
**Reviewer:** Claude Opus 4.5
**Status:** In Bearbeitung

---

## Executive Summary

Dieses Dokument enthält Architektur-Entscheidungen für die Integration der 27 offenen PRs in eine Release-Version.

### Kritische PRs (Sofortige Aufmerksamkeit)

| PR  | Titel                | Empfehlung           | Begründung                                       |
| --- | -------------------- | -------------------- | ------------------------------------------------ |
| #28 | Error Detail Leakage | **APPROVE** (92/100) | Security fix, minimal & effektiv                 |
| #19 | Dual-Layer Privacy   | **REQUEST CHANGES**  | GDPR-Leck: Unanonymisierte Transkriptionen in DB |
| #10 | Multi-Tenant Schema  | **REQUEST CHANGES**  | Fehlende Tenant-Isolation, Password-Security     |

---

## Detaillierte Review-Ergebnisse

### PR #28 - Prevent Error Detail Leakage

**Status:** APPROVE ✅
**Confidence:** 92/100

**Stärken:**

- Nutzt Fastify's eingebautes Error-Handling
- Minimale Code-Änderungen (-18/+58 Zeilen inkl. Tests)
- Umgebungsbasierte Logik (Dev vs. Prod)
- Vollständige Testabdeckung

**Schwächen (nicht blockierend):**

- Validation errors (400) zeigen noch Zod-Schema Details
- `license.ts` Route nicht im PR (separat prüfen)

**Aktion:** Kann sofort gemerged werden.

---

### PR #19 - Dual-Layer Privacy

**Status:** REQUEST CHANGES ❌
**Confidence:** 95/100

**Kritisches Problem:** GDPR-Verletzung

```typescript
// voice-invoice-pipeline.ts:487
const invoiceInput = {
  transcription, // ❌ UNANONYMISIERT in DB gespeichert!
};
```

**Weitere Issues:**

1. Breaking API-Change bei `anonymize()` Funktionssignatur
2. O(n²×m) Performance-Komplexität
3. 30% Fuzzy-Threshold zu permissiv (False Positives)
4. Fehlende Null-Safety Checks

**Erforderliche Änderungen:**

1. `transcription: anonymizedText` statt roher Text
2. Funktions-Overloading oder Umbenennung
3. Threshold auf 15-20% reduzieren

**Geschätzter Fix-Aufwand:** 30-60 Minuten

---

### PR #10 - Multi-Tenant PostgreSQL Schema

**Status:** REQUEST CHANGES ❌
**Confidence:** 92/100

**Kritische Probleme:**

1. **Keine Tenant-Isolation auf Query-Ebene**
   - Schema definiert `tenantId`, aber keine Middleware/RLS
   - Risiko: Cross-Tenant Data Leakage

2. **Plaintext Password Field**
   - `password String` ohne Hashing-Dokumentation
   - Copilot-Warnung bestätigt

3. **Fehlende onDelete Constraints**
   - Invoice.customer, Invoice.category, etc.
   - Risiko: Orphaned Records

4. **Global Email Uniqueness**
   - `email String @unique` bricht Multi-Tenancy
   - Fix: `@@unique([tenantId, email])`

5. **Fehlende kritische Indices**
   - `[tenantId, status]`
   - `[tenantId, reconciled]`
   - `[tenantId, entityType, entityId]`

**Backward-Kompatibilität:**

- Desktop: `invoiceDate` → Server: `date` (BREAKING)
- Desktop: `notes` → Server: `description` (BREAKING)
- Offline-Sync wird ohne Mapping FEHLSCHLAGEN

**Erforderliche Änderungen:**

1. Prisma Middleware für Tenant-Filtering
2. onDelete Constraints hinzufügen
3. Email-Uniqueness auf Tenant-Ebene
4. Kritische Indices hinzufügen
5. Field-Mapping für Offline-Sync dokumentieren

**Geschätzter Fix-Aufwand:** 2-4 Stunden

---

## Merge-Strategie

### Phase 1: Sicherheits-Fixes (Sofort)

```
1. PR #28 (Security) → MERGE
2. PR #19 (Privacy) → Nach Fixes MERGE
```

### Phase 2: Infrastruktur (Diese Woche)

```
3. PR #10 (Multi-Tenant) → Nach Fixes MERGE
4. PR #14 (Prisma Client) → MERGE
5. PR #15 (Hetzner Deploy) → REVIEW & MERGE
6. PR #16 (License Validation) → REVIEW & MERGE
```

### Phase 3: Features (Nächste Woche)

```
7. Banking PRs (#24, #25) → Abhängigkeits-Analyse
8. AI/Voice PRs (#9, #12) → Integration-Test
9. Performance PRs (#8, #17, #21, #22, #23, #29) → Batch-Merge
```

### Phase 4: Integration

```
10. PR #3 (95 Dateien) → Chunk-Review oder Split
11. Finale Integration & Release-Test
```

---

## Konflikte & Abhängigkeiten

### Bekannte Konflikte

| PR A | PR B       | Konflikt       | Lösung                                 |
| ---- | ---------- | -------------- | -------------------------------------- |
| #3   | #4, #5, #6 | Shared Types   | #3 zuerst, dann rebase                 |
| #24  | #25        | Banking Models | #24 (Sync) zuerst, dann #25 (Import)   |
| #10  | #14        | Prisma Schema  | #14 (Client) zuerst, dann #10 (Schema) |

### Abhängigkeitsgraph

```
#14 (Prisma Client)
    └── #10 (Multi-Tenant)
            └── #16 (License Validation)
            └── #24 (Bank Sync)
                    └── #25 (Bank Import)

#28 (Security) ─── unabhängig ───> SOFORT MERGEN

#3 (Desktop Improvements)
    └── #6 (Workflow Analytics) ─ aktueller Branch
    └── #7 (CSS Fixes)
```

---

## Nächste Schritte

- [ ] PR #28 mergen (Security)
- [ ] PR #19 Fixes anfordern (Privacy)
- [ ] PR #10 Fixes anfordern (Multi-Tenant)
- [ ] Background-Agents abwarten für:
  - Performance PRs Vergleich
  - Banking PRs Analyse
  - PR #3 Chunk-Analyse
- [ ] Notion-Dokumentation aktualisieren

---

## Performance PRs Analyse (Ergebnis)

### Empfohlene Merge-Reihenfolge

**Tier 1: Sofort merge-bar (keine Abhängigkeiten)**

1. **PR #8** - Parallel I/O (73x Verbesserung)
2. **PR #29** - InvoiceList React.memo
3. **PR #22** - Dashboard Analytics Cache

**Tier 2: Nach Tier 1** 4. **PR #17** - SQL Aggregation (33x Verbesserung) 5. **PR #21** - Batch Fetching (20x Verbesserung) - führt `populateRelations()` ein

**Tier 3: Konfliktauflösung erforderlich** 6. **PR #23** - getInvoicesByCustomer

- ⚠️ **KONFLIKT mit PR #21**: Beide ändern `getInvoicesByCustomer()` unterschiedlich
- **Empfehlung:** PR #23 schließen (durch PR #21 abgedeckt)

### Konflikt-Matrix

| PR Paar    | Konflikt? | Details                          |
| ---------- | --------- | -------------------------------- |
| #8 ↔ alle  | ❌        | Separates File                   |
| #17 ↔ #21  | ⚠️        | Gleiche Datei, separate Methoden |
| #21 ↔ #23  | 🔴        | **Beide ändern gleiche Methode** |
| #22 ↔ alle | ❌        | Separates File                   |
| #29 ↔ alle | ❌        | Frontend-only                    |

---

## PR #3 Analyse (95 Dateien)

### Kategorisierung

| Bereich      | Dateien | Kritisch? |
| ------------ | ------- | --------- |
| Desktop App  | 45      | ⚠️        |
| Proxy Server | 15      | ⚠️        |
| Packages     | 18      | ⚠️        |
| Tests        | 22      | ✅        |

### Konflikte mit anderen PRs

- **PR #20 (PDF Branding):** 4 Dateien
- **PR #22 (Analytics):** 1 Datei
- **PR #24 (Bank Sync):** 3 Dateien
- **PR #25 (Bank Import):** 6 Dateien

### Empfehlung

**NICHT ALS-IS MERGEN** - PR sollte aufgeteilt werden:

1. Desktop Features (Invoice Detail, Manual Entry)
2. Proxy Server (separater PR)
3. Bank Sync (überschneidet sich mit #24)

---

## Finale Merge-Strategie

### Phase 1: Security (Sofort)

```bash
gh pr merge 28 --squash  # Error Leakage Fix
```

### Phase 2: Performance (Low Risk)

```bash
gh pr merge 8 --squash   # Parallel I/O
gh pr merge 29 --squash  # React memo
gh pr merge 22 --squash  # Analytics cache
gh pr merge 17 --squash  # SQL aggregation
gh pr merge 21 --squash  # Batch fetching
gh pr close 23 --comment "Superseded by #21"
```

### Phase 3: Privacy (Nach Fixes)

```bash
# PR #19 erfordert Änderungen:
# - transcription: anonymizedText (GDPR-Fix)
# - Funktionssignatur-Konflikt lösen
gh pr review 19 --request-changes --body "GDPR-Leck: Unanonymisierte Transkriptionen"
```

### Phase 4: Infrastructure (Nach Review)

```bash
# PR #10 erfordert Änderungen:
# - Tenant-Isolation Middleware
# - onDelete Constraints
# - Email Uniqueness fix
gh pr review 10 --request-changes --body "Multi-Tenant Security Issues"
```

### Phase 5: Features (Konfliktauflösung)

```bash
# PR #3 aufteilen oder:
# 1. Alle konfliktierenden PRs zuerst mergen
# 2. PR #3 rebasen
# 3. PR #3 in Chunks reviewen
```

---

## Zusammenfassung

| Status              | PRs                         | Aktion                       |
| ------------------- | --------------------------- | ---------------------------- |
| **APPROVE**         | #8, #17, #21, #22, #28, #29 | Sofort mergen                |
| **REQUEST CHANGES** | #10, #19                    | Kritische Fixes erforderlich |
| **CLOSE**           | #23                         | Durch #21 abgedeckt          |
| **SPLIT**           | #3                          | Zu groß, aufteilen empfohlen |
| **PENDING**         | Rest                        | Nach Konfliktauflösung       |

---

_Generiert von Claude Opus 4.5 am 2026-01-25_
