---
name: prisma-change
description: Guide a Prisma schema change end to end (edit schema.prisma, create a reviewed migration, regenerate the client, update seed, shared types and repositories). Use for any new model, column, enum, index or constraint.
---

# Prisma change

Schema: `apps/api/prisma/schema.prisma`. Migrations: `apps/api/prisma/migrations/`. Scripts are in `apps/api/package.json` (`prisma:migrate`, `prisma:deploy`, `prisma:generate`, `prisma:seed`). Standards: `db-standards` skill and its `examples/`.

## Steps

1. **Plan first.** State the change, the tables touched and whether existing rows are affected. Wait for approval.
2. **Edit `schema.prisma`** following the existing models:
   - `id String @id @default(uuid()) @db.Uuid`; `createdAt` / `updatedAt`; `@@map("snake_case_plural")`.
   - Tenant data carries `organizationId` (and `projectId` when project-scoped).
   - Add `@@index` on every foreign key and every `status` column, plus composite indexes for real query shapes (for example `[projectId, createdAt]` on `LlmUsage`). Immutable tables (`AuditLog`, `LlmUsage`) are never updated.
   - Statuses are enums (for example `KnowledgeStatus`), not free strings.
3. **Create the migration without applying blindly:**
   ```
   pnpm --filter ./apps/api prisma:migrate -- --create-only --name <short_snake_case>
   ```
   Read the generated `migration.sql` before applying. Never edit an applied migration; add a new one.
4. **Make it safe for existing data.** If a new `NOT NULL` column or stricter type cannot be filled for old rows, either add it nullable, backfill, then tighten, or guard with an explicit check that fails loudly (see `20261017090000_knowledge_items`, which refuses to run when rows exist that it cannot fill). Enum value changes need `USING` casts like that migration. State the decision in the migration comment.
5. **Apply and generate:** `pnpm --filter ./apps/api prisma:migrate` then `pnpm --filter ./apps/api prisma:generate`.
6. **Update dependents:**
   - Repositories (only place that imports `prisma`): new fields in `select`, queries still scoped by `organizationId`.
   - `packages/shared` Zod schemas, constants and DTO types; rebuild with `pnpm build:packages`.
   - `apps/api/prisma/seed.ts` and test fakes in `apps/api/src/test/`.
   - Multi-table writes go through `withTransaction` (`lib/transaction.ts`).
7. **Test.** Repository tests assert the new `where` / `select`; add a case for the new column or constraint.
8. **Verify.** `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

## Checklist

- [ ] Foreign keys and status columns indexed; `@@map` and naming match neighbours
- [ ] Migration read, named, and safe for existing rows
- [ ] Client regenerated; shared schemas, seed and fakes updated
- [ ] Every query still scoped by `organizationId`
- [ ] No manual edits to already-applied migrations

Related skills: `db-standards`, `api-module`.
