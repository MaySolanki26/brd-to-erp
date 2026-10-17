# Safe Migration Patterns

## Add a required column to a large table (expand → migrate → contract)

**Migration 1 – expand**

```sql
ALTER TABLE invoices ADD COLUMN due_date date;      -- nullable, no table rewrite
```

Deploy code that writes `due_date` for new rows.

**Backfill – job/script in batches (not in the migration)**

```sql
UPDATE invoices SET due_date = invoice_date + 30
WHERE id IN (
  SELECT id FROM invoices WHERE due_date IS NULL LIMIT 5000
);
-- repeat until 0 rows; sleep between batches
```

**Migration 2 – contract**

```sql
ALTER TABLE invoices ALTER COLUMN due_date SET NOT NULL;
```

(For very large tables: add `CHECK (due_date IS NOT NULL) NOT VALID`, then `VALIDATE CONSTRAINT`, then `SET NOT NULL`.)

## Rename a column used by running code

1. Add `new_name`, write to both columns.
2. Backfill `new_name`.
3. Switch reads to `new_name`.
4. Stop writing `old_name`; drop it in a later release.

## Add a foreign key on a large table

```sql
ALTER TABLE order_lines
  ADD CONSTRAINT fk_order_lines_item FOREIGN KEY (item_id) REFERENCES items(id) NOT VALID;
ALTER TABLE order_lines VALIDATE CONSTRAINT fk_order_lines_item;
```

## Add a CHECK constraint

```sql
ALTER TABLE order_lines ADD CONSTRAINT chk_order_lines_qty_positive CHECK (quantity > 0) NOT VALID;
ALTER TABLE order_lines VALIDATE CONSTRAINT chk_order_lines_qty_positive;
```

## Change an enum

- Adding a value: safe (`ALTER TYPE ... ADD VALUE`). It cannot be used in the same transaction it was added in.
- Removing/renaming a value: migrate data to another value first, then recreate the type. Treat as a multi-step change.

## Dangerous operations (need explicit approval + plan)

| Operation                                           | Risk                                     |
| --------------------------------------------------- | ---------------------------------------- |
| `DROP TABLE` / `DROP COLUMN`                        | Data loss; running code may still use it |
| Change column type                                  | Table rewrite + lock                     |
| `ADD COLUMN ... DEFAULT <volatile>`                 | Table rewrite                            |
| `CREATE INDEX` (non-concurrent) on big table        | Blocks writes                            |
| `SET NOT NULL` on big table without NOT VALID check | Full scan under lock                     |

## PR note template

```
Migration: <name>
Tables affected: <list> (approx rows in production: <n>)
Locks: <none / short ACCESS EXCLUSIVE / ...>
Estimated time: <...>
Backfill: <script/job name or none>
Rollback: <new migration that reverses, or "forward fix only" with reason>
```
