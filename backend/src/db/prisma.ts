import { PrismaClient } from '@prisma/client';

/**
 * Shared PrismaClient for HTTP API, workers, and publishers.
 * Prefer this over `new PrismaClient()` per module to reduce connection churn.
 */
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
