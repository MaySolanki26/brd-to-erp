---
name: prisma-change
description: Guide a Prisma schema change end to end (edit schema.prisma, create and review the migration, regenerate the client, check indexes, update seed, shared types, repositories and fakes). Use for any new model, column, enum, index or constraint.
---

# Prisma change

Schema: `apps/api/prisma/schema.prisma`. Migrations: `apps/api/prisma/migrations/`. Seed: `apps/api/prisma/seed.ts`. Scripts (in `apps/api/package.json`): `prisma:migrate` (`prisma migrate dev`), `prisma:deploy`, `prisma:generate`, `prisma:seed`. Standards: `db-standards` and its `examples/`. The worked example, a **Milestone** model, is in `templates/schema-and-migration.md`; its SQL is real Prisma output.

## When to use

- A new model, enum, column, index or constraint.
- A column that becomes required, changes type, or loses values.
- Seed data that must follow a schema change.

Not for: query-only work (`api-module`) or data fixes on a live database (write a reviewed one-off SQL migration and say so in the plan).

## Rules that never bend

- **Never edit a migration that has been applied** anywhere other than your own dev database (shared dev, CI, staging, production). Prisma checksums every migration; fix mistakes with a new one.
- Migrations are SQL you read before they run. No blind `migrate dev`.
- Tenant data carries `organizationId` (and `projectId` when project-scoped); every query on it stays scoped.
- `AuditLog` and `LlmUsage` are append-only: never update or delete their rows.

## Steps

1. **Plan first.** State the change, the tables touched, whether existing rows are affected, and the indexes you expect. Wait for approval.
2. **Edit `schema.prisma`** the way the neighbouring models do:
   - `id String @id @default(uuid()) @db.Uuid`, `createdAt`, `updatedAt @updatedAt`, `@@map("snake_case_plural")`.
   - Statuses are enums (`MilestoneStatus`), not free strings. Calendar dates use `@db.Date`.
   - Add the back-relation arrays on the parent models (`Project.milestones`, `User.createdMilestones`).
3. **Index check, before generating anything.** Write the list down:
   - [ ] every foreign key column is the first column of some index (a composite such as `[projectId, dueDate]` counts)
   - [ ] every `status` column has an index
   - [ ] `organizationId` has an index
   - [ ] each new repository query's `where` + `orderBy` is served by an index (the list above is `where projectId` ordered by `dueDate`)
   - [ ] uniqueness rules are `@@unique`, not just checked in code
4. **Preview the SQL without a database**, to catch surprises early:
   ```
   cd apps/api
   git show HEAD:apps/api/prisma/schema.prisma > "$TMPDIR/old-schema.prisma"
   pnpm exec prisma migrate diff \
     --from-schema-datamodel "$TMPDIR/old-schema.prisma" \
     --to-schema-datamodel prisma/schema.prisma --script
   ```
   With no schema change the output is `-- This is an empty migration.`
5. **Create the migration without applying it.** Start the database (`docker compose up -d postgres`), then:
   ```
   pnpm --filter ./apps/api prisma:migrate -- --create-only --name milestones
   ```
   The name is a short snake_case description of what changed (`milestones`, `question_dismissal_reason`), not when or by whom.
6. **Review `migration.sql` line by line.**
   - [ ] only the statements you expect; nothing dropped by accident
   - [ ] any `NOT NULL` column on an existing table has a default or a backfill (step 7)
   - [ ] enum changes use `USING` casts (see the real example in the template)
   - [ ] every index from the check in step 3 is present
   - [ ] foreign keys use the default `ON DELETE RESTRICT`; deliberate deletes are soft (`deletedAt`)
7. **Make it safe for existing rows.** Pick one and say which in a comment at the top of the SQL:
   - **Nullable, backfill, tighten:** add the column nullable, `UPDATE` old rows, then `SET NOT NULL`.
   - **Default:** a constant default covers old rows.
   - **Guard:** if old rows cannot be filled honestly, fail loudly instead of guessing; `20261017090000_knowledge_items` raises an exception when the tables are not empty.
8. **Apply and generate.** `pnpm --filter ./apps/api prisma:migrate` applies the pending migration and regenerates the client; run `pnpm --filter ./apps/api prisma:generate` after pulling someone else's migration.
9. **Update dependents:**
   - Repositories: new fields in `select`, queries still scoped by `organizationId`.
   - `packages/shared`: schemas, constants, DTO types; rebuild with `pnpm build:packages`.
   - **Seed** (`prisma/seed.ts`): add rows a developer needs to see the feature. Seeds are idempotent (look up by a natural key before creating), use the dev org and users already there, and the file refuses to run when `APP_ENV=production`.
   - Test fakes in `apps/api/src/test/`.
   - Multi-table writes go through `withTransaction` (`lib/transaction.ts`).
10. **Tests.** Repository tests assert the new `where` / `select` and the order; add a case for the new column or constraint.
11. **Verify.** `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Run `pnpm --filter ./apps/api prisma:seed` twice: the second run must change nothing.

If a migration you created is wrong and has **not** left your machine, delete its folder, run `prisma migrate reset` on your dev database, and recreate it. Once it has been pushed or applied elsewhere, add a new migration instead.

## Example: Milestones

A project has dated milestones (`PLANNED` or `DONE`). The model is project-scoped, created by a user, listed by due date. The index check gives `[projectId, dueDate]` (covers the project foreign key and the list order), plus `organizationId`, `status` and `createdById`. See `templates/schema-and-migration.md` for the model, the generated SQL and the seed function.

## Done checklist

- [ ] Plan approved; tables, row impact and indexes stated
- [ ] Foreign keys, `status` columns and `organizationId` indexed; each new query served by an index
- [ ] Migration created with a descriptive name, SQL read, safe for existing rows
- [ ] No already-applied migration edited
- [ ] Client regenerated; shared schemas, repositories, seed and fakes updated
- [ ] Every query still scoped by `organizationId`
- [ ] Seed runs twice without changing anything
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass

Related skills: `db-standards`, `api-module`, `security-compliance`.
