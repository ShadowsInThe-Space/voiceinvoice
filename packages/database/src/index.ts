/**
 * Database module for VoiceInvoice Enterprise.
 *
 * Provides Prisma client access for both SQLite (desktop) and
 * PostgreSQL (server) databases. This module handles client
 * initialization and connection management.
 *
 * @packageDocumentation
 * @module @voiceinvoice/database
 */

import { PrismaClient } from '../generated/client';

export * from '../generated/client';

/**
 * Global variable to hold the Prisma Client instance in development
 * to prevent multiple instances during hot-reloading.
 */
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/**
 * The Prisma Client instance.
 *
 * Uses a singleton pattern to ensure only one instance exists.
 */
export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Initializes the database connection.
 *
 * It attempts to connect to the database to ensure the client is ready.
 *
 * @returns {Promise<void>} Resolves when database is connected
 * @throws {Error} If connection fails
 *
 * @example
 * await initializeDatabase();
 * // Database is now ready for queries
 */
export async function initializeDatabase(): Promise<void> {
  await prisma.$connect();
}

/**
 * Disconnects the database connection.
 *
 * Should be called when the application shuts down.
 *
 * @returns {Promise<void>} Resolves when database is disconnected
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}


/**
 * Database module version for compatibility checking.
 */
export const DATABASE_VERSION = '0.1.0';
