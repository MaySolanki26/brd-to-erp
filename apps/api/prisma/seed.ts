import { createHash } from 'node:crypto';
import { PrismaClient, type KnowledgeStatus, type ProjectRole } from '@prisma/client';
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

interface SeedScope {
  organizationId: string;
  projectId: string;
  createdById: string;
}

interface SeedChunk {
  headingPath: string[];
  content: string;
  needsReview?: boolean;
}

const sha = (text: string): string => createHash('sha256').update(text).digest('hex');

/** Chunks are keyed by a fixed string, so re-running the seed updates them in place. */
async function seedChunks(
  scope: SeedScope,
  keyPrefix: string,
  source: { documentVersionId: string } | { contextNoteId: string },
  chunks: SeedChunk[],
): Promise<string[]> {
  const ids: string[] = [];
  for (const [index, chunk] of chunks.entries()) {
    const data = {
      content: chunk.content,
      chunkIndex: index,
      contentHash: sha(chunk.content),
      headingPath: chunk.headingPath,
      needsReview: chunk.needsReview ?? false,
      projectId: scope.projectId,
      organizationId: scope.organizationId,
      ...source,
    };
    const saved = await prisma.chunk.upsert({
      where: { chunkKey: `${keyPrefix}:${String(index)}` },
      update: data,
      create: { ...data, chunkKey: `${keyPrefix}:${String(index)}` },
      select: { id: true },
    });
    ids.push(saved.id);
  }
  return ids;
}

async function seedNote(scope: SeedScope, title: string, chunks: SeedChunk[]): Promise<string[]> {
  const body = chunks.map((c) => c.content).join('\n\n');
  const existing = await prisma.contextNote.findFirst({
    where: { projectId: scope.projectId, title },
    select: { id: true },
  });
  const note =
    existing ??
    (await prisma.contextNote.create({
      data: { ...scope, title, body, status: 'PROCESSED' },
      select: { id: true },
    }));
  return seedChunks(scope, `seed:note:${note.id}`, { contextNoteId: note.id }, chunks);
}

/** The stored file does not exist, so downloading the seeded document returns 404. */
async function seedDocument(
  scope: SeedScope,
  title: string,
  chunks: SeedChunk[],
): Promise<string[]> {
  const fileName = `${title.toLowerCase().replace(/\s+/g, '-')}.pdf`;
  const existing = await prisma.document.findFirst({
    where: { projectId: scope.projectId, fileName, deletedAt: null },
    select: { id: true, versions: { select: { id: true }, take: 1 } },
  });
  let versionId = existing?.versions[0]?.id;
  if (!existing) {
    const created = await prisma.document.create({
      data: {
        ...scope,
        title,
        fileName,
        mimeType: 'application/pdf',
        status: 'PROCESSED',
        versions: {
          create: {
            versionNumber: 1,
            fileKey: crypto.randomUUID(),
            contentHash: sha(title),
            mimeType: 'application/pdf',
            sizeBytes: 1024,
            organizationId: scope.organizationId,
            createdById: scope.createdById,
          },
        },
      },
      select: { versions: { select: { id: true } } },
    });
    versionId = created.versions[0]?.id;
  }
  if (!versionId) throw new Error(`Seeded document "${title}" has no version`);
  return seedChunks(scope, `seed:doc:${versionId}`, { documentVersionId: versionId }, chunks);
}

interface SeedItem {
  title: string;
  description: string;
  status: KnowledgeStatus;
  chunk: number;
  moduleCode?: string;
  priority?: number;
  /** Set to attribute the item to a person instead of the extraction pipeline. */
  byPerson?: boolean;
}

async function seedModule(
  scope: SeedScope,
  chunkId: string,
  code: string,
  name: string,
  status: KnowledgeStatus,
): Promise<string> {
  const data = { name, status, sourceChunkId: chunkId, organizationId: scope.organizationId };
  const saved = await prisma.module.upsert({
    where: { projectId_code: { projectId: scope.projectId, code } },
    update: data,
    create: { ...data, code, projectId: scope.projectId },
    select: { id: true },
  });
  return saved.id;
}

async function seedRequirements(
  scope: SeedScope,
  chunkIds: string[],
  modules: Map<string, string>,
  items: SeedItem[],
): Promise<void> {
  for (const item of items) {
    const data = {
      description: item.description,
      status: item.status,
      priority: item.priority ?? null,
      sourceChunkId: chunkIds[item.chunk] as string,
      moduleId: item.moduleCode ? (modules.get(item.moduleCode) ?? null) : null,
      createdById: item.byPerson ? scope.createdById : null,
    };
    const existing = await prisma.requirement.findFirst({
      where: { projectId: scope.projectId, title: item.title },
      select: { id: true },
    });
    if (existing) {
      await prisma.requirement.update({ where: { id: existing.id }, data });
    } else {
      await prisma.requirement.create({
        data: {
          ...data,
          title: item.title,
          projectId: scope.projectId,
          organizationId: scope.organizationId,
        },
      });
    }
  }
}

async function seedRules(
  scope: SeedScope,
  chunkIds: string[],
  modules: Map<string, string>,
  items: SeedItem[],
): Promise<void> {
  for (const item of items) {
    const data = {
      description: item.description,
      status: item.status,
      sourceChunkId: chunkIds[item.chunk] as string,
      moduleId: item.moduleCode ? (modules.get(item.moduleCode) ?? null) : null,
      createdById: item.byPerson ? scope.createdById : null,
    };
    const existing = await prisma.businessRule.findFirst({
      where: { projectId: scope.projectId, title: item.title },
      select: { id: true },
    });
    if (existing) {
      await prisma.businessRule.update({ where: { id: existing.id }, data });
    } else {
      await prisma.businessRule.create({
        data: {
          ...data,
          title: item.title,
          projectId: scope.projectId,
          organizationId: scope.organizationId,
        },
      });
    }
  }
}

/** Sample extraction results so the knowledge screens have data before the pipeline exists. */
async function seedKnowledge(
  organizationId: string,
  alpha: { id: string },
  beta: { id: string },
  aliceId: string,
  bobId: string,
): Promise<void> {
  const alphaScope: SeedScope = { organizationId, projectId: alpha.id, createdById: aliceId };
  const doc = await seedDocument(alphaScope, 'Billing BRD', [
    {
      headingPath: ['1. Scope', '1.1 Invoicing'],
      content:
        'The system shall generate an invoice for every active customer on the first day of each month.',
    },
    {
      headingPath: ['1. Scope', '1.2 Payments'],
      content:
        'Payments are accepted by card and bank transfer. Refunds are issued to the original method within 5 working days.',
    },
    {
      headingPath: ['2. Rules', '2.1 Tax'],
      content:
        'VAT of 20% applies to all invoices unless the customer holds a valid exemption certificate. [table could not be read reliably]',
      needsReview: true,
    },
  ]);
  const note = await seedNote(alphaScope, 'Kickoff call notes', [
    {
      headingPath: [],
      content:
        'Finance asked that overdue invoices trigger a reminder after 14 days. Approval above 10,000 needs two sign-offs.',
    },
  ]);

  const modules = new Map<string, string>([
    ['BIL', await seedModule(alphaScope, doc[0] as string, 'BIL', 'Billing', 'CONFIRMED')],
    ['PAY', await seedModule(alphaScope, doc[1] as string, 'PAY', 'Payments', 'ASSUMED')],
    [
      'APR',
      await seedModule(alphaScope, note[0] as string, 'APR', 'Approvals', 'NEEDS_REVALIDATION'),
    ],
  ]);
  const chunkIds = [...doc, ...note];

  await seedRequirements(alphaScope, chunkIds, modules, [
    {
      title: 'Monthly invoice run',
      description: 'Generate an invoice for every active customer on the first day of each month.',
      status: 'CONFIRMED',
      chunk: 0,
      moduleCode: 'BIL',
      priority: 1,
    },
    {
      title: 'Card and bank payments',
      description: 'Accept payments by card and by bank transfer.',
      status: 'CONFIRMED',
      chunk: 1,
      moduleCode: 'PAY',
      priority: 1,
    },
    {
      title: 'Refund to original method',
      description: 'Refunds go back to the original payment method within 5 working days.',
      status: 'ASSUMED',
      chunk: 1,
      moduleCode: 'PAY',
      priority: 2,
    },
    {
      title: 'Overdue reminders',
      description: 'Send a reminder when an invoice is overdue by 14 days.',
      status: 'OPEN',
      chunk: 3,
      moduleCode: 'BIL',
      priority: 2,
      byPerson: true,
    },
    {
      title: 'Two-step approval',
      description: 'Amounts above 10,000 need two sign-offs.',
      status: 'NEEDS_REVALIDATION',
      chunk: 3,
      moduleCode: 'APR',
      priority: 1,
    },
    {
      title: 'Invoice PDF export',
      description: 'Export any invoice as a PDF.',
      status: 'REJECTED',
      chunk: 0,
      moduleCode: 'BIL',
    },
  ]);
  await seedRules(alphaScope, chunkIds, modules, [
    {
      title: 'VAT rate',
      description: 'VAT of 20% applies unless the customer has a valid exemption certificate.',
      status: 'OPEN',
      chunk: 2,
      moduleCode: 'BIL',
    },
    {
      title: 'Refund window',
      description: 'Refunds are issued within 5 working days.',
      status: 'CONFIRMED',
      chunk: 1,
      moduleCode: 'PAY',
    },
    {
      title: 'Reminder delay',
      description: 'Overdue reminders go out after 14 days.',
      status: 'NEEDS_REVALIDATION',
      chunk: 3,
      moduleCode: 'BIL',
    },
  ]);

  const betaScope: SeedScope = { organizationId, projectId: beta.id, createdById: bobId };
  const betaNote = await seedNote(betaScope, 'Warehouse walkthrough', [
    {
      headingPath: [],
      content:
        'Stock is counted every Friday. Items below the reorder level are flagged automatically.',
    },
  ]);
  const betaModules = new Map<string, string>([
    ['INV', await seedModule(betaScope, betaNote[0] as string, 'INV', 'Inventory', 'OPEN')],
  ]);
  await seedRequirements(betaScope, betaNote, betaModules, [
    {
      title: 'Weekly stock count',
      description: 'Stock is counted every Friday.',
      status: 'CONFIRMED',
      chunk: 0,
      moduleCode: 'INV',
    },
    {
      title: 'Reorder alerts',
      description: 'Flag items below the reorder level.',
      status: 'ASSUMED',
      chunk: 0,
      moduleCode: 'INV',
    },
  ]);
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

  await seedKnowledge(org.id, projectA, projectB, alice.id, bob.id);

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
