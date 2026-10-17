# API module template

This is the short version of the layering. The full, tested example (shared schemas, all four layers, the audit log, the fake repository and three test files) is in `.claude/skills/api-module/`; follow that skill when you add a module. The files below are the project's real shape, taken from the Milestones example.

`milestones` is the resource name; replace it with yours.

### `apps/api/src/modules/milestones/milestones.route.ts`

```ts
import { Router, type Router as RouterType } from 'express';
import {
  ProjectPermission,
  createMilestoneSchema,
  listMilestonesQuerySchema,
  projectRolesWith,
} from '@brd/shared';
import { requireProjectRole } from '../../middleware/require-project-role.js';
import { validate } from '../../middleware/validate.js';
import { createMilestoneController, listMilestonesController } from './milestones.controller.js';

export const milestonesRouter: RouterType = Router({ mergeParams: true });

const canRead = requireProjectRole(...projectRolesWith(ProjectPermission.READ));
const canUpdate = requireProjectRole(...projectRolesWith(ProjectPermission.UPDATE_PROJECT));

milestonesRouter.get(
  '/',
  validate(listMilestonesQuerySchema, 'query'),
  canRead,
  listMilestonesController,
);
milestonesRouter.post('/', validate(createMilestoneSchema), canUpdate, createMilestoneController);
```

### `apps/api/src/modules/milestones/milestones.controller.ts`

```ts
import type { Request, Response } from 'express';
import type { CreateMilestoneInput, ListMilestonesQuery } from '@brd/shared';
import { getAuthUser } from '../../middleware/require-auth.js';
import * as service from './milestones.service.js';

const projectIdOf = (req: Request): string => req.params['id'] as string;

export async function listMilestonesController(req: Request, res: Response): Promise<void> {
  res.json(
    await service.listMilestones(
      getAuthUser(res),
      projectIdOf(req),
      req.query as unknown as ListMilestonesQuery,
    ),
  );
}

export async function createMilestoneController(req: Request, res: Response): Promise<void> {
  const milestone = await service.createMilestone(
    getAuthUser(res),
    projectIdOf(req),
    req.body as CreateMilestoneInput,
  );
  res.status(201).json({ milestone });
}
```

### `apps/api/src/modules/milestones/milestones.service.ts`

```ts
import type {
  CreateMilestoneInput,
  ListMilestonesQuery,
  MilestoneDto,
  PagedResult,
  UserDto,
} from '@brd/shared';
import { withTransaction } from '../../lib/transaction.js';
import { createAuditLog } from '../audit/audit.repository.js';
import * as repo from './milestones.repository.js';

export function toMilestoneDto(record: repo.MilestoneRecord): MilestoneDto {
  return {
    id: record.id,
    title: record.title,
    dueDate: record.dueDate ? record.dueDate.toISOString().slice(0, 10) : null,
    status: record.status,
    createdBy: record.createdBy,
    createdAt: record.createdAt.toISOString(),
  };
}

export async function listMilestones(
  user: UserDto,
  projectId: string,
  query: ListMilestonesQuery,
): Promise<PagedResult<MilestoneDto>> {
  const { items, total } = await repo.listMilestones({
    organizationId: user.organizationId,
    projectId,
    page: query.page,
    pageSize: query.pageSize,
  });
  return { items: items.map(toMilestoneDto), page: query.page, pageSize: query.pageSize, total };
}

export async function createMilestone(
  user: UserDto,
  projectId: string,
  input: CreateMilestoneInput,
): Promise<MilestoneDto> {
  const created = await withTransaction(async (tx) => {
    const milestone = await repo.createMilestone(
      {
        title: input.title,
        dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null,
        projectId,
        organizationId: user.organizationId,
        createdById: user.id,
      },
      tx,
    );
    await createAuditLog(
      {
        action: 'CREATE',
        entity: 'Milestone',
        entityId: milestone.id,
        userId: user.id,
        organizationId: user.organizationId,
        metadata: { projectId },
      },
      tx,
    );
    return milestone;
  });
  return toMilestoneDto(created);
}
```

### `apps/api/src/modules/milestones/milestones.repository.ts`

```ts
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { DbClient } from '../../lib/transaction.js';

const milestoneSelect = {
  id: true,
  title: true,
  dueDate: true,
  status: true,
  createdAt: true,
  createdBy: { select: { id: true, name: true } },
} as const;

export type MilestoneRecord = Prisma.MilestoneGetPayload<{ select: typeof milestoneSelect }>;

/** Soonest due date first, undated last; the id breaks ties so pages never overlap. */
export async function listMilestones(params: {
  organizationId: string;
  projectId: string;
  page: number;
  pageSize: number;
}): Promise<{ items: MilestoneRecord[]; total: number }> {
  const where = { organizationId: params.organizationId, projectId: params.projectId };
  const [items, total] = await Promise.all([
    prisma.milestone.findMany({
      where,
      select: milestoneSelect,
      orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }, { id: 'asc' }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.milestone.count({ where }),
  ]);
  return { items, total };
}

export async function createMilestone(
  data: {
    title: string;
    dueDate: Date | null;
    projectId: string;
    organizationId: string;
    createdById: string;
  },
  db: DbClient,
): Promise<MilestoneRecord> {
  return db.milestone.create({ data, select: milestoneSelect });
}
```

## What differs from a generic Express template

- `validate(schema, 'body' | 'query' | 'params')` replaces the parsed request; handlers read `req.body` and `req.query` as the typed result.
- The signed-in user comes from `getAuthUser(res)`; services receive a `UserDto` and use `user.organizationId`.
- Project access is `requireProjectRole(...projectRolesWith(ProjectPermission.X))`; organization routes use `requireOrgRole('ORG_ADMIN')`.
- Errors are classes from `errors/app-error.js` (`NotFoundError`, `ForbiddenError`, `ValidationError`, `ConflictError`); the central handler builds the response.
- Imports of local files end in `.js` (ESM). Repositories are the only files that import `prisma`.
- Tests: one file per layer next to the source (`*.repository.test.ts`, `*.service.test.ts`, `*.route.test.ts`).
