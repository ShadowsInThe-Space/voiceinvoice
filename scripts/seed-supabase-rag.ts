/**
 * Seed Supabase Vector DB with Sample Invoice Data
 *
 * Inserts test invoices into Supabase for RAG demo.
 * Run with: tsx scripts/seed-supabase-rag.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from desktop app
config({ path: resolve(__dirname, '../apps/desktop/.env') });

import { RAGAgent } from '../packages/ai-orchestrator/src/rag-agent';

/**
 * Sample invoices for testing.
 */
const SAMPLE_INVOICES = [
  {
    invoiceNumber: 'RE-2024-001',
    customerName: 'Mustermann GmbH',
    amount: 5000,
    date: '2024-01-15',
    description: 'Webentwicklung Projekt Alpha, 50 Stunden à 100€',
  },
  {
    invoiceNumber: 'RE-2024-002',
    customerName: 'Schmidt & Partner',
    amount: 3200,
    date: '2024-01-22',
    description: 'Consulting Services, 32 Stunden à 100€',
  },
  {
    invoiceNumber: 'RE-2024-003',
    customerName: 'TechCorp AG',
    amount: 8500,
    date: '2024-02-01',
    description: 'Full-Stack Development, 85 Stunden à 100€',
  },
  {
    invoiceNumber: 'RE-2024-004',
    customerName: 'Mustermann GmbH',
    amount: 4200,
    date: '2024-02-10',
    description: 'Wartung und Support, Monat Februar 2024',
  },
  {
    invoiceNumber: 'RE-2024-005',
    customerName: 'Innovation Labs',
    amount: 12000,
    date: '2024-03-01',
    description: 'KI-Integration Projekt, 120 Stunden à 100€',
  },
];

/**
 * Main seed function.
 */
async function seedSupabase(): Promise<void> {
  console.log('🌱 Seeding Supabase Vector DB with sample invoices...\n');

  try {
    // Create RAG agent
    const agent = new RAGAgent({
      geminiApiKey: process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    });

    // Ingest each invoice
    for (const invoice of SAMPLE_INVOICES) {
      console.log(`📄 Inserting: ${invoice.invoiceNumber} - ${invoice.customerName}`);

      // Build document content
      const content = `
Rechnung ${invoice.invoiceNumber}
Kunde: ${invoice.customerName}
Betrag: ${invoice.amount}€
Datum: ${invoice.date}
Beschreibung: ${invoice.description}
      `.trim();

      // Ingest into vector DB
      const docId = await agent.ingestDocument(content, {
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        amount: invoice.amount,
        date: invoice.date,
      });

      console.log(`   ✅ Inserted with ID: ${docId}\n`);
    }

    console.log('🎉 Successfully seeded Supabase with', SAMPLE_INVOICES.length, 'invoices!');
    console.log('\n💡 Now you can test RAG queries like:');
    console.log('   - "Wie viel Umsatz hatten wir im Januar 2024?"');
    console.log('   - "Welche Rechnungen hat Mustermann GmbH?"');
    console.log('   - "Zeige mir die teuerste Rechnung"');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

// Run seed
seedSupabase();
