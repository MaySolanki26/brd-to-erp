---
name: code-standards
description: Sarvadhi TypeScript code standards for API (Express + Prisma) and web (React + Vite) — structure, naming, typing, validation, errors, logging, testing, dependencies, PR rules. Use whenever writing, refactoring, or reviewing application code.
---

# Code Standards

Goal: code that reads like one senior engineer wrote it, in every project.

## 1. Golden rules

1. Plan before code: list files to change, wait for approval on non-trivial work.
2. Follow existing patterns in the repo before inventing new ones.
3. Small, focused changes. One concern per PR (target < 400 changed lines).
4. Every change is verified: `lint`, `typecheck`, `test`, `build` must pass.
5. No new dependency without approval (see section 9).

## 2. TypeScript

- `strict: true`. No `any`, no `@ts-ignore`, no `as unknown as X`.
- Non-null assertion (`!`) only with a comment explaining why it is safe.
- Prefer `type` for data shapes, `interface` for extendable contracts. Be consistent within a file.
- Use `unknown` for untrusted input, then narrow with Zod.
- Exported functions have explicit return types.
- Use enums from Prisma or `as const` objects; no magic strings for statuses.

## 3. Naming

| Item                 | Convention                    | Example                                  |
| -------------------- | ----------------------------- | ---------------------------------------- |
| Files                | kebab-case                    | `project.service.ts`, `project-list.tsx` |
| React components     | PascalCase                    | `ProjectList`                            |
| Functions, variables | camelCase, verb for functions | `createProject`, `isArchived`            |
| Constants            | UPPER_SNAKE_CASE              | `MAX_UPLOAD_BYTES`                       |
| Types                | PascalCase, no `I` prefix     | `ProjectResponse`                        |
| Booleans             | `is/has/can/should` prefix    | `canEdit`                                |
| DB tables/columns    | see `db-standards`            |                                          |

Names describe intent. No abbreviations except well-known ones (`id`, `url`, `api`).

## 4. API structure (Express)

```
src/modules/<feature>/
  <feature>.routes.ts       routing + middleware only
  <feature>.controller.ts   parse request, call service, shape response
  <feature>.service.ts      business logic, transactions, permissions
  <feature>.repository.ts   Prisma queries only
  <feature>.test.ts         integration tests (supertest)
```

- No business logic in routes or controllers. No Prisma calls outside repositories.
- Services receive a typed context: `{ userId, organizationId, requestId, roles }`.
- Every repository query is scoped by `organizationId` (and project when applicable).
- Request/response schemas live in `packages/shared` (Zod) and are reused by the web app.
- See `templates/api-module-template.md`.

## 5. Web structure (React)

```
src/features/<feature>/
  api/        React Query hooks (use<Feature>Query / Mutation)
  components/ feature-only components
  pages/      route-level pages (ListPage, DetailPage, FormPage patterns)
  store/      Redux slice only if global client state is needed
```

- Shared UI comes from `packages/ui` only. Do not create new primitives (Button, Table, Modal) inside features.
- Components: one component per file, props typed, no inline API calls (use hooks).
- Every page handles: loading, empty, error, no-access, success.
- See `frontend-state` and `theme-management` skills.

## 6. Validation

- Validate every external input with Zod: request body/query/params, env vars, LLM output, file metadata, webhook payloads, localStorage reads.
- Trim strings, set max lengths, restrict enums, reject unknown keys on write endpoints (`.strict()`).
- Validation errors return 400 with field-level details in the standard error format.

## 7. Errors

- Throw typed errors: `AppError` subclasses (`NotFoundError`, `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`).
- One central error handler formats: `{ error: { code, message, details?, requestId } }`.
- Never swallow errors. A `catch` either handles the case, adds context and rethrows, or logs and converts to an `AppError`.
- No stack traces or internal messages in production responses.
- Expected business failures are errors with codes, not `null` returns that callers can ignore.

## 8. Logging

- Use the shared `logger` (pino). No `console.log` in committed code.
- Structured logs: `logger.info({ projectId, durationMs }, 'project created')`.
- Always include `requestId` (and `jobId` in workers).
- Never log: passwords, tokens, cookies, API keys, full documents, personal data. See `security-compliance`.
- Levels: `error` (needs action), `warn` (unexpected but handled), `info` (business events), `debug` (development only).

## 9. Dependencies

- Ask before adding a library. Justify: what it replaces, size, maintenance, license (MIT/Apache/BSD preferred; no GPL in shipped code without approval).
- Prefer the platform and existing libraries.
- Pin versions via lockfile; commit the lockfile.

## 10. Configuration

- All config from env, validated at startup with Zod; app fails fast on invalid config.
- Env files per environment (`.env.<APP_ENV>`), never committed. `.env.example` is committed and complete.
- No hardcoded URLs, secrets, limits, or feature flags in code.

## 11. Testing

| Level       | What                                                    | Tool                         |
| ----------- | ------------------------------------------------------- | ---------------------------- |
| Unit        | pure logic, calculations, parsers, utils                | Vitest                       |
| Integration | API endpoints with DB (permissions, validation, errors) | Vitest + supertest + test DB |
| E2E         | critical user flows only                                | Playwright (when introduced) |

Must test: permission matrix, tenant isolation, validation failures, business rules, edge cases from the spec, bug fixes (regression test first).
Tests are deterministic: no real external calls (use fixtures/mocks), no dependence on order or time (inject clock).

## 12. Comments and docs

- Code explains _what_; comments explain _why_ (business reason, workaround, trade-off).
- No commented-out code. No `TODO` without an issue link.
- Significant decisions recorded as ADRs in `docs/adr/`.

## 13. Git and PRs

- Branch: `feature/<name>`, `fix/<name>`, `chore/<name>`.
- Conventional commits: `feat(api): ...`, `fix(web): ...`.
- PR description: what, why, how tested, screenshots for UI, risks. Use `templates/pr-checklist.md`.
- Another developer reviews every PR. No direct push to `main`.

## 14. CI enforcement

- ESLint (incl. `@typescript-eslint/no-explicit-any`, `no-console`), Prettier check, `tsc --noEmit`, tests, build, gitleaks.

## Done checklist

- [ ] Follows module structure and naming
- [ ] Inputs validated with shared Zod schemas
- [ ] Errors typed; no swallowed errors
- [ ] Logs structured, no sensitive data
- [ ] Tests added for logic, permissions, edge cases
- [ ] No new dependency without approval
- [ ] lint, typecheck, test, build pass
