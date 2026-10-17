import { prisma } from '../../lib/prisma.js';

export interface DecisionRecord {
  id: string;
  summary: string;
  /** Stored by the apply-answer job; validated when read. */
  changes: unknown;
  conflicts: unknown;
  createdAt: Date;
  decidedBy: { id: string; name: string };
  question: { id: string; content: string };
  answer: { content: string };
}

/** Newest first; the id breaks ties so pages never overlap. */
export async function listDecisions(params: {
  organizationId: string;
  projectId: string;
  page: number;
  pageSize: number;
}): Promise<{ items: DecisionRecord[]; total: number }> {
  const where = { organizationId: params.organizationId, projectId: params.projectId };
  const [items, total] = await Promise.all([
    prisma.decision.findMany({
      where,
      select: {
        id: true,
        summary: true,
        changes: true,
        conflicts: true,
        createdAt: true,
        decidedBy: { select: { id: true, name: true } },
        question: { select: { id: true, content: true } },
        answer: { select: { content: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.decision.count({ where }),
  ]);
  return { items, total };
}
