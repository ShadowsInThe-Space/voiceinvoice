# Dokumentations-Konventionen

Dieses Dokument definiert die Standards für Code-Dokumentation im VoiceInvoice Enterprise Projekt.

## JSDoc/Doxygen-Kommentare

Alle exportierten Funktionen, Klassen und Interfaces benötigen vollständige Docstring-Kommentare im JSDoc-Format, das von Doxygen verarbeitet werden kann.

### Funktionen

Jede exportierte Funktion muss folgende Elemente enthalten:

```typescript
/**
 * Kurze Zusammenfassung in einem Satz.
 *
 * Detaillierte Beschreibung des Verhaltens, der Verwendung und
 * wichtiger Hinweise. Kann mehrere Absätze umfassen.
 *
 * @param {Type} paramName - Beschreibung des Parameters
 * @param {Type} [optionalParam] - Optionaler Parameter mit Default
 * @returns {ReturnType} Beschreibung des Rückgabewerts
 * @throws {ErrorType} Wann und warum dieser Fehler geworfen wird
 *
 * @example
 * // Verwendungsbeispiel mit erwartetem Ergebnis
 * const result = myFunction('input');
 * // Returns: 'expected output'
 */
export function myFunction(paramName: Type): ReturnType {
  // Implementation
}
```

### Klassen

```typescript
/**
 * Kurze Beschreibung der Klassenverantwortlichkeit.
 *
 * Ausführliche Erklärung des Zwecks, der Verwendung und
 * des Lebenszyklus der Klasse.
 *
 * @example
 * const instance = new MyClass(config);
 * await instance.initialize();
 */
export class MyClass {
  /** Beschreibung der Property */
  public readonly propertyName: Type;

  /**
   * Erstellt eine neue Instanz.
   *
   * @param {Config} config - Konfigurationsobjekt
   */
  constructor(config: Config) {
    // Implementation
  }

  /**
   * Kurze Beschreibung der Methode.
   *
   * @param {Type} param - Parameterbeschreibung
   * @returns {ReturnType} Rückgabebeschreibung
   */
  public methodName(param: Type): ReturnType {
    // Implementation
  }
}
```

### Interfaces und Types

```typescript
/**
 * Beschreibung des Interface-Zwecks.
 *
 * Wann und wie dieses Interface verwendet wird.
 */
export interface MyInterface {
  /** Beschreibung des Feldes */
  fieldName: Type;

  /**
   * Optionales Feld mit ausführlicherer Beschreibung
   * wenn nötig.
   */
  optionalField?: Type;
}
```

## Doxygen-Spezifische Tags

Für erweiterte Dokumentation können folgende Tags verwendet werden:

- `@brief` - Kurze Zusammenfassung (optional, erste Zeile wird automatisch verwendet)
- `@details` - Ausführliche Beschreibung
- `@see` - Verweis auf verwandte Elemente
- `@since` - Version seit der das Element existiert
- `@deprecated` - Markiert veraltete Elemente mit Migrationspfad
- `@todo` - Offene Aufgaben

## Coverage-Anforderungen

- **Branches:** 80%
- **Functions:** 80%
- **Lines:** 80%
- **Statements:** 80%

## Validierung

Die Dokumentation wird automatisch validiert durch:

1. **ESLint jsdoc-Plugin:** Prüft auf vollständige JSDoc-Kommentare
2. **Doxygen:** Generiert API-Dokumentation und warnt bei fehlenden Elementen
3. **Pre-Commit Hook:** Blockiert Commits mit unvollständiger Dokumentation

Führen Sie vor jedem Commit aus:

```bash
pnpm run docs:generate
pnpm run docs:check
```

## API-Dokumentation generieren

```bash
# Generieren
pnpm run docs:generate

# Lokal ansehen
pnpm run docs:serve
# Öffne http://localhost:8080
```
