# Code Review Report: Multi-Tenant Schema Implementation

**Review-Level:** Full
**Analyzed File:** `packages/database/prisma/schema-server.prisma`
**Commit:** `f820a876fb787af0e0ce3db7ae0b8557e57afe4a`

## Zusammenfassung
Die Analyse des Multi-Tenant Schemas zeigt kritische Lücken in der referenziellen Integrität (Category Hierarchy) und Diskrepanzen zwischen Commit-Message und Implementierung (Uniqueness Constraints, fehlende Relationen). Die Isolierung der Mandanten (Tenant Isolation) ist durchgängig implementiert (`tenantId`), jedoch gibt es Edge Cases bei Uniqueness-Checks.

---

## Gefundene Probleme

### 1. Kritisch: Fehlende Self-Relation bei Kategorien (Logic Error)
**Schweregrad:** 🔴 Kritisch
**Datei:** `packages/database/prisma/schema-server.prisma` (Zeilen ~195-230)

**Problem:**
Das `Category` Modell definiert ein `parentId` Feld, aber es fehlt die entsprechende `@relation` Definition auf sich selbst.
- Es wird kein Foreign Key Constraint in der Datenbank erstellt.
- Prisma Client generiert keine Navigation Properties (`parent`, `children`).
- Traversierung des Kategorie-Baums ist nicht type-safe möglich.

**Code:**
```prisma
model Category {
  // ...
  parentId        String?
  // FEHLT: parent Category? @relation(...)
  // FEHLT: children Category[] @relation(...)
}
```

**Vorgeschlagener Fix:**
```prisma
model Category {
  // ...
  parentId        String?
  parent          Category?   @relation("CategoryHierarchy", fields: [parentId], references: [id], onDelete: SetNull)
  children        Category[]  @relation("CategoryHierarchy")
}
```
*Empfehlung:* Für Security-Review: @claude

---

### 2. Hoch: Fehlende Uniqueness für E-Mails pro Tenant (Logic/Spec Violation)
**Schweregrad:** 🟠 Hoch
**Datei:** `packages/database/prisma/schema-server.prisma` (Zeilen ~56)

**Problem:**
Die Commit-Message behauptet: *"Change email @unique to @@unique([tenantId, email])"*.
Tatsächlich implementiert ist aber nur ein Index: `@@index([tenantId, email])`.
Damit können innerhalb eines Mandanten (Tenant) mehrere Kunden mit derselben E-Mail-Adresse angelegt werden, was meistens fachlich nicht gewollt ist.

**Vorgeschlagener Fix:**
```prisma
  // Ändere @@index zu @@unique
  @@unique([tenantId, email])
```

---

### 3. Mittel: Global Unique AnonymizedToken (Edge Case / Security)
**Schweregrad:** 🟡 Mittel
**Datei:** `packages/database/prisma/schema-server.prisma` (Zeile ~46)

**Problem:**
Das Feld `anonymizedToken` ist als `@unique` markiert. Dies erzwingt **globale** Eindeutigkeit über alle Tenants hinweg.
Wenn zwei Tenants (zufällig oder böswillig) denselben Token generieren, schlägt der Insert für den zweiten Tenant fehl (DoS-Potential). In einem Multi-Tenant System sollten Uniqueness-Constraints meist auf den Tenant gescoped sein, es sei denn, der Token ist eine UUID oder systemweit garantiert eindeutig.

**Vorgeschlagener Fix:**
```prisma
  // Statt @unique
  anonymizedToken String?
  // Am Ende des Modells:
  @@unique([tenantId, anonymizedToken])
```
*Empfehlung:* Für Security-Review: @claude

---

### 4. Mittel: Inkonsistenz zu Commit-Message & Desktop Schema (Implementation Gap)
**Schweregrad:** 🟡 Mittel
**Datei:** `packages/database/prisma/schema-server.prisma` (Model `Invoice`)

**Problem:**
Die Commit-Message erwähnt: *"Add onDelete constraints: Invoice.category/recording (SetNull)"*.
Im Server-Schema fehlen jedoch:
1.  Die Felder/Relationen zu `Category` und `Recording` im `Invoice` Modell komplett.
2.  Das explizite `onDelete: Restrict` bei der `customer` Relation (Commit behauptet es sei da).

Dies führt zu Inkonsistenzen zwischen Desktop (Features vorhanden) und Server (Daten können nicht persistiert/gesynct werden).

**Vorgeschlagener Fix:**
Felder im `Invoice` Modell ergänzen und Constraints setzen:
```prisma
model Invoice {
  // ...
  customer        Customer      @relation(fields: [customerId], references: [id], onDelete: Restrict)

  // Falls Recording-Link benötigt wird (analog Desktop):
  // recordingId  String?
  // recording    Recording?    @relation(...)
}
```

---

### 5. Runtime Exceptions (Potential)
- **Foreign Key Violation:** Da `parentId` in `Category` kein echter Foreign Key ist (wegen fehlender `@relation`), könnte die Datenbank Werte akzeptieren, die auf nicht existierende Kategorien zeigen (Dangling References).
- **Collision Error:** Insert eines `Customer` mit existierendem `anonymizedToken` (eines anderen Tenants) wirft Exception.

---

## Fazit
Das Schema setzt das Multi-Tenancy-Konzept (`tenantId`) grundsätzlich um, weist aber Lücken bei der Konsistenz und referenziellen Integrität auf. Die Abweichungen zur Commit-Message lassen vermuten, dass Teile des Codes nicht korrekt gemerged oder vergessen wurden.

**Empfehlung:** Die oben genannten Fixes (insb. Category Relation und Email Uniqueness) vor dem Deployment umsetzen.
