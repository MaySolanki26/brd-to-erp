import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

export type DbClient = Prisma.TransactionClient;

/** Unit of work for multi-table writes; repositories receive the transaction client. */
export function withTransaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}
