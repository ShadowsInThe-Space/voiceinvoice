/**
 * Prisma Client Instance
 *
 * Singleton instance of the Prisma Client for database access.
 *
 * @module services/prisma
 */

import { PrismaClient } from '../../generated/client';

export const prisma = new PrismaClient();
