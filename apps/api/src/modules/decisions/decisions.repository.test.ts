import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({ decision: { findMany: vi.fn(), count: vi.fn() } }));
vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));

import { listDecisions } from './decisions.repository.js';

describe('decisions.repository', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prismaMock.decision.findMany.mockResolvedValue([]);
    prismaMock.decision.count.mockResolvedValue(0);
  });

  it('scopes by organization and project, newest first with a stable tie-break', async () => {
    await listDecisions({ organizationId: 'o1', projectId: 'p1', page: 2, pageSize: 10 });
    expect(prismaMock.decision.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { organizationId: 'o1', projectId: 'p1' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 10,
      take: 10,
    });
    expect(prismaMock.decision.count.mock.calls[0]?.[0].where).toEqual({
      organizationId: 'o1',
      projectId: 'p1',
    });
  });

  it('selects the person by id and name only', async () => {
    await listDecisions({ organizationId: 'o1', projectId: 'p1', page: 1, pageSize: 10 });
    const select = prismaMock.decision.findMany.mock.calls[0]?.[0].select;
    expect(select.decidedBy).toEqual({ select: { id: true, name: true } });
    expect(JSON.stringify(select)).not.toMatch(/passwordHash|email/);
  });
});
