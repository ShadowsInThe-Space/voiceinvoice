# Workflow-Analyse Feature Design

**Datum:** 2026-01-25
**Status:** Genehmigt
**Branch:** `feature/workflow-analytics`

## Übersicht

Erweiterung der VoiceInvoice Desktop-App um eine vollständige Workflow-Analyse-Plattform mit:
- Persistente Speicherung aller Workflow-Ausführungen und KPIs
- Visuelle Darstellung mit Diagrammen und Tabellen
- Manuelle Trigger-Buttons für alle 10 n8n-Workflows
- Dashboard-Widget für Schnellübersicht

## Architektur

### Neue Dateien

```
apps/desktop/
├── src/pages/
│   └── workflows.tsx              # Hauptseite mit Tabs
├── src/components/workflows/
│   ├── WorkflowKPICards.tsx       # KPI-Karten
│   ├── PaymentTimeline.tsx        # Zahlungs-Zeitstrahl
│   ├── TopCustomers.tsx           # Top-Kunden-Liste
│   ├── WorkflowTriggerList.tsx    # Workflow-Buttons mit Status
│   ├── WorkflowStatistics.tsx     # Charts (Tab)
│   ├── WorkflowHistory.tsx        # Ausführungs-Tabelle (Tab)
│   └── WorkflowDashboardWidget.tsx # Dashboard-Widget
├── src/lib/database/
│   └── workflow-analytics.ts      # DB-Service für Analytics
└── src/hooks/
    ├── useWorkflowAnalytics.ts    # Hook für Workflow-Daten
    └── useInvoiceTimeline.ts      # Hook für Fälligkeiten
```

### Datenfluss

1. Workflow wird getriggert → `triggerWorkflow()`
2. Ergebnis wird in `WorkflowExecution` gespeichert
3. KPIs aus Response werden in `WorkflowKPI` extrahiert
4. Aggregation erfolgt bei App-Start oder nach Workflow-Ausführung
5. UI lädt Daten über React Hooks

## Datenbank-Schema (Prisma)

### WorkflowExecution

Speichert jede einzelne Workflow-Ausführung.

```prisma
model WorkflowExecution {
  id              String   @id @default(cuid())
  workflowIntent  String   // z.B. "WORKFLOW_MAHNWESEN"
  workflowName    String   // z.B. "Mahnwesen-Agent"
  triggeredAt     DateTime @default(now())
  executionTimeMs Int
  success         Boolean
  errorType       String?  // CREDENTIALS_MISSING, TIMEOUT, etc.
  errorMessage    String?
  params          String?  // JSON: Input-Parameter
  responseData    String?  // JSON: Workflow-Rückgabe

  @@index([workflowIntent, triggeredAt])
}
```

### WorkflowKPI

Speichert workflow-spezifische Kennzahlen.

```prisma
model WorkflowKPI {
  id             String   @id @default(cuid())
  workflowIntent String
  recordedAt     DateTime @default(now())
  metricName     String   // z.B. "offene_mahnungen_euro"
  metricValue    Float
  metricUnit     String?  // "EUR", "count", "percent"
  metadata       String?  // JSON: Zusatzinfos

  @@index([workflowIntent, metricName, recordedAt])
}
```

### WorkflowAggregation

Aggregierte Statistiken pro Zeitraum.

```prisma
model WorkflowAggregation {
  id               String   @id @default(cuid())
  workflowIntent   String
  periodType       String   // "daily", "weekly", "monthly"
  periodStart      DateTime
  executionCount   Int
  successCount     Int
  failureCount     Int
  avgExecutionTimeMs Float

  @@unique([workflowIntent, periodType, periodStart])
}
```

### KPI-Mapping pro Workflow

| Workflow | KPIs |
|----------|------|
| WORKFLOW_MAHNWESEN | offene_mahnungen_euro, ueberfaellige_count |
| WORKFLOW_RECHNUNGSEINGANG | verarbeitete_rechnungen, erkannte_summe |
| WORKFLOW_ZAHLUNGSABGLEICH | gematchte_zahlungen, offene_differenz |
| WORKFLOW_MONATSREPORT | umsatz_monat, ausgaben_monat |
| WORKFLOW_AUSGABEN | kategorisierte_ausgaben, ausgaben_summe |
| WORKFLOW_LEAD_QUALIFIZIERUNG | qualifizierte_leads, lead_score_avg |
| WORKFLOW_FOLLOW_UP | gesendete_followups, antwort_rate |
| WORKFLOW_KUNDENFEEDBACK | feedback_count, avg_bewertung |
| WORKFLOW_VERTRAGS_ERINNERUNG | ablaufende_vertraege, erinnerte_count |
| WORKFLOW_KUNDENANFRAGEN | offene_anfragen, bearbeitete_anfragen |

## UI-Design

### Hauptseite `/workflows`

```
┌─────────────────────────────────────────────────────────────────┐
│  Workflow-Analyse                              [↻ Refresh]      │
├─────────────────────────────────────────────────────────────────┤
│  KPI-Karten                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ €12.450  │ │    47    │ │  €8.320  │ │    12    │           │
│  │ Offene   │ │Rechnungen│ │ Gematchte│ │Überfällige│           │
│  │ Mahnungen│ │verarbeitet│ │Zahlungen │ │ Verträge │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
├─────────────────────────────────────────────────────────────────┤
│  Zahlungszeitstrahl                              [30 Tage ▼]    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ÜBERFÄLLIG        HEUTE              +7d    +14d   +30d │   │
│  │ ──●────────────────|─────────●────────●───────●─────────│   │
│  │   ↑                          ↑        ↑       ↑         │   │
│  │  Müller           Schmidt  Weber   Bauer                │   │
│  │  €2.400 (-5d)     €890    €1.200  €3.500               │   │
│  │  🔴               🟢       🟢      🟢                    │   │
│  └─────────────────────────────────────────────────────────┘   │
├──────────────────────────┬──────────────────────────────────────┤
│  Top 5 Kunden (Umsatz)   │  Workflows triggern                  │
│  ┌────────────────────┐  │  ┌────────────────────────────────┐  │
│  │ 1. Tech GmbH €45k  │  │  │ 📧 Rechnungseingang  [Starten] │  │
│  │ 2. Auto AG   €32k  │  │  │ ⚠️ Mahnwesen        [Starten] │  │
│  │ 3. Müller    €28k  │  │  │ 💰 Zahlungsabgleich [Starten] │  │
│  │ 4. Schmidt   €19k  │  │  │ ...                            │  │
│  │ 5. Weber     €15k  │  │  └────────────────────────────────┘  │
│  └────────────────────┘  │                                      │
├──────────────────────────┴──────────────────────────────────────┤
│  [Übersicht] [Statistiken] [Historie]     ← Tabs                │
├─────────────────────────────────────────────────────────────────┤
│  Tab-Inhalt                                                     │
└─────────────────────────────────────────────────────────────────┘
```

### Tab "Statistiken"

- Liniendiagramm: Ausführungen über Zeit (7/30/90 Tage Filter)
- Balkendiagramm: Erfolgsrate pro Workflow
- Pie-Chart: Fehlertypen-Breakdown

### Tab "Historie"

- Tabelle mit Pagination
- Spalten: Workflow, Zeitpunkt, Dauer, Status, Details-Button
- Filter: Workflow-Typ, Zeitraum, Nur Fehler

### Dashboard-Widget

```
┌─────────────────────────────────────────────────────────┐
│  Workflow-Übersicht                    [→ Alle Details] │
├─────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                   │
│  │ €12.450 │ │   47    │ │ 3 🔴    │                   │
│  │ Offene  │ │Rechnungen│ │Überfällig│                   │
│  │Mahnungen│ │ heute   │ │         │                   │
│  └─────────┘ └─────────┘ └─────────┘                   │
├─────────────────────────────────────────────────────────┤
│  Nächste Zahlungen:                                     │
│  Schmidt (€890) in 3 Tagen │ Weber (€1.200) in 7 Tagen │
└─────────────────────────────────────────────────────────┘
```

## Technologie-Stack

- **Charts:** Recharts (React-native, leichtgewichtig)
- **Datenbank:** SQLite via Prisma (bestehend)
- **State Management:** React Hooks + React Query (falls vorhanden)

## Implementierungsreihenfolge

### Phase 1 - Datenbank & Backend
1. Prisma-Schema erweitern (3 neue Tabellen)
2. Migration ausführen
3. `workflow-analytics.ts` Service erstellen
4. `triggerWorkflow()` erweitern → speichert Execution + extrahiert KPIs

### Phase 2 - Hooks & Datenlogik
5. `useWorkflowAnalytics.ts` Hook
6. `useInvoiceTimeline.ts` Hook
7. Aggregations-Logik implementieren

### Phase 3 - UI-Komponenten
8. `WorkflowKPICards.tsx`
9. `PaymentTimeline.tsx` (Recharts)
10. `TopCustomers.tsx`
11. `WorkflowTriggerList.tsx`
12. `WorkflowStatistics.tsx`
13. `WorkflowHistory.tsx`

### Phase 4 - Seiten & Integration
14. `/workflows.tsx` Seite mit Tabs
15. `WorkflowDashboardWidget.tsx`
16. Dashboard-Seite erweitern
17. Navigation erweitern

## Abhängigkeiten

Neue npm-Pakete:
```bash
pnpm add recharts
pnpm add -D @types/recharts
```

## Offene Punkte

- [ ] Aggregations-Intervall festlegen (stündlich vs. bei Bedarf)
- [ ] Daten-Retention-Policy für alte Executions
