# Project: BRD Platform (MVP)

## Stack

pnpm monorepo · React + Vite + TS · Express + TS · Prisma + PostgreSQL · pg-boss · Zod · pino · Vitest

## Structure

apps/web, apps/api (api + worker entries), packages/ui, packages/shared, packages/config, prompts/, evals/, docs/adr/

## Architecture rules

- API layers: route → controller → service → repository. No business logic in routes/controllers.
- Validate every API input and every LLM output with Zod (schemas in packages/shared).
- All LLM calls go through llmService only.
- Errors: throw typed AppError subclasses; central error handler; never swallow errors.
- Logging: pino with requestId; never log secrets, tokens, or document content.
- DB: Prisma migrations only; index foreign keys and status columns; use transactions for multi-table writes.
- Every query is scoped by organizationId.

## Code rules

- TypeScript strict; no `any`, no `@ts-ignore`, no non-null assertions without a comment.
- Small functions, clear names, no commented-out code, no TODO without an issue reference.
- UI: use packages/ui components only (see ui/registry.json). Every screen handles loading/empty/error/no-access states.
- No new dependency without asking first.

## Workflow rules

- Plan first, list files to change, wait for approval.
- After changes run: pnpm lint && pnpm typecheck && pnpm test && pnpm build. Fix all failures.
- Do not modify files outside the task scope.
- Finish with: files changed, what was verified, open risks.
- Workspace packages must build before apps; always use root scripts (pnpm typecheck/test/build).
- Every package must declare its own dependencies; never rely on another package's dependency.
- Follow the sarvadhi-standards skills (code, db, caching, performance, security, frontend-state, theme).
