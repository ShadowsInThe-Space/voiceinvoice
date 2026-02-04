import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { initializeDatabase, disconnectDatabase, prisma, DATABASE_VERSION } from '../src/index';

describe('Database Client', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('should export version constant', () => {
    expect(DATABASE_VERSION).toBe('0.1.0');
  });

  it('should be able to query the database', async () => {
    // Check if we can count customers (should be 0 initially)
    const count = await prisma.customer.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('should be able to create and retrieve a customer', async () => {
    const customer = await prisma.customer.create({
      data: {
        type: 'CUSTOMER',
        companyName: 'Test Company',
        country: 'DE',
      },
    });

    expect(customer).toBeDefined();
    expect(customer.id).toBeDefined();
    expect(customer.companyName).toBe('Test Company');

    const retrieved = await prisma.customer.findUnique({
      where: { id: customer.id },
    });

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(customer.id);

    // Cleanup
    await prisma.customer.delete({
      where: { id: customer.id },
    });
  });
});
