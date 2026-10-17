---
name: db-standards
description: Sarvadhi PostgreSQL + Prisma database standards for ERP projects — naming, normalization, multi-tenancy, keys, indexing, joins and query rules, pagination, views and materialized views, transactions and locking, migrations, data types, audit, retention, backup. Use for any schema change, migration, query, report, or performance issue.
---

# Database Standards (PostgreSQL + Prisma)

## 1. Naming

| Item          | Rule                        | Example                                         |
| ------------- | --------------------------- | ----------------------------------------------- |
| Tables        | snake_case, plural          | `sales_orders`                                  |
| Columns       | snake_case                  | `organization_id`, `created_at`                 |
| Prisma models | PascalCase singular, mapped | `model SalesOrder { @@map("sales_orders") }`    |
| Prisma fields | camelCase, mapped           | `organizationId String @map("organization_id")` |
| Foreign keys  | `<entity>_id`               | `customer_id`                                   |
| Indexes       | `idx_<table>_<cols>`        | `idx_sales_orders_org_status_created`           |
| Unique        | `uq_<table>_<cols>`         | `uq_customers_org_code`                         |
| Booleans      | `is_/has_`                  | `is_active`                                     |
| Timestamps    | `_at` suffix, `timestamptz` | `approved_at`                                   |

## 2. Standard columns (every business table)

```prisma
id             String    @id @default(uuid()) @db.Uuid
organizationId String    @map("organization_id") @db.Uuid   // tenant tables
createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
updatedAt      DateTime  @updatedAt @map("updated_at") @db.Timestamptz(3)
createdById    String?   @map("created_by_id") @db.Uuid
updatedById    String?   @map("updated_by_id") @db.Uuid
deletedAt      DateTime? @map("deleted_at") @db.Timestamptz(3)  // only where soft delete is justified
version        Int       @default(0)                              // only where concurrent edits happen
```

- IDs: UUID (v7 preferred when available, for index locality). Never expose sequential IDs publicly.
- Human-readable business numbers (`INV-2026-000123`) are separate columns, unique per organization, generated in a transaction or via a sequence table.

## 3. Normalization

- Default: **3NF**. Each fact stored once. Masters (customers, items, units, tax rates) referenced by FK, not copied.
- **Exceptions (deliberate denormalization)**, allowed only with a comment/ADR stating why:
  - **Transactional snapshots:** invoice lines store item name, rate, tax % at the time of sale. Historical documents must not change when masters change. This is required, not optional, for ERP documents.
  - **Reporting:** summary tables or materialized views for heavy reports.
  - **Counters/caches:** e.g., `open_questions_count`, with a defined update path (same transaction or job).
- No comma-separated lists or arrays of IDs in a column. Use a join table.
- JSON (`jsonb`) only for truly flexible or snapshot data (settings, audit before/after, external payloads). Never for data you filter, join, or report on regularly.

## 4. Multi-tenancy

- Every tenant-owned table has `organization_id NOT NULL` with FK.
- Every query filters by `organization_id` (enforced in repositories; see `code-standards`).
- Unique constraints are per tenant: `@@unique([organizationId, code])`.
- Composite indexes for tenant queries start with `organization_id`.
- Consider Postgres Row-Level Security for high-risk projects (defense in depth); record the decision in an ADR.

## 5. Data types

| Data                              | Type                                                      |
| --------------------------------- | --------------------------------------------------------- |
| Money                             | `Decimal(18,2)` (or integer minor units); **never float** |
| Quantity/weight                   | `Decimal(18,3)` (precision agreed per domain)             |
| Percent/rate                      | `Decimal(9,4)`                                            |
| Dates without time (invoice date) | `@db.Date`                                                |
| Timestamps                        | `timestamptz`, stored in UTC; convert in UI               |
| Status / fixed sets               | Prisma enum (or lookup table if users manage values)      |
| Long text                         | `text` with app-level max length                          |
| Email                             | `citext` or lower-cased + unique                          |
| Files                             | store key/metadata only; file in object storage           |

## 6. Integrity

- `NOT NULL` by default; nullable only when "unknown" is a real state.
- Foreign keys always. Choose `onDelete` deliberately: `Restrict` for business records, `Cascade` only for pure child rows (e.g., order lines with the order).
- `CHECK` constraints for invariants (`quantity > 0`, `end_date >= start_date`) via SQL in the migration.
- Unique constraints for business keys and to prevent duplicate processing (idempotency keys).

## 7. Indexing

Rules:

1. Index every foreign key column (Postgres does not do this automatically).
2. Composite index column order: **equality filters first** (`organization_id`, `status`), then **range/sort** (`created_at`).
3. Index matches real queries. Design from the query, not the table.
4. Partial indexes for common filtered subsets (`WHERE deleted_at IS NULL`, `WHERE status = 'OPEN'`), via raw SQL in the migration.
5. Covering (`INCLUDE`) indexes for hot list queries when `EXPLAIN` shows heap lookups dominate.
6. Text search: `pg_trgm` GIN index for `ILIKE '%x%'` search; full-text (`tsvector`) for document search.
7. `jsonb` filtering: GIN index on the specific path, or move the field to a real column.
8. Do not over-index: each index slows writes. Remove unused indexes (`pg_stat_user_indexes.idx_scan = 0` after a representative period).
9. Large existing tables: create indexes with `CREATE INDEX CONCURRENTLY` in a separate migration.

Every new list/report query is checked with `EXPLAIN (ANALYZE, BUFFERS)` on realistic data volume. See `examples/indexing-patterns.md`.

## 8. Queries and joins

- Select only needed columns (`select` in Prisma). No `SELECT *` in raw SQL.
- **No N+1:** never query inside a loop. Use `include`/`select` with relations, `in` queries, or a single join.
- Join on indexed keys only. Avoid joins on expressions or casts.
- Filter before joining large tables; aggregate in SQL, not in JavaScript.
- Use `EXISTS` instead of `IN (subquery)` for large sets; avoid `OR` across different columns on hot paths (consider `UNION ALL` or separate indexes).
- Raw SQL only through `$queryRaw` with tagged templates (parameterized). **Never** `$queryRawUnsafe` with user input.
- Every query has a bound: pagination or explicit `LIMIT`.
- Slow query threshold: log queries > 200 ms (Prisma query event or `pg_stat_statements`).

## 9. Pagination

- Offset pagination (`skip/take`) for admin lists with < ~10k rows per tenant.
- **Keyset (cursor) pagination** for large or infinite lists: `WHERE (created_at, id) < ($1, $2) ORDER BY created_at DESC, id DESC LIMIT n`, with a matching composite index.
- Always a deterministic `ORDER BY` (include `id` as tie-breaker). `pageSize` max 100.

## 10. Views

- **Views**: encapsulate complex read logic reused by reports (joins + calculated columns). Read-only. Created in SQL migrations.
- **Materialized views**: heavy reports/dashboards where slightly stale data is acceptable.
  - Must have a unique index to use `REFRESH MATERIALIZED VIEW CONCURRENTLY`.
  - Refresh strategy documented: scheduled job (e.g., every 15 min) or after specific events via queue.
  - Show "data as of <time>" in the UI.
- Views always include `organization_id` and are always filtered by it.
- Prisma access: map with the `view` keyword (check if it is still a preview feature in the project's Prisma version) or query via `$queryRaw` with a typed Zod parse. See `examples/views.md`.

## 11. Transactions and concurrency

- Multi-table writes in one `prisma.$transaction`. Keep transactions short: no HTTP/LLM/file calls inside.
- **Optimistic locking** (`version` column) for records edited by multiple users: `update ... where id and version` → 0 rows → `409 Conflict`.
- **Pessimistic locking** (`SELECT ... FOR UPDATE`) only for counters, stock, and balances where correctness requires it.
- Stock, balance, and number-series updates: atomic SQL (`UPDATE ... SET qty = qty - $1 WHERE qty >= $1`), never read-modify-write in JavaScript.
- Idempotency keys for operations that may be retried (payments, imports, job handlers).

## 12. Migrations

- Only via `prisma migrate dev` (local) and `prisma migrate deploy` (all other environments). Never `db push` outside prototypes.
- Descriptive names: `add_invoice_due_date`, not `update`.
- Never edit an applied migration. Fix with a new migration.
- Review generated SQL before committing (destructive changes, locks, defaults).
- **Safe changes on large tables (expand → migrate → contract):**
  1. Add column nullable (no default rewrite) → deploy
  2. Backfill in batches (job/script) → deploy
  3. Add `NOT NULL` / constraint → deploy
  4. Remove old column in a later release
- Renames: add new + backfill + switch code + drop old, never direct rename on live tables used by running code.
- Each migration PR states: lock impact, estimated time on production size, rollback plan.
- See `examples/migration-patterns.md`.

## 13. Seeds

- Seeds are idempotent (`upsert`). Separate: reference data (all environments) vs demo data (development only).
- No real customer data in seeds or fixtures.

## 14. Audit and history

- Audit table for every business write: who, when, action, entity, entity id, before/after (changed fields only), request id.
- Business documents (orders, invoices) use status transitions; never hard delete posted documents. Cancel/reverse with a new record.
- Ledger-style tables (stock, accounts) are append-only; balances derived or maintained with atomic updates.

## 15. Retention, backup, operations

- Retention period per data category documented (see `security-compliance`). Purge jobs for expired data.
- Automated daily backups + point-in-time recovery in production; restore tested at least quarterly.
- Separate DB users: app user (DML only), migration user (DDL). App never connects as superuser.
- Connection pooling (PgBouncer or provider pooler) when instances × pool size approaches `max_connections`.
- Monitor: slow queries, table bloat, index usage, connection count, replication lag (if any).

## 16. CI enforcement

- `prisma validate` and `prisma migrate diff` (schema and migrations in sync).
- Migration lint (e.g., squawk) for unsafe operations.
- Integration tests run on a real Postgres service.

## Done checklist (schema/query change)

- [ ] Naming and standard columns follow this skill
- [ ] Normalized; any denormalization justified
- [ ] `organization_id` + tenant-scoped uniques and indexes
- [ ] FKs indexed; new query patterns have matching indexes; `EXPLAIN` checked
- [ ] No N+1; select only needed columns; bounded results
- [ ] Money/quantity types correct
- [ ] Transactions short; concurrency handled (version/atomic update)
- [ ] Migration safe for production size; rollback noted
- [ ] Audit entry for business writes
