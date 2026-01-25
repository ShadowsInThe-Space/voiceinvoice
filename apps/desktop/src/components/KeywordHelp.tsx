/**
 * KeywordHelp Component
 *
 * Displays voice-diktat keywords and examples in a modal dialog.
 * Helps users understand what they can say when creating invoices.
 *
 * @module components/KeywordHelp
 */

import React, { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { getKeywordCategories, type KeywordCategory } from '../lib/ai/invoice-keywords';

/**
 * Props for KeywordHelp component
 */
export interface KeywordHelpProps {
  /** Optional className for styling */
  className?: string;
}

/**
 * KeywordHelp component with modal dialog.
 *
 * Displays comprehensive keyword help for voice dictation.
 *
 * @param props - Component props
 * @param props.className
 * @returns React element
 */
export function KeywordHelp({ className = '' }: KeywordHelpProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const categories = getKeywordCategories();

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted transition-colors ${className}`}
        title="Voice-Diktat Hilfe"
      >
        <HelpCircle className="h-5 w-5" />
        <span className="text-sm font-medium">Diktat-Hilfe</span>
      </button>

      {/* Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative bg-background rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col mx-4">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold">Voice-Diktat Hilfe</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                title="Schließen"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <p className="text-muted-foreground mb-6">
                Verwenden Sie diese Keywords beim Diktieren von Rechnungen. Das System erkennt
                automatisch die verschiedenen Felder und extrahiert die Informationen.
              </p>

              {/* Customer Section */}
              <section className="mb-8">
                <h3 className="text-xl font-semibold mb-4 text-primary">Kunde</h3>
                <div className="space-y-4">
                  {categories.customer.map((category) => (
                    <KeywordCard key={category.field} category={category} />
                  ))}
                </div>
              </section>

              {/* Invoice Section */}
              <section className="mb-8">
                <h3 className="text-xl font-semibold mb-4 text-primary">Rechnung</h3>
                <div className="space-y-4">
                  {categories.invoice.map((category) => (
                    <KeywordCard key={category.field} category={category} />
                  ))}
                </div>
              </section>

              {/* Items Section */}
              <section className="mb-8">
                <h3 className="text-xl font-semibold mb-4 text-primary">Positionen</h3>
                <div className="space-y-4">
                  {categories.items.map((category) => (
                    <KeywordCard key={category.field} category={category} />
                  ))}
                </div>
              </section>

              {/* Example Dictation */}
              <section className="mt-8 p-6 bg-muted rounded-lg">
                <h3 className="text-lg font-semibold mb-3">Beispiel-Diktat</h3>
                <div className="space-y-2 text-sm">
                  <p className="font-mono bg-background p-3 rounded border">
                    &quot;Rechnung an Max Mustermann, Bahnhofstraße 12, 60313 Frankfurt. E-Mail
                    max@mustermann.de.
                    <br />
                    <br />
                    2 Stunden Webentwicklung zu 80 Euro pro Stunde macht 160 Euro.
                    <br />
                    <br />
                    Fällig in 14 Tagen.&quot;
                  </p>
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="p-6 border-t bg-muted/50">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  💡 Tipp: Sie müssen nicht alle Felder angeben. Fehlende Daten können später
                  ergänzt werden.
                </span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Verstanden
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * KeywordCard displays a single keyword category with examples.
 * @param root0
 * @param root0.category
 */
function KeywordCard({ category }: { category: KeywordCategory }): React.ReactElement {
  return (
    <div className="p-4 border rounded-lg bg-card">
      <h4 className="font-semibold mb-2 capitalize">{category.field}</h4>

      {/* Keywords */}
      <div className="mb-3">
        <span className="text-sm text-muted-foreground">Keywords: </span>
        <div className="flex flex-wrap gap-1 mt-1">
          {category.keywords.map((keyword, idx) => (
            <span
              key={idx}
              className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium"
            >
              {keyword}
            </span>
          ))}
        </div>
      </div>

      {/* Examples */}
      <div className="mb-2">
        <span className="text-sm text-muted-foreground">Beispiele:</span>
        <ul className="mt-1 space-y-1">
          {category.examples.map((example, idx) => (
            <li
              key={idx}
              className="text-sm text-foreground pl-4 relative before:content-['✓'] before:absolute before:left-0 before:text-primary"
            >
              {example}
            </li>
          ))}
        </ul>
      </div>

      {/* Notes */}
      {category.notes && (
        <div className="mt-2 pt-2 border-t text-xs text-muted-foreground italic">
          💡 {category.notes}
        </div>
      )}
    </div>
  );
}
