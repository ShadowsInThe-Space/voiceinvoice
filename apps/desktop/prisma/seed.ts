/**
 * Database seed script for test data.
 *
 * Creates 12 customers and 30 invoices with various statuses
 * for testing the workflow analytics dashboard.
 *
 * Run with: npx tsx prisma/seed.ts
 */

import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

/**
 * Test customers data with complete information.
 */
const CUSTOMERS = [
  {
    name: 'Tech Solutions GmbH',
    email: 'info@techsolutions.de',
    phone: '030 123456789',
    address: 'Alexanderplatz 1',
    zipCode: '10178',
    city: 'Berlin',
    taxId: 'DE123456789',
  },
  {
    name: 'Auto Müller AG',
    email: 'kontakt@auto-mueller.de',
    phone: '089 987654321',
    address: 'Leopoldstraße 50',
    zipCode: '80802',
    city: 'München',
    taxId: 'DE234567890',
  },
  {
    name: 'Schmidt & Partner Rechtsanwälte',
    email: 'office@schmidt-partner.de',
    phone: '040 555666777',
    address: 'Jungfernstieg 30',
    zipCode: '20354',
    city: 'Hamburg',
    taxId: 'DE345678901',
  },
  {
    name: 'Weber Consulting International',
    email: 'info@weber-consulting.de',
    phone: '069 111222333',
    address: 'Mainzer Landstraße 100',
    zipCode: '60329',
    city: 'Frankfurt',
    taxId: 'DE456789012',
  },
  {
    name: 'Bauer Industries AG',
    email: 'vertrieb@bauer-ind.de',
    phone: '0711 444555666',
    address: 'Königstraße 25',
    zipCode: '70173',
    city: 'Stuttgart',
    taxId: 'DE567890123',
  },
  {
    name: 'Digital Dynamics GmbH',
    email: 'hello@digitaldynamics.de',
    phone: '0221 777888999',
    address: 'Hohenzollernring 85',
    zipCode: '50672',
    city: 'Köln',
    taxId: 'DE678901234',
  },
  {
    name: 'Schneider Logistik & Transport',
    email: 'info@schneider-log.de',
    phone: '0211 333444555',
    address: 'Königsallee 60',
    zipCode: '40212',
    city: 'Düsseldorf',
    taxId: 'DE789012345',
  },
  {
    name: 'Fischer IT Services GmbH',
    email: 'support@fischer-it.de',
    phone: '0341 666777888',
    address: 'Augustusplatz 10',
    zipCode: '04109',
    city: 'Leipzig',
    taxId: 'DE890123456',
  },
  {
    name: 'Hoffmann Marketing Agentur',
    email: 'team@hoffmann-marketing.de',
    phone: '0351 222333444',
    address: 'Prager Straße 8',
    zipCode: '01069',
    city: 'Dresden',
    taxId: 'DE901234567',
  },
  {
    name: 'Klein & Groß Handels OHG',
    email: 'kontakt@klein-gross.de',
    phone: '0511 888999000',
    address: 'Ernst-August-Platz 5',
    zipCode: '30159',
    city: 'Hannover',
    taxId: 'DE012345678',
  },
  {
    name: 'Meyer Elektrotechnik GmbH',
    email: 'info@meyer-elektro.de',
    phone: '0911 555444333',
    address: 'Königstraße 40',
    zipCode: '90402',
    city: 'Nürnberg',
    taxId: 'DE112233445',
  },
  {
    name: 'Wagner Bau & Immobilien GmbH',
    email: 'anfrage@wagner-bau.de',
    phone: '0421 111999888',
    address: 'Am Markt 20',
    zipCode: '28195',
    city: 'Bremen',
    taxId: 'DE223344556',
  },
  {
    name: 'Krüger Medizintechnik AG',
    email: 'info@krueger-med.de',
    phone: '0201 777666555',
    address: 'Limbecker Platz 1',
    zipCode: '45127',
    city: 'Essen',
    taxId: 'DE334455667',
  },
  {
    name: 'Lehmann Software Solutions',
    email: 'contact@lehmann-soft.de',
    phone: '0231 444333222',
    address: 'Kampstraße 45',
    zipCode: '44137',
    city: 'Dortmund',
    taxId: 'DE445566778',
  },
  {
    name: 'Schulze Maschinenbau GmbH',
    email: 'vertrieb@schulze-mb.de',
    phone: '0371 999888777',
    address: 'Zwickauer Straße 150',
    zipCode: '09116',
    city: 'Chemnitz',
    taxId: 'DE556677889',
  },
];

/**
 * Invoice descriptions for realistic data.
 */
const INVOICE_DESCRIPTIONS = [
  { desc: 'Webentwicklung und Design', unit: 'Stunden', priceRange: [85, 150] },
  { desc: 'IT-Beratung und Strategie', unit: 'Stunden', priceRange: [120, 200] },
  { desc: 'Softwarelizenz Enterprise', unit: 'Lizenz', priceRange: [500, 2000] },
  { desc: 'Wartungsvertrag monatlich', unit: 'Monat', priceRange: [200, 800] },
  { desc: 'Server-Hosting Premium', unit: 'Monat', priceRange: [50, 300] },
  { desc: 'Projektmanagement', unit: 'Stunden', priceRange: [90, 140] },
  { desc: 'Schulung vor Ort', unit: 'Tag', priceRange: [800, 1500] },
  { desc: 'Datenbank-Optimierung', unit: 'Stunden', priceRange: [100, 180] },
  { desc: 'API-Entwicklung', unit: 'Stunden', priceRange: [95, 160] },
  { desc: 'Security Audit', unit: 'Pauschal', priceRange: [2000, 5000] },
  { desc: 'Cloud-Migration', unit: 'Stunden', priceRange: [110, 170] },
  { desc: 'Mobile App Entwicklung', unit: 'Stunden', priceRange: [100, 180] },
  { desc: 'UX/UI Design', unit: 'Stunden', priceRange: [80, 130] },
  { desc: 'Technischer Support', unit: 'Stunden', priceRange: [60, 100] },
  { desc: 'Dokumentation & Handbuch', unit: 'Pauschal', priceRange: [500, 1500] },
];

/**
 * Payment terms options.
 */
const PAYMENT_TERMS = [
  'Zahlbar innerhalb von 14 Tagen nach Rechnungserhalt.',
  'Zahlbar innerhalb von 30 Tagen netto.',
  'Zahlbar sofort ohne Abzug.',
  '2% Skonto bei Zahlung innerhalb von 10 Tagen, sonst 30 Tage netto.',
  'Zahlbar innerhalb von 7 Tagen nach Rechnungserhalt.',
];

/**
 * Generates a CUID-like ID.
 */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `c${timestamp}${random}`;
}

/**
 * Returns a random element from an array.
 * @param arr
 */
function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Returns a random number between min and max.
 * @param min
 * @param max
 */
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Adds days to a date.
 * @param date
 * @param days
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Main seed function.
 */
async function main() {
  console.log('🌱 Seeding database...\n');

  // Clean up existing data
  console.log('Cleaning up existing data...');
  await prisma.$executeRawUnsafe('DELETE FROM InvoiceItem');
  await prisma.$executeRawUnsafe('DELETE FROM Invoice');
  await prisma.$executeRawUnsafe('DELETE FROM Customer');
  await prisma.$executeRawUnsafe('DELETE FROM WorkflowExecution');
  await prisma.$executeRawUnsafe('DELETE FROM WorkflowKPI');

  const now = new Date();

  // Create 20 customers with complete data
  console.log('Creating 20 customers with full details...');
  const customerIds: string[] = [];

  for (let i = 0; i < 20; i++) {
    const id = generateId();
    const timestamp = now.toISOString();

    let customer;
    if (i < CUSTOMERS.length) {
      customer = CUSTOMERS[i];
    } else {
      // Generate additional customers
      const cities = [
        { city: 'Bonn', zip: '53111', street: 'Münsterplatz' },
        { city: 'Mannheim', zip: '68161', street: 'Planken' },
        { city: 'Karlsruhe', zip: '76133', street: 'Kaiserstraße' },
        { city: 'Wiesbaden', zip: '65183', street: 'Wilhelmstraße' },
        { city: 'Mainz', zip: '55116', street: 'Ludwigstraße' },
      ];
      const loc = cities[i % cities.length];
      customer = {
        name: `Firma ${String.fromCharCode(65 + i)} GmbH`,
        email: `info@firma-${String.fromCharCode(97 + i)}.de`,
        phone: `0${randomBetween(200, 999)} ${randomBetween(100000, 999999)}`,
        address: `${loc.street} ${randomBetween(1, 100)}`,
        zipCode: loc.zip,
        city: loc.city,
        taxId: `DE${randomBetween(100000000, 999999999)}`,
      };
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO Customer (id, name, email, phone, address, zipCode, city, taxId, country, createdAt, updatedAt, syncVersion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DE', ?, ?, 0)`,
      id,
      customer.name,
      customer.email,
      customer.phone,
      customer.address,
      customer.zipCode,
      customer.city,
      customer.taxId,
      timestamp,
      timestamp
    );

    customerIds.push(id);
    console.log(`  ✓ ${customer.name} (${customer.city})`);
  }

  // Create 50 invoices with various statuses
  console.log('\nCreating 50 invoices...');

  const statuses = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'];
  const statusWeights = [5, 10, 25, 8, 2]; // Distribution for 50
  const weightedStatuses: string[] = [];
  statuses.forEach((status, i) => {
    for (let j = 0; j < statusWeights[i]; j++) {
      weightedStatuses.push(status);
    }
  });

  for (let i = 1; i <= 50; i++) {
    const id = generateId();
    const number = `INV-${i.toString().padStart(6, '0')}`;
    const customerId = randomFrom(customerIds);
    const status = randomFrom(weightedStatuses);

    // Random amounts
    const subtotal = randomBetween(500, 15000);
    const taxRate = 19.0;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    // Dates based on status
    let issuedAt: Date | null = null;
    let dueAt: Date | null = null;
    let paidAt: Date | null = null;

    const createdAt = addDays(now, -randomBetween(1, 90));

    if (status !== 'DRAFT') {
      issuedAt = addDays(createdAt, randomBetween(0, 3));
      dueAt = addDays(issuedAt, 30); // 30 days payment term
    }

    if (status === 'PAID') {
      paidAt = addDays(issuedAt!, randomBetween(5, 25));
    }

    if (status === 'OVERDUE') {
      // Make sure it's actually overdue
      dueAt = addDays(now, -randomBetween(5, 30));
      issuedAt = addDays(dueAt, -30);
    }

    if (status === 'SENT') {
      // Some upcoming, some just sent
      const daysUntilDue = randomBetween(-5, 25);
      dueAt = addDays(now, daysUntilDue);
      issuedAt = addDays(dueAt, -30);
    }

    const timestamp = createdAt.toISOString();
    const paymentTerms = randomFrom(PAYMENT_TERMS);
    const notes = Math.random() > 0.7 ? `Projekt-Nr. ${randomBetween(1000, 9999)}` : null;

    await prisma.$executeRawUnsafe(
      `INSERT INTO Invoice (
        id, number, customerId, subtotal, taxRate, taxAmount, total, currency,
        status, issuedAt, dueAt, paidAt, paymentTerms, notes, createdAt, updatedAt, syncVersion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'EUR', ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      id,
      number,
      customerId,
      subtotal,
      taxRate,
      taxAmount,
      total,
      status,
      issuedAt?.toISOString() ?? null,
      dueAt?.toISOString() ?? null,
      paidAt?.toISOString() ?? null,
      paymentTerms,
      notes,
      timestamp,
      timestamp
    );

    // Create 1-3 invoice items using realistic descriptions
    const itemCount = randomBetween(1, 3);
    for (let j = 0; j < itemCount; j++) {
      const itemId = generateId();
      const descItem = randomFrom(INVOICE_DESCRIPTIONS);
      const quantity = randomBetween(1, 20);
      const unitPrice = randomBetween(descItem.priceRange[0], descItem.priceRange[1]);
      const itemTotal = quantity * unitPrice;

      await prisma.$executeRawUnsafe(
        `INSERT INTO InvoiceItem (id, invoiceId, description, quantity, unitPrice, total, createdAt, updatedAt, syncVersion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        itemId,
        id,
        descItem.desc,
        quantity,
        unitPrice,
        itemTotal,
        timestamp,
        timestamp
      );
    }

    const statusEmoji =
      status === 'PAID'
        ? '💰'
        : status === 'OVERDUE'
          ? '⚠️'
          : status === 'SENT'
            ? '📧'
            : status === 'DRAFT'
              ? '📝'
              : '❌';
    console.log(`  ${statusEmoji} ${number} - €${total.toFixed(2)} (${status})`);
  }

  // Create some workflow executions for testing
  console.log('\nCreating sample workflow executions...');

  const workflowIntents = [
    { intent: 'WORKFLOW_MAHNWESEN', name: 'Mahnwesen-Agent' },
    { intent: 'WORKFLOW_RECHNUNGSEINGANG', name: 'Rechnungseingangs-Agent' },
    { intent: 'WORKFLOW_ZAHLUNGSABGLEICH', name: 'Zahlungsabgleich-Agent' },
    { intent: 'WORKFLOW_MONATSREPORT', name: 'Monatsabschluss-Report' },
  ];

  for (let i = 0; i < 20; i++) {
    const id = generateId();
    const workflow = randomFrom(workflowIntents);
    const success = Math.random() > 0.2; // 80% success rate
    const executionTimeMs = randomBetween(500, 5000);
    const triggeredAt = addDays(now, -randomBetween(0, 30));

    await prisma.$executeRawUnsafe(
      `INSERT INTO WorkflowExecution (
        id, workflowIntent, workflowName, triggeredAt, executionTimeMs,
        success, errorType, errorMessage, params, responseData
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      workflow.intent,
      workflow.name,
      triggeredAt.toISOString(),
      executionTimeMs,
      success ? 1 : 0,
      success ? null : randomFrom(['TIMEOUT', 'CREDENTIALS_MISSING', 'EXECUTION_FAILED']),
      success ? null : 'Simulated error for testing',
      null,
      success ? JSON.stringify({ processed: randomBetween(1, 10) }) : null
    );

    console.log(`  ${success ? '✓' : '✗'} ${workflow.name}`);
  }

  // Create some KPIs
  console.log('\nCreating sample KPIs...');

  const kpiData = [
    { intent: 'WORKFLOW_MAHNWESEN', name: 'offene_mahnungen_euro', value: 12450, unit: 'EUR' },
    { intent: 'WORKFLOW_MAHNWESEN', name: 'ueberfaellige_count', value: 6, unit: 'count' },
    {
      intent: 'WORKFLOW_RECHNUNGSEINGANG',
      name: 'verarbeitete_rechnungen',
      value: 47,
      unit: 'count',
    },
    { intent: 'WORKFLOW_RECHNUNGSEINGANG', name: 'erkannte_summe', value: 34500, unit: 'EUR' },
    { intent: 'WORKFLOW_ZAHLUNGSABGLEICH', name: 'gematchte_zahlungen', value: 8320, unit: 'EUR' },
    {
      intent: 'WORKFLOW_VERTRAGS_ERINNERUNG',
      name: 'ablaufende_vertraege',
      value: 12,
      unit: 'count',
    },
  ];

  for (const kpi of kpiData) {
    const id = generateId();
    await prisma.$executeRawUnsafe(
      `INSERT INTO WorkflowKPI (id, workflowIntent, recordedAt, metricName, metricValue, metricUnit)
       VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      kpi.intent,
      now.toISOString(),
      kpi.name,
      kpi.value,
      kpi.unit
    );
    console.log(`  ✓ ${kpi.name}: ${kpi.value} ${kpi.unit}`);
  }

  console.log('\n✨ Seeding complete!');
  console.log('   - 12 Customers');
  console.log('   - 30 Invoices');
  console.log('   - 20 Workflow Executions');
  console.log('   - 6 KPIs');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
