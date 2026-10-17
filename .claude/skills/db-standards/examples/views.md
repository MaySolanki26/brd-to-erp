# Views and Materialized Views

## Regular view (reusable report logic)

Migration SQL:

```sql
CREATE VIEW v_customer_outstanding AS
SELECT
  c.organization_id,
  c.id            AS customer_id,
  c.name          AS customer_name,
  COALESCE(SUM(i.total_amount - i.paid_amount), 0) AS outstanding_amount,
  COUNT(i.id) FILTER (WHERE i.due_date < CURRENT_DATE AND i.total_amount > i.paid_amount) AS overdue_count
FROM customers c
LEFT JOIN invoices i
  ON i.customer_id = c.id
 AND i.organization_id = c.organization_id
 AND i.status = 'POSTED'
WHERE c.deleted_at IS NULL
GROUP BY c.organization_id, c.id, c.name;
```

## Materialized view (heavy dashboard)

```sql
CREATE MATERIALIZED VIEW mv_monthly_sales AS
SELECT
  organization_id,
  date_trunc('month', invoice_date)::date AS month,
  SUM(total_amount) AS total_sales,
  COUNT(*)          AS invoice_count
FROM invoices
WHERE status = 'POSTED'
GROUP BY organization_id, date_trunc('month', invoice_date);

CREATE UNIQUE INDEX uq_mv_monthly_sales ON mv_monthly_sales (organization_id, month);
```

Refresh (scheduled job or after posting events, via queue):

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_sales;
```

Store `last_refreshed_at` (e.g., in a `report_refresh_log` table) and show "Data as of …" in the UI.

## Access from code (typed, tenant-scoped)

```ts
const rowSchema = z.object({
  customer_id: z.string().uuid(),
  customer_name: z.string(),
  outstanding_amount: z.coerce.number(),
  overdue_count: z.coerce.number().int(),
});

const rows = await prisma.$queryRaw`
  SELECT customer_id, customer_name, outstanding_amount, overdue_count
  FROM v_customer_outstanding
  WHERE organization_id = ${ctx.organizationId}::uuid
  ORDER BY outstanding_amount DESC
  LIMIT ${limit}
`;
const data = z.array(rowSchema).parse(rows);
```

Note: `outstanding_amount` comes back as a decimal string; convert carefully (use a decimal library for money math, `Number` only for display/sorting).

## Rules

- Views always expose `organization_id`; every read filters it.
- Changing a view = new migration with `CREATE OR REPLACE VIEW` (or drop + create if columns change).
- Do not stack many views on views; it hides cost. Check `EXPLAIN`.
