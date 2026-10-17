# API Module Template

Replace `project` / `Project` with the feature name.

## packages/shared/src/project/project.schema.ts

```ts
import { z } from 'zod';

export const createProjectSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(2000).optional(),
  })
  .strict();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const listProjectsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
```

## project.routes.ts

```ts
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createProjectSchema, listProjectsQuerySchema } from '@brd/shared';
import { projectController } from './project.controller';

export const projectRoutes = Router();

projectRoutes.get(
  '/',
  requireAuth,
  validate({ query: listProjectsQuerySchema }),
  projectController.list,
);
projectRoutes.post(
  '/',
  requireAuth,
  validate({ body: createProjectSchema }),
  projectController.create,
);
```

## project.controller.ts

```ts
import type { Request, Response } from 'express';
import { projectService } from './project.service';

export const projectController = {
  async list(req: Request, res: Response): Promise<void> {
    const result = await projectService.list(req.ctx, req.validated.query);
    res.json(result);
  },

  async create(req: Request, res: Response): Promise<void> {
    const project = await projectService.create(req.ctx, req.validated.body);
    res.status(201).json(project);
  },
};
```

## project.service.ts

```ts
import type { CreateProjectInput, ListProjectsQuery } from '@brd/shared';
import type { RequestContext } from '../../types/context';
import { ConflictError } from '../../errors/app-error';
import { prisma } from '../../lib/prisma';
import { auditLog } from '../audit/audit.service';
import { projectRepository } from './project.repository';

export const projectService = {
  async list(ctx: RequestContext, query: ListProjectsQuery) {
    return projectRepository.listForUser(ctx.organizationId, ctx.userId, query);
  },

  async create(ctx: RequestContext, input: CreateProjectInput) {
    const exists = await projectRepository.existsByName(ctx.organizationId, input.name);
    if (exists)
      throw new ConflictError('PROJECT_NAME_TAKEN', 'A project with this name already exists');

    return prisma.$transaction(async (tx) => {
      const project = await projectRepository.create(tx, ctx, input);
      await auditLog(tx, ctx, { action: 'project.create', entityId: project.id });
      return project;
    });
  },
};
```

## project.repository.ts

```ts
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const projectSelect = {
  id: true,
  name: true,
  description: true,
  status: true,
  createdAt: true,
} satisfies Prisma.ProjectSelect;

export const projectRepository = {
  async listForUser(
    organizationId: string,
    userId: string,
    q: { search?: string; page: number; pageSize: number },
  ) {
    const where: Prisma.ProjectWhereInput = {
      organizationId,
      deletedAt: null,
      members: { some: { userId } },
      ...(q.search ? { name: { contains: q.search, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.project.findMany({
        where,
        select: projectSelect,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.project.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  },
  // existsByName, create(tx, ctx, input) ...
};
```

## project.test.ts (minimum cases)

- 201 create as allowed role; 400 invalid body; 409 duplicate name
- 401 without auth; 404 for project in another organization
- list returns only projects where the user is a member
