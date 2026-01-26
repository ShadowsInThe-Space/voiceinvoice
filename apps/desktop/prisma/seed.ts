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
 * Test customers data.
 */
const CUSTOMERS = [
  { name: 'Tech Solutions GmbH', email: 'info@techsolutions.de', city: 'Berlin' },
  { name: 'Auto Müller AG', email: 'kontakt@auto-mueller.de', city: 'München' },
  { name: 'Schmidt & Partner', email: 'office@schmidt-partner.de', city: 'Hamburg' },
  { name: 'Weber Consulting', email: 'info@weber-consulting.de', city: 'Frankfurt' },
  { name: 'Bauer Industries', email: 'vertrieb@bauer-ind.de', city: 'Stuttgart' },
  { name: 'Digital Dynamics', email: 'hello@digitaldynamics.de', city: 'Köln' },
  { name: 'Schneider Logistik', email: 'info@schneider-log.de', city: 'Düsseldorf' },
  { name: 'Fischer IT Services', email: 'support@fischer-it.de', city: 'Leipzig' },
  { name: 'Hoffmann Marketing', email: 'team@hoffmann-marketing.de', city: 'Dresden' },
  { name: 'Klein & Groß OHG', email: 'kontakt@klein-gross.de', city: 'Hannover' },
  { name: 'Meyer Elektro', email: 'info@meyer-elektro.de', city: 'Nürnberg' },
  { name: 'Wagner Bau GmbH', email: 'anfrage@wagner-bau.de', city: 'Bremen' },
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
 */
function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Returns a random number between min and max.
 */
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Adds days to a date.
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

  // Create 30 customers
  console.log('Creating 30 customers...');
  const customerIds: string[] = [];

  // Use defined customers + generated ones
  for (let i = 0; i < 30; i++) {
    const id = generateId();
    const timestamp = now.toISOString();

    let name, email, city;
    if (i < CUSTOMERS.length) {
      name = CUSTOMERS[i].name;
      email = CUSTOMERS[i].email;
      city = CUSTOMERS[i].city;
    } else {
      name = `Kunde ${String.fromCharCode(65 + (i % 26))}${i}`;
      email = `kunde${i}@demo.de`;
      city = randomFrom(['Berlin', 'München', 'Hamburg', 'Köln']);
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO Customer (id, name, email, city, country, createdAt, updatedAt, syncVersion)
       VALUES (?, ?, ?, ?, 'DE', ?, ?, 0)`,
      id,
      name,
      email,
      city,
      timestamp,
      timestamp
    );

    customerIds.push(id);
    if (i < 5 || i > 25) console.log(`  ✓ ${name}`);
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

    await prisma.$executeRawUnsafe(
      `INSERT INTO Invoice (
        id, number, customerId, subtotal, taxRate, taxAmount, total, currency,
        status, issuedAt, dueAt, paidAt, createdAt, updatedAt, syncVersion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'EUR', ?, ?, ?, ?, ?, ?, 0)`,
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
      timestamp,
      timestamp
    );

    // Create 1-3 invoice items
    const itemCount = randomBetween(1, 3);
    for (let j = 0; j < itemCount; j++) {
      const itemId = generateId();
      const descriptions = [
        'Beratungsleistungen',
        'Softwareentwicklung',
        'Projektmanagement',
        'Technischer Support',
        'Schulung & Training',
        'Wartungsvertrag',
        'Lizenzgebühren',
        'Hardware-Installation',
      ];
      const quantity = randomBetween(1, 20);
      const unitPrice = randomBetween(50, 500);
      const itemTotal = quantity * unitPrice;

      await prisma.$executeRawUnsafe(
        `INSERT INTO InvoiceItem (id, invoiceId, description, quantity, unitPrice, total, createdAt, updatedAt, syncVersion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        itemId,
        id,
        randomFrom(descriptions),
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
    { intent: 'WORKFLOW_RECHNUNGSEINGANG', name: 'verarbeitete_rechnungen', value: 47, unit: 'count' },
    { intent: 'WORKFLOW_RECHNUNGSEINGANG', name: 'erkannte_summe', value: 34500, unit: 'EUR' },
    { intent: 'WORKFLOW_ZAHLUNGSABGLEICH', name: 'gematchte_zahlungen', value: 8320, unit: 'EUR' },
    { intent: 'WORKFLOW_VERTRAGS_ERINNERUNG', name: 'ablaufende_vertraege', value: 12, unit: 'count' },
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
