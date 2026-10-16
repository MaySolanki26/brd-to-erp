import type { OrgRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { DbClient } from '../../lib/transaction.js';

export interface OrgUserRecord {
  id: string;
  email: string;
  name: string;
  orgRole: OrgRole;
  mustChangePassword: boolean;
  deletedAt: Date | null;
  createdAt: Date;
}

// Never select passwordHash here: these records are mapped straight to API responses.
const orgUserSelect = {
  id: true,
  email: true,
  name: true,
  orgRole: true,
  mustChangePassword: true,
  deletedAt: true,
  createdAt: true,
} as const;

export async function listUsers(organizationId: string): Promise<OrgUserRecord[]> {
  return prisma.user.findMany({
    where: { organizationId },
    select: orgUserSelect,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
}

/** Finds a user in the organization, including deactivated ones. */
export async function findUser(
  organizationId: string,
  userId: string,
  db: DbClient = prisma,
): Promise<OrgUserRecord | null> {
  return db.user.findFirst({ where: { id: userId, organizationId }, select: orgUserSelect });
}

/** Emails are unique across all organizations and deactivated users keep theirs. */
export async function emailTaken(email: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  return user !== null;
}

export async function createUser(
  data: {
    organizationId: string;
    email: string;
    name: string;
    orgRole: OrgRole;
    passwordHash: string;
  },
  db: DbClient,
): Promise<OrgUserRecord> {
  return db.user.create({
    data: { ...data, mustChangePassword: true },
    select: orgUserSelect,
  });
}

export async function updateUser(
  userId: string,
  data: { orgRole?: OrgRole; deletedAt?: Date | null },
  db: DbClient,
): Promise<OrgUserRecord> {
  return db.user.update({ where: { id: userId }, data, select: orgUserSelect });
}

export async function countActiveAdmins(organizationId: string, db: DbClient): Promise<number> {
  return db.user.count({ where: { organizationId, orgRole: 'ORG_ADMIN', deletedAt: null } });
}
