import { createHash } from 'node:crypto';
import type { KnowledgeStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { DbClient } from '../../lib/transaction.js';
import { normalize } from './extraction.plan.js';
import {
  REPLACEABLE_STATUSES,
  type Drafts,
  type ExistingItem,
  type ExtractedKind,
  type ExtractionPlan,
} from './extraction.types.js';

export interface ChunkToExtract {
  id: string;
  content: string;
  headingPath: string[];
  /** The newest version of its document, or a note: only these are worth extracting. */
  current: boolean;
}

/** Null when the chunk is not in this organization and project, so a forged id reads as missing. */
export async function findChunk(
  organizationId: string,
  projectId: string,
  chunkId: string,
): Promise<ChunkToExtract | null> {
  const chunk = await prisma.chunk.findFirst({
    where: { id: chunkId, organizationId, projectId },
    select: {
      id: true,
      content: true,
      headingPath: true,
      documentVersion: {
        select: {
          versionNumber: true,
          document: {
            select: {
              versions: {
                select: { versionNumber: true },
                orderBy: { versionNumber: 'desc' },
                take: 1,
              },
            },
          },
        },
      },
    },
  });
  if (!chunk) return null;
  const newest = chunk.documentVersion?.document.versions[0]?.versionNumber;
  return {
    id: chunk.id,
    content: chunk.content,
    headingPath: chunk.headingPath,
    current: chunk.documentVersion === null || chunk.documentVersion.versionNumber === newest,
  };
}

/**
 * Serializes extraction writes for one project. Two chunks stating the same requirement would
 * otherwise both look for it, find nothing, and both create it. Released when the transaction ends.
 */
export async function lockProject(db: DbClient, projectId: string): Promise<void> {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`extract:${projectId}`}))`;
}

type Scope = { organizationId: string; projectId: string };

const SOURCE_ORDER = { createdAt: 'asc' } as const;

function titles(drafts: Drafts, kind: 'requirement' | 'rule'): string[] {
  return (kind === 'requirement' ? drafts.requirements : drafts.rules).map((d) => d.title);
}

const sameText = (text: string) => ({ equals: normalize(text), mode: 'insensitive' as const });

/** Everything the planner needs: items the drafts may match, plus every item this chunk owns or links. */
export async function loadExisting(
  db: DbClient,
  scope: Scope,
  chunkId: string,
  drafts: Drafts,
): Promise<Record<ExtractedKind, ExistingItem[]>> {
  const here = { OR: [{ sourceChunkId: chunkId }, { extraSources: { some: { chunkId } } }] };
  const links = {
    select: { chunkId: true },
    orderBy: SOURCE_ORDER,
  } as const;

  const matching = (kind: 'requirement' | 'rule') =>
    titles(drafts, kind).length > 0
      ? [{ OR: titles(drafts, kind).map((title) => ({ title: sameText(title) })) }]
      : [];

  const [modules, requirements, rules] = await Promise.all([
    db.module.findMany({
      where: {
        ...scope,
        OR: [
          here,
          ...(drafts.modules.length > 0
            ? [{ OR: drafts.modules.map((m) => ({ name: sameText(m.name) })) }]
            : []),
        ],
      },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        createdById: true,
        sourceChunkId: true,
        extraSources: links,
      },
    }),
    db.requirement.findMany({
      where: { ...scope, deletedAt: null, OR: [here, ...matching('requirement')] },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        createdById: true,
        moduleId: true,
        sourceChunkId: true,
        extraSources: links,
      },
    }),
    db.businessRule.findMany({
      where: { ...scope, OR: [here, ...matching('rule')] },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        createdById: true,
        moduleId: true,
        sourceChunkId: true,
        extraSources: links,
      },
    }),
  ]);

  const build = <
    T extends {
      id: string;
      description: string | null;
      status: KnowledgeStatus;
      createdById: string | null;
      sourceChunkId: string;
      extraSources: { chunkId: string }[];
    },
  >(
    kind: ExtractedKind,
    rows: T[],
    titleOf: (row: T) => string,
    moduleOf: (row: T) => string | null,
  ): ExistingItem[] =>
    rows.map((row) => ({
      kind,
      id: row.id,
      title: titleOf(row),
      description: row.description,
      status: row.status,
      createdById: row.createdById,
      moduleId: moduleOf(row),
      ownedHere: row.sourceChunkId === chunkId,
      linkedHere: row.extraSources.some((s) => s.chunkId === chunkId),
      otherSourceChunkIds: row.extraSources.map((s) => s.chunkId).filter((id) => id !== chunkId),
    }));

  return {
    module: build(
      'module',
      modules,
      (m) => m.name,
      () => null,
    ),
    requirement: build(
      'requirement',
      requirements,
      (r) => r.title,
      (r) => r.moduleId,
    ),
    rule: build(
      'rule',
      rules,
      (r) => r.title,
      (r) => r.moduleId,
    ),
  };
}

function moduleCode(name: string, taken: Set<string>): string {
  const base =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30) || createHash('sha256').update(name).digest('hex').slice(0, 8).toUpperCase();
  let code = base;
  for (let n = 2; taken.has(code); n += 1) code = `${base}-${String(n)}`;
  taken.add(code);
  return code;
}

export interface AppliedCounts {
  created: number;
  linked: number;
  updated: number;
  removed: number;
}

async function removeItem(
  db: DbClient,
  scope: Scope,
  chunkId: string,
  removal: ExtractionPlan['remove'][number],
): Promise<boolean> {
  if (removal.repointTo !== null) {
    const data = { sourceChunkId: removal.repointTo };
    const where = {
      id: removal.id,
      ...scope,
      sourceChunkId: chunkId,
      createdById: null,
      status: { in: [...REPLACEABLE_STATUSES] },
    };
    const moved =
      removal.kind === 'module'
        ? await db.module.updateMany({ where, data })
        : removal.kind === 'requirement'
          ? await db.requirement.updateMany({ where, data })
          : await db.businessRule.updateMany({ where, data });
    if (moved.count === 0) return false;
    const link = { chunkId: removal.repointTo, organizationId: scope.organizationId };
    await db.itemSource.deleteMany({
      where: {
        ...link,
        ...(removal.kind === 'module' ? { moduleId: removal.id } : {}),
        ...(removal.kind === 'requirement' ? { requirementId: removal.id } : {}),
        ...(removal.kind === 'rule' ? { ruleId: removal.id } : {}),
      },
    });
    return true;
  }

  const where = {
    id: removal.id,
    ...scope,
    sourceChunkId: chunkId,
    createdById: null,
    status: { in: [...REPLACEABLE_STATUSES] },
  };
  const deleted =
    removal.kind === 'module'
      ? // A module still used by an item stays, whoever made it.
        await db.module.deleteMany({
          where: { ...where, requirements: { none: {} }, businessRules: { none: {} } },
        })
      : removal.kind === 'requirement'
        ? await db.requirement.deleteMany({ where })
        : await db.businessRule.deleteMany({ where });
  return deleted.count > 0;
}

/** Writes the plan. Call inside the transaction that holds the project lock. */
export async function applyPlan(
  db: DbClient,
  scope: Scope,
  chunkId: string,
  plan: ExtractionPlan,
): Promise<AppliedCounts> {
  const counts: AppliedCounts = { created: 0, linked: 0, updated: 0, removed: 0 };
  const itemFor = (kind: ExtractedKind, id: string) => ({
    ...(kind === 'module' ? { moduleId: id } : {}),
    ...(kind === 'requirement' ? { requirementId: id } : {}),
    ...(kind === 'rule' ? { ruleId: id } : {}),
  });

  const modules = await db.module.findMany({
    where: scope,
    select: { id: true, name: true, code: true },
  });
  const takenCodes = new Set(modules.map((m) => m.code));
  const moduleIds = new Map(modules.map((m) => [normalize(m.name), m.id]));

  for (const create of plan.create.filter((c) => c.kind === 'module')) {
    const created = await db.module.create({
      data: {
        ...scope,
        name: create.title,
        code: moduleCode(create.title, takenCodes),
        description: create.description || null,
        sourceChunkId: chunkId,
        createdById: null,
      },
      select: { id: true },
    });
    moduleIds.set(normalize(create.title), created.id);
    counts.created += 1;
  }

  const moduleIdFor = (name: string | null): string | null =>
    name === null ? null : (moduleIds.get(normalize(name)) ?? null);

  for (const create of plan.create.filter((c) => c.kind === 'requirement')) {
    await db.requirement.create({
      data: {
        ...scope,
        title: create.title,
        description: create.description,
        moduleId: moduleIdFor(create.moduleName),
        sourceChunkId: chunkId,
        createdById: null,
      },
    });
    counts.created += 1;
  }
  for (const create of plan.create.filter((c) => c.kind === 'rule')) {
    await db.businessRule.create({
      data: {
        ...scope,
        title: create.title,
        description: create.description,
        moduleId: moduleIdFor(create.moduleName),
        sourceChunkId: chunkId,
        createdById: null,
      },
    });
    counts.created += 1;
  }

  for (const update of plan.update) {
    const data: { description?: string; moduleId?: string } = {};
    if (update.description !== undefined) data.description = update.description;
    const moduleId = moduleIdFor(update.moduleName ?? null);
    if (moduleId !== null && update.kind !== 'module') data.moduleId = moduleId;
    if (Object.keys(data).length === 0) continue;
    const where = { id: update.id, ...scope };
    if (update.kind === 'module')
      await db.module.updateMany({ where, data: { description: data.description } });
    else if (update.kind === 'requirement') await db.requirement.updateMany({ where, data });
    else await db.businessRule.updateMany({ where, data });
    counts.updated += 1;
  }

  if (plan.link.length > 0) {
    await db.itemSource.createMany({
      data: plan.link.map((link) => ({
        chunkId,
        organizationId: scope.organizationId,
        ...itemFor(link.kind, link.id),
      })),
      skipDuplicates: true,
    });
    counts.linked += plan.link.length;
  }

  for (const removal of plan.remove) {
    if (await removeItem(db, scope, chunkId, removal)) counts.removed += 1;
  }

  // The new text states these items again, so they leave the stale state; a person still reviews them.
  for (const item of plan.revalidate) {
    const where = { id: item.id, ...scope, status: 'NEEDS_REVALIDATION' as const };
    const data = { status: 'OPEN' as const };
    if (item.kind === 'module') await db.module.updateMany({ where, data });
    else if (item.kind === 'requirement') await db.requirement.updateMany({ where, data });
    else await db.businessRule.updateMany({ where, data });
    counts.updated += 1;
  }

  for (const unlink of plan.unlink) {
    await db.itemSource.deleteMany({
      where: { chunkId, organizationId: scope.organizationId, ...itemFor(unlink.kind, unlink.id) },
    });
  }
  return counts;
}

/** Records that extraction is done with this chunk, and whether a person must look at it. */
export async function markExtracted(
  db: DbClient,
  scope: Scope,
  chunkId: string,
  needsReview: boolean,
): Promise<void> {
  await db.chunk.updateMany({
    where: { id: chunkId, ...scope },
    data: { extractedAt: new Date(), needsReview },
  });
}

/**
 * When the chunk was the last of its source to be extracted, the source is processed. Returns true
 * only for the call that finishes it. A document that has a newer version is left alone.
 */
export async function finishSourceIfDone(
  db: DbClient,
  scope: Scope,
  chunkId: string,
): Promise<boolean> {
  const chunk = await db.chunk.findFirst({
    where: { id: chunkId, ...scope },
    select: {
      documentVersionId: true,
      contextNoteId: true,
      documentVersion: { select: { documentId: true, versionNumber: true } },
    },
  });
  if (!chunk) return false;

  const siblings: Prisma.ChunkWhereInput = chunk.documentVersionId
    ? { documentVersionId: chunk.documentVersionId }
    : { contextNoteId: chunk.contextNoteId };
  if ((await db.chunk.count({ where: { ...scope, ...siblings, extractedAt: null } })) > 0) {
    return false;
  }

  if (chunk.documentVersion) {
    const done = await db.document.updateMany({
      where: {
        id: chunk.documentVersion.documentId,
        ...scope,
        status: 'PROCESSING',
        versions: { none: { versionNumber: { gt: chunk.documentVersion.versionNumber } } },
      },
      data: { status: 'PROCESSED', errorMessage: null },
    });
    return done.count === 1;
  }
  if (chunk.contextNoteId) {
    const done = await db.contextNote.updateMany({
      where: { id: chunk.contextNoteId, ...scope, status: 'PROCESSING' },
      data: { status: 'PROCESSED', errorMessage: null },
    });
    return done.count === 1;
  }
  return false;
}

/**
 * Gets a chunk that is about to disappear out of the way of the items stated in it. Unconfirmed items
 * made by the pipeline are deleted, or moved to another chunk that also states them; confirmed,
 * flagged and person-made items stay. Returns true when nothing references the chunk any more.
 */
export async function releaseChunkItems(
  db: DbClient,
  scope: Scope,
  chunkId: string,
): Promise<boolean> {
  const owned = { ...scope, sourceChunkId: chunkId };
  const replaceable = { createdById: null, status: { in: [...REPLACEABLE_STATUSES] } };
  const firstOther = {
    select: {
      id: true,
      extraSources: { select: { chunkId: true }, orderBy: SOURCE_ORDER, take: 1 },
    },
  } as const;

  const [modules, requirements, rules] = await Promise.all([
    db.module.findMany({ where: { ...owned, ...replaceable }, ...firstOther }),
    db.requirement.findMany({ where: { ...owned, ...replaceable }, ...firstOther }),
    db.businessRule.findMany({ where: { ...owned, ...replaceable }, ...firstOther }),
  ]);
  const removals: [ExtractedKind, typeof modules][] = [
    ['requirement', requirements],
    ['rule', rules],
    ['module', modules],
  ];
  for (const [kind, rows] of removals) {
    for (const row of rows) {
      await removeItem(db, scope, chunkId, {
        kind,
        id: row.id,
        repointTo: row.extraSources[0]?.chunkId ?? null,
      });
    }
  }

  const remaining = await Promise.all([
    db.module.count({ where: owned }),
    db.requirement.count({ where: owned }),
    db.businessRule.count({ where: owned }),
  ]);
  return remaining.every((count) => count === 0);
}

/**
 * A new version of a document replaces the old text: everything found in earlier versions must be
 * checked against it by a person, unless it was already rejected.
 */
export async function markOlderVersionItems(
  db: DbClient,
  scope: Scope,
  documentId: string,
  versionNumber: number,
): Promise<void> {
  const where = {
    ...scope,
    status: { in: ['CONFIRMED', 'ASSUMED', 'OPEN'] as KnowledgeStatus[] },
    sourceChunk: { documentVersion: { documentId, versionNumber: { lt: versionNumber } } },
  };
  const data = { status: 'NEEDS_REVALIDATION' as const };
  await Promise.all([
    db.module.updateMany({ where, data }),
    db.requirement.updateMany({ where: { ...where, deletedAt: null }, data }),
    db.businessRule.updateMany({ where, data }),
  ]);
}

/**
 * Fails the source a chunk belongs to, so a person can reprocess it once the cause is fixed.
 * Only a source that is still processing is touched.
 */
export async function failSourceOfChunk(
  db: DbClient,
  scope: Scope,
  chunkId: string,
  reason: string,
): Promise<void> {
  const chunk = await db.chunk.findFirst({
    where: { id: chunkId, ...scope },
    select: { documentVersion: { select: { documentId: true } }, contextNoteId: true },
  });
  if (!chunk) return;
  const data = { status: 'FAILED' as const, errorMessage: reason };
  if (chunk.documentVersion) {
    await db.document.updateMany({
      where: { id: chunk.documentVersion.documentId, ...scope, status: 'PROCESSING' },
      data,
    });
  } else if (chunk.contextNoteId) {
    await db.contextNote.updateMany({
      where: { id: chunk.contextNoteId, ...scope, status: 'PROCESSING' },
      data,
    });
  }
}

export type ExtractionRepository = {
  findChunk: typeof findChunk;
  lockProject: typeof lockProject;
  loadExisting: typeof loadExisting;
  applyPlan: typeof applyPlan;
  markExtracted: typeof markExtracted;
  finishSourceIfDone: typeof finishSourceIfDone;
  failSourceOfChunk: typeof failSourceOfChunk;
};
