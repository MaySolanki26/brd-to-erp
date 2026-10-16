import { prisma } from '../../lib/prisma.js';

const userWithRole = {
  id: true,
  email: true,
  name: true,
  passwordHash: true,
  organizationId: true,
  deletedAt: true,
  role: { select: { id: true, name: true } },
} as const;

export type UserWithRole = NonNullable<Awaited<ReturnType<typeof findUserByEmail>>>;

export async function findUserByEmail(email: string) {
  return prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: userWithRole,
  });
}

export async function findUserById(id: string) {
  return prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: userWithRole,
  });
}
