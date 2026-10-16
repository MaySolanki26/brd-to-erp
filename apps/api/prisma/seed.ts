import { PrismaClient, type ProjectRole } from '@prisma/client';
import { hashPassword } from '../src/lib/password.js';

const prisma = new PrismaClient();

// Development-only credentials for manual testing.
const DEV_PASSWORD = 'Passw0rd!dev';

async function upsertUser(
  organizationId: string,
  email: string,
  name: string,
  orgRole: 'ORG_ADMIN' | 'MEMBER',
  passwordHash: string,
): Promise<{ id: string }> {
  return prisma.user.upsert({
    where: { email },
    update: { passwordHash, orgRole, failedLoginCount: 0, lockedUntil: null, deletedAt: null },
    create: { email, name, passwordHash, organizationId, orgRole },
    select: { id: true },
  });
}

async function ensureProject(
  organizationId: string,
  name: string,
  description: string,
): Promise<{ id: string }> {
  const existing = await prisma.project.findFirst({
    where: { organizationId, name },
    select: { id: true },
  });
  if (existing) return existing;
  return prisma.project.create({
    data: { organizationId, name, description, status: 'ACTIVE' },
    select: { id: true },
  });
}

async function setMember(
  organizationId: string,
  projectId: string,
  userId: string,
  role: ProjectRole,
): Promise<void> {
  await prisma.projectMember.upsert({
    where: { userId_projectId: { userId, projectId } },
    update: { role },
    create: { organizationId, projectId, userId, role },
  });
}

async function main(): Promise<void> {
  if (process.env['APP_ENV'] === 'production') {
    throw new Error('Refusing to seed development credentials in production');
  }

  const org = await prisma.organization.upsert({
    where: { slug: 'brd-platform' },
    update: {},
    create: { name: 'BRD Platform', slug: 'brd-platform' },
  });

  const passwordHash = await hashPassword(DEV_PASSWORD);
  const admin = await upsertUser(org.id, 'admin@brd.local', 'Admin', 'ORG_ADMIN', passwordHash);
  const alice = await upsertUser(org.id, 'alice@brd.local', 'Alice Member', 'MEMBER', passwordHash);
  const bob = await upsertUser(org.id, 'bob@brd.local', 'Bob Member', 'MEMBER', passwordHash);

  const projectA = await ensureProject(org.id, 'Project Alpha', 'Alice owns, Bob views');
  const projectB = await ensureProject(org.id, 'Project Beta', 'Bob owns, Alice analyses');

  await setMember(org.id, projectA.id, alice.id, 'OWNER');
  await setMember(org.id, projectA.id, bob.id, 'VIEWER');
  await setMember(org.id, projectB.id, bob.id, 'OWNER');
  await setMember(org.id, projectB.id, alice.id, 'ANALYST');

  console.log(`Seeded org "${org.name}" with admin ${admin.id}, 2 members and 2 projects.`);
  console.log(
    `Dev users: admin@brd.local, alice@brd.local, bob@brd.local — password: ${DEV_PASSWORD}`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e: unknown) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
