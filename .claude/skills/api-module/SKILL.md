---
name: api-module
description: Scaffold a new API module in apps/api (route → controller → service → repository, shared Zod schemas, project/organization scoping, RBAC, audit log, supertest tests). Use when adding an endpoint or a new resource to the API, or a write to an existing module.
---

# API module

Layer rules live in `.claude/rules/api.md`; the code below follows them. A complete worked example, a project **Milestones** resource (list + create, audited), is in `templates/`. It was compiled, linted and tested in a scratch copy of this repository, so copy it rather than writing from memory.

## When to use

- A new resource or endpoint under `/api`, project-scoped (`/api/projects/:id/...`) or organization-level.
- A new write (create, update, delete, state change) in an existing module: the audit, transaction and test steps still apply.

Not for: background or model work (`llm-call`), schema-only changes (`prisma-change`), screens (`ui-page`).

## Reference code

| Need | Read |
| --- | --- |
| Read-only paged list | `modules/decisions/` |
| Create and update with audit and a queued job | `modules/notes/` |
| Membership rules, last-owner checks | `modules/members/` |
| Optimistic locking with a 409 | `modules/questions/` |
| Org-level routes (`requireOrgRole`) | `modules/users/` |

## Rules that never bend

- Route → controller → service → repository. Only the repository imports `prisma`.
- Every query carries `organizationId`, and `projectId` for project data. The organization comes from the signed-in user, never from the request.
- Every body, query and param is parsed by a Zod schema from `packages/shared` before the controller runs.
- Throw typed errors from `errors/app-error.js`. Never catch and swallow; the central handler returns `{ error: { code, message, requestId } }`.
- Multi-table writes and the audit entry share one transaction (`withTransaction`).
- Logs carry ids and counts only: no secrets, no document text, no personal data.

## Steps

Below, `<name>` is the resource in lower case, for example `milestones`.

1. **Plan first.** List the files (see the example below) and wait for approval. Decide, before coding:
   - **Permission.** Project routes use one `ProjectPermission`: `READ`, `ADD_SOURCE`, `ANSWER_QUESTION`, `REPROCESS`, `APPROVE`, `UPDATE_PROJECT`, `MANAGE_MEMBERS` or `ARCHIVE_PROJECT` (roles per permission: `PROJECT_PERMISSIONS` in `packages/shared/src/constants/roles.ts`). Organization-level routes use `requireOrgRole('ORG_ADMIN')`.
   - **Audit action.** One of `CREATE`, `UPDATE`, `DELETE`, `APPROVE`, `REJECT`, `EXPORT` (the `AuditAction` enum). Reads are not audited.
   - **Schema change?** If a table or column is new, do `prisma-change` first and rebuild shared (`pnpm build:packages`).
2. **Shared schemas** (`templates/shared-schemas.md`). Params, query, body and DTO type in `packages/shared`; export them from `index.ts`.
   - Reuse `uuidSchema`. Bodies that must not take extra keys use `.strict()`.
   - Lists: `page` / `pageSize` with `z.coerce.number().int()`, a `max` on `pageSize`, answer with `PagedResult<T>`.
3. **Repository** (`templates/layers.md`). `select` only what the DTO needs. Lists use a stable order ending in `id` with `skip` / `take`, and run `findMany` and `count` with the same `where` inside `Promise.all`. Writes take the transaction client (`DbClient`).
4. **Service.** Takes the signed-in `UserDto`; maps records to DTOs; throws `NotFoundError`, `ForbiddenError`, `ValidationError` or `ConflictError` as the rule demands. A write calls `createAuditLog(entry, tx)` in the same `withTransaction` as the row, so a failed audit rolls the write back. Audit `metadata` holds ids and counts, never titles or text. Never call a model here: enqueue a job (`llm-call`, `caching-and-queues`).
5. **Controller.** Read the user with `getAuthUser(res)`, call one service function, respond (`201` for create). No Prisma, no rules.
6. **Route.** Method, path and middleware only: `validate(schema, 'query' | 'body' | 'params')`, then `requireProjectRole(...projectRolesWith(ProjectPermission.X))`, then the controller. Use `Router({ mergeParams: true })` for project modules.
7. **Mount.** Project modules: `projectsRouter.use('/:id/<name>', idParams, <name>Router)` in `modules/projects/projects.route.ts` (auth, password check and the `:id` check are already applied there). Top-level modules: `app.use('/api/<name>', <name>Router)` in `app.ts` (CSRF protection already covers `/api`), and start the router with `<name>Router.use(requireAuth, requireCurrentPassword)` as `users.route.ts` does.
8. **Tests** (`templates/tests.md`), next to the source:
   - `*.repository.test.ts`: mock `../../lib/prisma.js`; assert the `where` carries `organizationId` and `projectId`, the order, paging, and the `select`.
   - `*.service.test.ts`: mock the repository, transaction and audit; cover mapping, the audit call and an audit failure.
   - `*.route.test.ts`: supertest through `createApp({ rateLimit: false })` with the fakes in `apps/api/src/test/`. A new repository needs a fake (`test/fake-<name>.ts`, same rules as the real one) mocked with `vi.mock('./<name>.repository.js', ...)`, plus a `reset` call in `beforeEach`. Cover: 401 without a session, the happy path, 403 for a member without the permission, 404 for non-members and other organizations (and nothing written), 400 for bad input, paging, and the audit entry.
9. **Verify.** `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Fix every failure.

## Status codes you should see

| Code | When | Thrown by |
| --- | --- | --- |
| 400 | Body, query or params fail the schema | `validate` (`ValidationError`) |
| 401 | No or expired session | `requireAuth` |
| 403 | Project member without the permission; non-admin on an org route | `requireProjectRole`, `requireOrgRole` (`ForbiddenError`) |
| 404 | Not a member, other organization, or row missing | `NotFoundError` (never reveal that it exists) |
| 409 | Stale version or duplicate | `ConflictError`; a Prisma unique violation (`P2002`) is mapped to 409 by the error handler |

## Example: Milestones

| Method and path | Permission | Audit |
| --- | --- | --- |
| `GET /api/projects/:id/milestones?page&pageSize` | `READ` (every member) | none |
| `POST /api/projects/:id/milestones` | `UPDATE_PROJECT` (owners; org admins always pass) | `CREATE Milestone` |

Files: `packages/shared/src/{constants/milestones,schemas/milestone,types/milestone}.ts` (+ `index.ts` exports), `apps/api/src/modules/milestones/milestones.{repository,service,controller,route}.ts`, the three `*.test.ts` files, `apps/api/src/test/fake-milestones.ts`, and one line in `projects.route.ts`. It needs the `Milestone` model from the `prisma-change` example.

## Done checklist

- [ ] No Prisma outside the repository; no logic in route or controller
- [ ] Every query scoped by `organizationId` (and `projectId` for project data); the organization comes from the user
- [ ] Every input validated by a shared Zod schema; extra keys rejected where the body is a fixed shape
- [ ] One `ProjectPermission` (or `requireOrgRole`) chosen on purpose and tested for allowed and denied roles
- [ ] Writes audited inside the same transaction; audit `metadata` holds ids and counts only
- [ ] Typed errors only; 404 (not 403) for anything the caller may not know exists
- [ ] Logs carry ids and counts, never secrets or document text
- [ ] Repository, service and route tests, including cross-organization access and bad input
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass

Related skills: `code-standards`, `security-compliance`, `db-standards`, `prisma-change`, `llm-call`, `ui-page`.
