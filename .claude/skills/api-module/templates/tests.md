# Tests and the fake repository

> Every file below was compiled, linted and tested in a scratch copy of this repository (2026-10-17). Copy it, then rename. Paths are relative to the repository root.

### `apps/api/src/test/fake-milestones.ts`

```ts
import { randomUUID } from 'node:crypto';
import { db } from './fake-db.js';

interface FakeMilestone {
  id: string;
  title: string;
  dueDate: Date | null;
  status: 'PLANNED' | 'DONE';
  projectId: string;
  organizationId: string;
  createdById: string;
  createdAt: Date;
}

const milestones = new Map<string, FakeMilestone>();

/** Call in `beforeEach`, next to `buildWorld()`. */
export function resetMilestones(): void {
  milestones.clear();
}

export function milestoneCount(): number {
  return milestones.size;
}

function toRecord(m: FakeMilestone) {
  const creator = db.users.get(m.createdById);
  return {
    id: m.id,
    title: m.title,
    dueDate: m.dueDate,
    status: m.status,
    createdAt: m.createdAt,
    createdBy: { id: m.createdById, name: creator?.name ?? '' },
  };
}

/** Same rules as the real repository: scoped by organization and project, soonest due first. */
export const milestonesRepositoryModule = {
  listMilestones: async (p: {
    organizationId: string;
    projectId: string;
    page: number;
    pageSize: number;
  }) => {
    const all = [...milestones.values()]
      .filter((m) => m.organizationId === p.organizationId && m.projectId === p.projectId)
      .sort(
        (a, b) =>
          (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity) ||
          b.createdAt.getTime() - a.createdAt.getTime(),
      );
    const start = (p.page - 1) * p.pageSize;
    return { items: all.slice(start, start + p.pageSize).map(toRecord), total: all.length };
  },
  createMilestone: async (data: {
    title: string;
    dueDate: Date | null;
    projectId: string;
    organizationId: string;
    createdById: string;
  }) => {
    const milestone: FakeMilestone = {
      id: randomUUID(),
      status: 'PLANNED',
      createdAt: new Date(),
      ...data,
    };
    milestones.set(milestone.id, milestone);
    return toRecord(milestone);
  },
};
```

### `apps/api/src/modules/milestones/milestones.repository.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  milestone: { findMany: vi.fn(), count: vi.fn() },
}));
vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));

import { createMilestone, listMilestones } from './milestones.repository.js';

describe('milestones.repository', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prismaMock.milestone.findMany.mockResolvedValue([]);
    prismaMock.milestone.count.mockResolvedValue(0);
  });

  it('scopes the list and the count by organization and project', async () => {
    await listMilestones({ organizationId: 'o1', projectId: 'p1', page: 1, pageSize: 20 });
    const scope = { organizationId: 'o1', projectId: 'p1' };
    expect(prismaMock.milestone.findMany.mock.calls[0]?.[0].where).toEqual(scope);
    expect(prismaMock.milestone.count.mock.calls[0]?.[0].where).toEqual(scope);
  });

  it('orders by due date with undated last, then pages with skip and take', async () => {
    await listMilestones({ organizationId: 'o1', projectId: 'p1', page: 3, pageSize: 10 });
    const args = prismaMock.milestone.findMany.mock.calls[0]?.[0];
    expect(args.orderBy).toEqual([
      { dueDate: { sort: 'asc', nulls: 'last' } },
      { createdAt: 'desc' },
      { id: 'asc' },
    ]);
    expect(args.skip).toBe(20);
    expect(args.take).toBe(10);
  });

  it('selects only the fields the DTO needs', async () => {
    await listMilestones({ organizationId: 'o1', projectId: 'p1', page: 1, pageSize: 20 });
    const select = prismaMock.milestone.findMany.mock.calls[0]?.[0].select;
    expect(Object.keys(select).sort()).toEqual(
      ['createdAt', 'createdBy', 'dueDate', 'id', 'status', 'title'].sort(),
    );
    expect(select.createdBy).toEqual({ select: { id: true, name: true } });
  });

  it('writes through the transaction client it is given', async () => {
    const tx = { milestone: { create: vi.fn().mockResolvedValue({ id: 'm1' }) } };
    const data = {
      title: 'Go live',
      dueDate: null,
      projectId: 'p1',
      organizationId: 'o1',
      createdById: 'u1',
    };
    await createMilestone(data, tx as never);
    expect(tx.milestone.create.mock.calls[0]?.[0].data).toEqual(data);
    expect(prismaMock.milestone).not.toHaveProperty('create');
  });
});
```

### `apps/api/src/modules/milestones/milestones.service.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserDto } from '@brd/shared';

vi.mock('../../lib/prisma.js', () => ({ prisma: {} }));
vi.mock(
  '../../lib/transaction.js',
  async () => (await import('../../test/fake-db.js')).transactionModule,
);
const repo = vi.hoisted(() => ({ listMilestones: vi.fn(), createMilestone: vi.fn() }));
vi.mock('./milestones.repository.js', () => repo);
const audit = vi.hoisted(() => ({ createAuditLog: vi.fn() }));
vi.mock('../audit/audit.repository.js', () => audit);

import { createMilestone, listMilestones, toMilestoneDto } from './milestones.service.js';

const user: UserDto = {
  id: 'u1',
  email: 'a@test.dev',
  name: 'Ann',
  organizationId: 'o1',
  orgRole: 'MEMBER',
  mustChangePassword: false,
  role: { id: 'MEMBER', name: 'MEMBER' },
};
const record = {
  id: 'm1',
  title: 'Go live',
  dueDate: new Date('2026-06-30T00:00:00.000Z'),
  status: 'PLANNED' as const,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  createdBy: { id: 'u1', name: 'Ann' },
};

describe('milestones.service', () => {
  beforeEach(() => vi.resetAllMocks());

  it('formats the due date as a calendar day and leaves undated milestones null', () => {
    expect(toMilestoneDto(record).dueDate).toBe('2026-06-30');
    expect(toMilestoneDto({ ...record, dueDate: null }).dueDate).toBeNull();
  });

  it('lists inside the caller organization and echoes the paging', async () => {
    repo.listMilestones.mockResolvedValue({ items: [record], total: 41 });
    const result = await listMilestones(user, 'p1', { page: 2, pageSize: 20 });
    expect(repo.listMilestones).toHaveBeenCalledWith({
      organizationId: 'o1',
      projectId: 'p1',
      page: 2,
      pageSize: 20,
    });
    expect(result).toMatchObject({ page: 2, pageSize: 20, total: 41 });
    expect(result.items[0]?.id).toBe('m1');
  });

  it('creates the milestone and its audit entry in one transaction', async () => {
    repo.createMilestone.mockResolvedValue(record);
    const dto = await createMilestone(user, 'p1', { title: 'Go live', dueDate: '2026-06-30' });

    expect(repo.createMilestone).toHaveBeenCalledWith(
      {
        title: 'Go live',
        dueDate: new Date('2026-06-30T00:00:00.000Z'),
        projectId: 'p1',
        organizationId: 'o1',
        createdById: 'u1',
      },
      expect.anything(),
    );
    expect(audit.createAuditLog).toHaveBeenCalledWith(
      {
        action: 'CREATE',
        entity: 'Milestone',
        entityId: 'm1',
        userId: 'u1',
        organizationId: 'o1',
        metadata: { projectId: 'p1' },
      },
      expect.anything(),
    );
    expect(dto.id).toBe('m1');
  });

  it('does not return a milestone when the audit entry cannot be written', async () => {
    repo.createMilestone.mockResolvedValue(record);
    audit.createAuditLog.mockRejectedValue(new Error('audit down'));
    await expect(createMilestone(user, 'p1', { title: 'x', dueDate: null })).rejects.toThrow(
      'audit down',
    );
  });
});
```

### `apps/api/src/modules/milestones/milestones.route.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../config/env.js', async () => (await import('../../test/test-env.js')).envModule);
vi.mock('../../lib/logger.js', async () => (await import('../../test/test-env.js')).loggerModule);
vi.mock('../../lib/prisma.js', () => ({ prisma: {} }));
vi.mock('pino-http', () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock(
  '../../lib/transaction.js',
  async () => (await import('../../test/fake-db.js')).transactionModule,
);
vi.mock(
  '../auth/auth.repository.js',
  async () => (await import('../../test/fake-db.js')).authRepositoryModule,
);
vi.mock(
  '../access/access.repository.js',
  async () => (await import('../../test/fake-db.js')).accessRepositoryModule,
);
vi.mock(
  '../projects/projects.repository.js',
  async () => (await import('../../test/fake-db.js')).projectsRepositoryModule,
);
vi.mock(
  '../members/members.repository.js',
  async () => (await import('../../test/fake-db.js')).membersRepositoryModule,
);
vi.mock(
  './milestones.repository.js',
  async () => (await import('../../test/fake-milestones.js')).milestonesRepositoryModule,
);
vi.mock(
  '../audit/audit.repository.js',
  async () => (await import('../../test/fake-db.js')).auditRepositoryModule,
);

import { createApp } from '../../app.js';
import { db } from '../../test/fake-db.js';
import { milestoneCount, resetMilestones } from '../../test/fake-milestones.js';
import { as, login, type Session } from '../../test/http.js';
import { PASSWORD, buildWorld, type World } from '../../test/world.js';

const app = createApp({ rateLimit: false });

describe('milestones routes', () => {
  let world: World;
  let owner: Session;

  const base = (projectId: string) => `/api/projects/${projectId}/milestones`;
  const milestone = { title: 'Go live', dueDate: '2026-06-30' };

  beforeEach(async () => {
    world = await buildWorld();
    resetMilestones();
    owner = await login(app, world.ownerA.email, PASSWORD);
  });

  it('requires authentication', async () => {
    expect((await request(app).get(base(world.p1.id))).status).toBe(401);
  });

  it('lets an owner create a milestone and records the audit entry', async () => {
    const res = await as(app, owner, 'post', base(world.p1.id)).send(milestone);
    expect(res.status).toBe(201);
    expect(res.body.milestone).toMatchObject({
      title: 'Go live',
      dueDate: '2026-06-30',
      status: 'PLANNED',
      createdBy: { id: world.ownerA.id },
    });
    expect(
      db.audit.some(
        (a) =>
          a.action === 'CREATE' &&
          a.entity === 'Milestone' &&
          a.entityId === res.body.milestone.id &&
          a.organizationId === world.orgA,
      ),
    ).toBe(true);
  });

  it('lets every role read but only roles that can update the project write', async () => {
    await as(app, owner, 'post', base(world.p1.id)).send(milestone);
    for (const user of [world.analystA, world.approverA, world.viewerA]) {
      const session = await login(app, user.email, PASSWORD);
      const list = await as(app, session, 'get', base(world.p1.id));
      expect(list.status).toBe(200);
      expect(list.body.items).toHaveLength(1);
      expect((await as(app, session, 'post', base(world.p1.id)).send(milestone)).status).toBe(403);
    }
  });

  it('lets an organization admin act on any project in their organization', async () => {
    const admin = await login(app, world.adminA.email, PASSWORD);
    expect((await as(app, admin, 'post', base(world.p2.id)).send(milestone)).status).toBe(201);
  });

  it('returns 404 to non-members and to other organizations, and writes nothing', async () => {
    for (const user of [world.outsiderA, world.adminB]) {
      const session = await login(app, user.email, PASSWORD);
      expect((await as(app, session, 'get', base(world.p1.id))).status).toBe(404);
      expect((await as(app, session, 'post', base(world.p1.id)).send(milestone)).status).toBe(404);
    }
    expect(milestoneCount()).toBe(0);
    expect(db.audit.filter((a) => a.entity === 'Milestone')).toHaveLength(0);
  });

  it('rejects bad input with 400 before anything is written', async () => {
    const send = (body: object) => as(app, owner, 'post', base(world.p1.id)).send(body);
    expect((await send({ title: '', dueDate: null })).status).toBe(400);
    expect((await send({ title: 'x', dueDate: '30/06/2026' })).status).toBe(400);
    expect((await send({ title: 'x', unexpected: true })).status).toBe(400);
    expect(milestoneCount()).toBe(0);
  });

  it('accepts a milestone without a date and lists undated ones last', async () => {
    await as(app, owner, 'post', base(world.p1.id)).send({ title: 'Later' });
    await as(app, owner, 'post', base(world.p1.id)).send({ title: 'Soon', dueDate: '2026-01-31' });
    const res = await as(app, owner, 'get', base(world.p1.id));
    expect(res.body.items.map((m: { title: string }) => m.title)).toEqual(['Soon', 'Later']);
  });

  it('pages the list and caps the page size', async () => {
    for (let i = 0; i < 3; i += 1) {
      await as(app, owner, 'post', base(world.p1.id)).send({ title: `M${String(i)}` });
    }
    const page = await as(app, owner, 'get', `${base(world.p1.id)}?page=2&pageSize=2`);
    expect(page.body).toMatchObject({ page: 2, pageSize: 2, total: 3 });
    expect(page.body.items).toHaveLength(1);
    expect((await as(app, owner, 'get', `${base(world.p1.id)}?pageSize=1000`)).status).toBe(400);
  });
});
```

## Notes

- The route test never touches a database: `fake-db` supplies users, projects, memberships, sessions and the audit list; your fake supplies the new table. Mock every repository the route chain reads (`auth`, `access`, `projects`, `members`, `audit`) as shown.
- `login()` writes its own audit entries. Assert on your entity (`a.entity === 'Milestone'`), not on `db.audit.length`.
- `world` gives you two organizations and one user per role: `ownerA`, `analystA`, `approverA`, `viewerA` (members of `p1`), `outsiderA` (no membership), `adminA` (org admin), `adminB` and `userB` (another organization).
