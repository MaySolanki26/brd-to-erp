---
name: api-module
description: Scaffold a new API module in apps/api (route, controller, service, repository, shared Zod schema, tests) following the route → controller → service → repository layering. Use when adding an endpoint or a new resource to the API.
---

# API module

Reference module: `apps/api/src/modules/decisions/` (read-only list endpoint) and `questions/` (writes). Copy their shape; do not invent a new one. Layer rules live in `.claude/rules/api.md`.

## Steps

1. **Plan first.** List the files below and wait for approval.
2. **Schemas in `packages/shared/src/schemas/<name>.ts`.** Zod schemas for params, query and body, plus the response DTO types.
   - Reuse `uuidSchema` from `schemas/project.ts`; bodies that must not accept extra keys use `.strict()`.
   - Pagination: `page` / `pageSize` with `z.coerce.number().int()`, a `max` on `pageSize`, and `PagedResult<T>` for the response.
   - Export from `packages/shared/src/index.ts`. Rebuild shared (`pnpm build:packages`) before the API sees the new types.
3. **Repository `<name>.repository.ts`.** The only file that imports `prisma` (`../../lib/prisma.js`).
   - Every `where` includes `organizationId`, and `projectId` for project data.
   - `select` only the fields the DTO needs (never `passwordHash`, `email` of other users, etc.).
   - Lists use a stable order (`createdAt desc, id desc`) with `skip` / `take`, and run `findMany` and `count` with the same `where` in `Promise.all`.
   - Multi-table writes take a `DbClient` from `withTransaction` (`lib/transaction.ts`); do not open transactions in the controller.
4. **Service `<name>.service.ts`.** Business rules and mapping from records to DTOs.
   - Takes the authenticated `UserDto` and uses `user.organizationId`; never trusts an org id from the request.
   - Throws typed errors from `errors/app-error.ts` (`NotFoundError`, `ForbiddenError`, `ValidationError`, …). Never swallow errors.
   - Validate JSON columns on read with Zod `safeParse` and log (id and counts only) when entries are dropped.
   - LLM work does not happen here inline; enqueue a job (see the `llm-call` skill) with `enqueue` from `services/queue.service.ts`.
5. **Controller `<name>.controller.ts`.** Parse, call one service function, respond. Get the user with `getAuthUser(res)` from `middleware/require-auth.js`. No Prisma, no business logic.
6. **Route `<name>.route.ts`.** Method, path and middleware only:
   - `Router({ mergeParams: true })` for project-scoped modules.
   - `validate(schema, 'query' | 'body' | 'params')` first, then `requireProjectRole(...projectRolesWith(ProjectPermission.X))` (or `requireOrgRole` for org-level routes), then the controller.
7. **Mount it.** Project-scoped modules are mounted in `modules/projects/projects.route.ts` (`projectsRouter.use('/:id/<name>', idParams, <name>Router)`); top-level ones in `app.ts` under `/api`.
8. **Tests, next to the source, one file per layer:**
   - `*.repository.test.ts`: mock `../../lib/prisma.js` with `vi.hoisted`; assert `organizationId` scoping, ordering, paging and `select`.
   - `*.service.test.ts`: inject or mock the repository; cover success, not-found, forbidden and bad stored data.
   - `*.route.test.ts`: supertest through `createApp`, using the fakes in `apps/api/src/test/` (`fake-db`, `fake-questions`); cover validation errors (400), no role (403), another organization's data (404) and the happy path.
9. **Verify.** `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Fix every failure.

## Checklist

- [ ] No Prisma outside the repository; no logic in route or controller
- [ ] Every query scoped by `organizationId`
- [ ] Every input validated by a shared Zod schema
- [ ] Typed errors only; consistent error envelope comes from the central handler
- [ ] Logs carry ids and counts, never secrets or document text
- [ ] Tests for repository, service and route

Related skills: `code-standards`, `security-compliance`, `db-standards`, `prisma-change` (when the schema changes too).
