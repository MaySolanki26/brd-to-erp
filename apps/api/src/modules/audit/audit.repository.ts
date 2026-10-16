import type { AuditAction, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { DbClient } from '../../lib/transaction.js';

export interface AuditEntry {
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  userId?: string | null;
  organizationId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export async function createAuditLog(entry: AuditEntry, db: DbClient = prisma): Promise<void> {
  await db.auditLog.create({
    data: {
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      userId: entry.userId ?? null,
      organizationId: entry.organizationId ?? null,
      metadata: entry.metadata,
    },
  });
}
