---
name: performance-nfr
description: Sarvadhi non-functional requirements and performance budgets — page load under 3 seconds (Core Web Vitals), API latency, bundle size, list/report limits, uploads, availability, scalability, and how to measure each. Use when building pages or APIs, writing NFRs in a BRD/spec, or investigating slowness.
---

# Performance and Non-Functional Requirements

Company target: **every page usable within 3 seconds.** "3 seconds" is defined below so it can be tested.

## 1. Test conditions (what "3 seconds" means)

- Device: mid-range Android phone or Lighthouse mobile emulation; desktop measured separately.
- Network: 4G ("Slow 4G" throttling in Lighthouse) for mobile; normal broadband for desktop.
- Data: realistic volume (production-like row counts per tenant, not an empty DB).
- Measured at the **75th percentile** of real users when monitoring is available.

## 2. Frontend budgets

| Metric                                | Target (good) | Hard limit |
| ------------------------------------- | ------------- | ---------- |
| LCP (main content visible)            | ≤ 2.5 s       | 3.0 s      |
| INP (response to clicks/typing)       | ≤ 200 ms      | 500 ms     |
| CLS (layout shift)                    | ≤ 0.1         | 0.25       |
| Route change in SPA (data shown)      | ≤ 1.0 s       | 2.0 s      |
| Initial JS (gzipped, entry chunk)     | ≤ 250 KB      | 350 KB     |
| Per-route chunk (gzipped)             | ≤ 100 KB      | 150 KB     |
| Lighthouse performance score (mobile) | ≥ 85          | 75         |

## 3. Backend budgets

| Endpoint type                | p95 target      | p99 limit                               |
| ---------------------------- | --------------- | --------------------------------------- |
| Simple read (by id)          | ≤ 150 ms        | 400 ms                                  |
| List with filters/pagination | ≤ 300 ms        | 800 ms                                  |
| Write (create/update)        | ≤ 500 ms        | 1.2 s                                   |
| Report (synchronous)         | ≤ 2 s           | 3 s, otherwise make it async            |
| Any request                  | —               | 30 s timeout; long work goes to a queue |
| Single DB query              | ≤ 50 ms typical | log anything > 200 ms                   |

## 4. Frontend rules

- **Code splitting per route** (`React.lazy` + `Suspense`); heavy libraries (charts, editors, PDF viewers) loaded only where used.
- No large libraries for small tasks (check bundle impact before adding; e.g., `date-fns` per-function imports, not moment).
- Images: correct size, modern formats (WebP/AVIF), `loading="lazy"` below the fold, width/height set (prevents CLS).
- Fonts: limited weights, `font-display: swap`, preload the primary font.
- Show skeletons immediately; never a blank screen while loading.
- Lists: server-side pagination/filter/sort; virtualize lists > 200 rows on screen.
- Avoid request waterfalls: load page data in parallel; prefetch next likely route/data on hover where useful.
- Debounce search inputs (300 ms); cancel outdated requests.
- Memoize only measured hot spots (`useMemo`, `React.memo`); don't wrap everything.
- Build: production mode, minified, gzip/brotli served, hashed assets with long cache (`immutable`).

## 5. Backend rules

- Pagination required on every list endpoint (max 100 per page).
- Follow `db-standards` indexing and no-N+1 rules; check `EXPLAIN` for new list/report queries.
- Response compression (gzip/brotli) for JSON > 1 KB.
- Return only needed fields; no huge nested payloads.
- Slow or failure-prone work → queue (`caching-and-queues`).
- Timeouts on every outbound call (DB, HTTP, LLM) with sensible defaults.
- Connection pooling sized to instances and DB limits.
- Caching only after measurement (`caching-and-queues`).

## 6. File and data limits (defaults, adjust per project)

- Upload size: 25 MB per file default; chunked/resumable for larger.
- Import: > 1,000 rows → async job with progress and error report.
- Export: > 10,000 rows → async job, file delivered by link.
- Reports: date range limits on synchronous reports; larger ranges async or from materialized views.

## 7. Other NFRs (include in every BRD/spec)

| Area            | Default                                                                       |
| --------------- | ----------------------------------------------------------------------------- |
| Availability    | 99.5% monthly for business apps (99.9% if contracted)                         |
| Backup          | Daily + point-in-time recovery; RPO ≤ 24 h (≤ 15 min if PITR); RTO ≤ 4 h      |
| Scalability     | Stateless API; horizontal scaling; target concurrent users stated in the spec |
| Browser support | Last 2 versions of Chrome, Edge, Safari, Firefox                              |
| Responsiveness  | Usable from 360 px width where mobile use is in scope                         |
| Accessibility   | WCAG 2.1 AA for user-facing apps                                              |
| Security        | see `security-compliance`                                                     |
| Observability   | Structured logs, request ids, error tracking, uptime monitoring               |
| Localization    | Timezone and currency rules stated (default IST, INR)                         |

State project-specific numbers (users, data volume, peak load) in the spec; budgets above are defaults.

## 8. How to measure

| What                   | Tool                                                 | When                                   |
| ---------------------- | ---------------------------------------------------- | -------------------------------------- |
| Page load (lab)        | Lighthouse / Lighthouse CI on key pages              | CI on PRs touching web; before release |
| Page load (real users) | `web-vitals` library → logs/analytics                | production                             |
| Bundle size            | `rollup-plugin-visualizer` / size-limit in CI        | every PR                               |
| API latency            | request duration in logs (pino-http) → p95 dashboard | always                                 |
| DB                     | `pg_stat_statements`, slow query log                 | weekly review                          |
| Load test              | k6 or Artillery on staging with realistic data       | before go-live, after big changes      |

## 9. CI enforcement

- size-limit (or equivalent) fails PR when budget exceeded.
- Lighthouse CI assertions on 3–5 key pages (login, main list, main detail, dashboard).
- Performance regressions > 20% need a written reason in the PR.

## Done checklist (page or endpoint)

- [ ] Route code-split; no heavy library added to the main bundle
- [ ] Skeleton/loading state; no layout shift
- [ ] Server pagination/filtering; queries indexed (`EXPLAIN` checked)
- [ ] Measured: LCP ≤ 2.5 s (mobile, 4G) / API p95 within budget on realistic data
- [ ] Long work async with progress
- [ ] Timeouts on outbound calls
