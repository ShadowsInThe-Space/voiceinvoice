/**
 * Prisma Service
 *
 * Provides a singleton instance of the Prisma Client for server-side
 * database operations.
 *
 * @module services/prisma
 */

import { PrismaClient } from '../../../packages/database/generated/server';

// Singleton instance
let _prisma: PrismaClient | null = null;

/**
 * Shared prisma instance for direct import.
 * @deprecated Use getPrismaClient() instead for better lifecycle management.
 */
export let prisma: PrismaClient | null = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

/**
 * Get the Prisma Client instance.
 *
 * Creates the instance if it doesn't exist.
 *
 * @returns {PrismaClient} The Prisma Client
 */
export function getPrismaClient(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  }
  return _prisma;
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
