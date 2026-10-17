import { prisma } from '../../lib/prisma.js';

const VERSION_LIMIT = 100;

export interface SummaryRecord {
  version: number;
  generatedAt: Date;
  /** Written by the refresh-summary job; validated when read. */
  content: unknown;
  basedOn: unknown;
}

export async function listVersions(
  organizationId: string,
  projectId: string,
): Promise<{ version: number; generatedAt: Date }[]> {
  return prisma.projectSummary.findMany({
    where: { organizationId, projectId },
    select: { version: true, generatedAt: true },
    orderBy: { version: 'desc' },
    take: VERSION_LIMIT,
  });
}

/** The requested version, or the newest when none is given. */
export async function findSummary(
  organizationId: string,
  projectId: string,
  version?: number,
): Promise<SummaryRecord | null> {
  return prisma.projectSummary.findFirst({
    where: { organizationId, projectId, ...(version !== undefined && { version }) },
    select: { version: true, generatedAt: true, content: true, basedOn: true },
    orderBy: { version: 'desc' },
  });
}

export interface ItemIds {
  requirements: string[];
  rules: string[];
  modules: string[];
}

/** Current titles for the items a summary mentions, keyed `kind:id`. Deleted items are absent. */
export async function findItemTitles(
  organizationId: string,
  projectId: string,
  ids: ItemIds,
): Promise<Map<string, string>> {
  const scope = { organizationId, projectId };
  const [requirements, rules, modules] = await Promise.all([
    ids.requirements.length === 0
      ? []
      : prisma.requirement.findMany({
          where: { ...scope, id: { in: ids.requirements }, deletedAt: null },
          select: { id: true, title: true },
        }),
    ids.rules.length === 0
      ? []
      : prisma.businessRule.findMany({
          where: { ...scope, id: { in: ids.rules } },
          select: { id: true, title: true },
        }),
    ids.modules.length === 0
      ? []
      : prisma.module.findMany({
          where: { ...scope, id: { in: ids.modules } },
          select: { id: true, name: true },
        }),
  ]);

  const titles = new Map<string, string>();
  for (const r of requirements) titles.set(`requirement:${r.id}`, r.title);
  for (const r of rules) titles.set(`rule:${r.id}`, r.title);
  for (const m of modules) titles.set(`module:${m.id}`, m.name);
  return titles;
}
