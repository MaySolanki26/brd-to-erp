---
name: caching-and-queues
description: Sarvadhi rules for caching (HTTP, in-memory, Redis) and background jobs/queues (pg-boss, BullMQ) — when to add them, key design, TTL, invalidation, tenant isolation, idempotency, retries, dead letters, scheduling. Use when adding caching, Redis, a background job, a scheduled task, or fixing slow endpoints.
---

# Caching and Queues

## Part A — Caching

### 1. Decide before caching

Cache only when **all** are true:

1. The read is measured as slow (> budget in `performance-nfr`) or high-traffic, **after** query/index fixes (`db-standards`).
2. Slightly stale data is acceptable for this data (define how stale: seconds/minutes).
3. There is a clear invalidation trigger.

Never cache: permission decisions longer than the request, balances/stock used for transactions, one-time tokens.

### 2. Cache layers (use the simplest that works)

| Layer                   | Use for                                           | Notes                                                                                                         |
| ----------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Browser/React Query     | per-user UI data                                  | `staleTime` per query (see `frontend-state`)                                                                  |
| HTTP headers            | static assets, public files                       | hashed assets: `Cache-Control: public, max-age=31536000, immutable`; API: `private, no-store` unless designed |
| In-process memory (LRU) | small reference data, single instance only        | lost on restart; inconsistent across instances                                                                |
| **Redis**               | shared cache across instances, rate limits, locks | add when running > 1 API instance or cache must survive restarts                                              |

### 3. Redis key design

Format: `{app}:{env}:{scope}:{entity}:{id}[:{variant}]:v{schemaVersion}`

```
erp:prod:org:7f3a...:customer:91bc...:v1
erp:prod:org:7f3a...:report:monthly-sales:2026-10:v1
erp:prod:global:tax-rates:v2
```

- **Tenant-owned data must include the organization id in the key.** A key without it is a data-leak bug.
- Bump `v{schemaVersion}` when the cached shape changes (old keys expire naturally).
- Never put personal data in keys. Avoid caching personal data in values; if required, set short TTL and note it in the data inventory.

### 4. Patterns

- **Cache-aside** (default): read cache → miss → load from DB → set with TTL → return.
- **Invalidate on write:** after the DB transaction commits, delete affected keys (not inside the transaction).
- **Always set a TTL** (no permanent keys). Add jitter (±10%) to avoid mass expiry.
- **Stampede protection** for expensive keys: single-flight lock (`SET key NX PX`) or serve stale while one request refreshes.
- Cache values are validated (Zod) on read; on parse failure, delete and reload.
- **Redis down = app still works** (fallback to DB, log warning). Cache is an optimization, never a dependency for correctness.

### 5. Implementation rules

- One `CacheService` interface (`get`, `set`, `del`, `delByPrefix`, `wrap`) with drivers: `memory` (dev/tests) and `redis`. Selected by env.
- Use `SCAN` (never `KEYS`) for prefix deletes, or track keys in a set.
- Set `maxmemory` and an eviction policy (`allkeys-lru` for cache-only Redis). Use a **separate Redis DB/instance** for queues vs cache when both use Redis (queues must not be evicted).
- TLS + password/ACL in non-local environments.
- Metrics: hit rate, latency, evictions. A cache with < 50% hit rate needs review.

## Part B — Background jobs and queues

### 6. What goes to a queue

Anything that is slow (> ~1 s), can fail and retry, or must not block the user:
emails/SMS/notifications, file parsing, imports/exports, PDF generation, AI/LLM calls, third-party API sync, webhooks out, report refresh, cleanup/retention jobs.

The API responds immediately with a status (e.g., `202 Accepted` + resource with `PROCESSING`), and the UI polls or subscribes.

### 7. Tool choice

| Stage                                                                            | Tool                     | Why                                                        |
| -------------------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------- |
| Default (MVP, small/medium)                                                      | **pg-boss** (PostgreSQL) | no extra infra, transactional enqueue with business writes |
| High throughput / many workers / rate-limited queues                             | **BullMQ + Redis**       | faster, rich features; needs Redis ops                     |
| Hide the tool behind a `QueueService` so switching does not touch business code. |

### 8. Job design rules

- **Payload = IDs + small parameters only** (`{ organizationId, projectId, sourceId }`). Load data inside the job. No large blobs, no secrets.
- **Tenant re-check:** job verifies the entity still exists and belongs to `organizationId` before work.
- **Idempotent:** running the same job twice gives the same result (check status, use unique keys, upserts). Retries will happen.
- **Retries:** exponential backoff with limit (e.g., 3–5). Classify errors: retryable (network, 429, 5xx) vs permanent (validation, not found) → fail fast.
- **Dead letter / failed state:** after final failure, mark the business record `FAILED` with a readable reason, log with `jobId`, and make it visible (admin screen or alert).
- **Timeouts:** every job has an expiry; long work is split into smaller jobs (fan-out per chunk/page).
- **Singleton / dedupe:** use singleton keys for jobs that must not run in parallel for the same entity.
- **Ordering:** don't assume order across jobs; if needed, chain jobs explicitly.
- **Enqueue with the transaction** when using pg-boss (business row + job commit together). With Redis queues, use an outbox table to avoid lost/phantom jobs.
- **Graceful shutdown:** workers stop taking jobs, finish or release active ones on SIGTERM.

### 9. Scheduling

- Recurring jobs (cleanup, report refresh, reminders) via the queue's scheduler with a cron and timezone stated explicitly (store UTC; business schedules may be IST).
- Scheduled jobs are idempotent and safe if two instances fire (singleton key).

### 10. Observability

- Log job start/finish/fail with `jobId`, type, `organizationId`, duration.
- Metrics/alerts: queue depth, oldest waiting job age, failure rate.
- Admin view (or SQL query) for failed jobs with retry action.

### 11. Testing

- Unit test handlers directly with fixtures.
- Test: duplicate execution (idempotency), retryable vs permanent error paths, cross-tenant payload rejected.

## Done checklist

- [ ] Cache added only after measurement; staleness accepted and documented
- [ ] Keys include tenant id + version; TTL + jitter set; invalidation on write
- [ ] App works when Redis is down
- [ ] Job payload IDs only; tenant re-check; idempotent
- [ ] Retries with backoff; permanent errors fail fast; failure visible to users/admins
- [ ] Timeouts, singleton keys, graceful shutdown
- [ ] Metrics/logs for queue depth and failures
