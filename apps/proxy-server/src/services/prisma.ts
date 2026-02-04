/**
 * Prisma Service
 *
 * Provides a singleton instance of the Prisma Client for server-side
 * database operations.
 *
 * @module services/prisma
 */

import { PrismaClient } from '../../generated/client';

// Singleton instance
let prisma: PrismaClient | null = null;

/**
 * Get the Prisma Client instance.
 *
 * Creates the instance if it doesn't exist.
 *
 * @returns {PrismaClient} The Prisma Client
 */
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  }
  return prisma;
}

/**
 * Disconnect the Prisma Client.
 *
 * Useful for graceful shutdowns.
 */
export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
