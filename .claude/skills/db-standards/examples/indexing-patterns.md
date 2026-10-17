# Indexing Patterns

## 1. Tenant list with status filter and newest first

Query: orders of an organization, filtered by status, newest first.

```prisma
model SalesOrder {
  // ...
  @@index([organizationId, status, createdAt(sort: Desc)], map: "idx_sales_orders_org_status_created")
  @@map("sales_orders")
}
```

## 2. Foreign keys (always)

```prisma
model SalesOrderLine {
  salesOrderId String @map("sales_order_id") @db.Uuid
  itemId       String @map("item_id") @db.Uuid
  @@index([salesOrderId], map: "idx_sales_order_lines_order")
  @@index([itemId], map: "idx_sales_order_lines_item")
}
```

## 3. Tenant-scoped unique business key

```prisma
@@unique([organizationId, code], map: "uq_customers_org_code")
```

## 4. Partial index (raw SQL in migration)

Only active (not deleted) rows are queried in normal screens.

```sql
CREATE INDEX idx_customers_org_name_active
  ON customers (organization_id, name)
  WHERE deleted_at IS NULL;
```

Unique email among active users only:

```sql
CREATE UNIQUE INDEX uq_users_org_email_active
  ON users (organization_id, lower(email))
  WHERE deleted_at IS NULL;
```

## 5. Search with ILIKE '%term%'

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_customers_name_trgm ON customers USING gin (name gin_trgm_ops);
```

## 6. Keyset pagination index

```sql
-- query
SELECT id, number, created_at FROM invoices
WHERE organization_id = $1 AND (created_at, id) < ($2, $3)
ORDER BY created_at DESC, id DESC
LIMIT 50;

-- index
CREATE INDEX idx_invoices_org_created_id ON invoices (organization_id, created_at DESC, id DESC);
```

## 7. Covering index for a hot list

```sql
CREATE INDEX idx_invoices_org_status_cover
  ON invoices (organization_id, status, invoice_date DESC)
  INCLUDE (number, total_amount, customer_id);
```

## 8. Large table: build without blocking writes

Put in its own migration (Prisma wraps migrations in a transaction only if the SQL does not prevent it; `CONCURRENTLY` cannot run inside a transaction, so keep it as the only statement and verify with the team's Prisma version):

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_moves_org_item_date
  ON stock_moves (organization_id, item_id, moved_at DESC);
```

## 9. Verify

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT ... ;   -- expect Index Scan / Index Only Scan, not Seq Scan on large tables
```

Find unused indexes:

```sql
SELECT relname AS table, indexrelname AS index, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

## Anti-patterns

- Index on every column "just in case"
- Single-column indexes when queries always filter by `organization_id` + another column
- Index on low-cardinality boolean alone (`is_active`) — use partial index instead
- Function in WHERE (`lower(email) = ...`) without a matching expression index
