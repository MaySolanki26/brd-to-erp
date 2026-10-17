---
name: ui-page
description: Scaffold a new web screen or project tab in apps/web (route, page component, query hooks, apiClient integration, loading/empty/error/no-access states, test) using packages/ui components only. Use when adding a page or a tab.
---

# UI page

Reference feature: `apps/web/src/features/decisions/` (hook + tab + test). Page-level example: `features/projects/ProjectDetailPage.tsx`. Rules: `.claude/rules/web.md`. Available components: `packages/ui/registry.json`.

## Steps

1. **Plan first.** List the files and wait for approval. Confirm the API endpoint and shared types exist (see `api-module`); build shared with `pnpm build:packages`.
2. **Query keys** in `src/lib/query-keys.ts`: add a factory under the right group (for example `queryKeys.projects.decisions(id)`). Keep a prefix key so mutations can invalidate a whole family.
3. **Hooks in `features/<name>/hooks/use-<thing>.ts`.**
   - Reads: `useQuery` / `useInfiniteQuery` with `apiClient.get<T>(...)` and DTO types from `@brd/shared`; set `staleTime`; derive `getNextPageParam` from `page * pageSize < total`.
   - Writes: `useMutation` with `apiClient.post/put/patch/del`, then `invalidateQueries` on the affected keys. Never call `fetch` or `axios`.
   - Server data stays in React Query; filters belong in the URL (`useSearchParams`), not Redux (`frontend-state` skill).
4. **Components in `features/<name>/components/`** (or `<Name>Page.tsx` for a routed page). Functional components; logic in hooks. Use only `@brd/ui` imports (`Button`, `CardListSkeleton`, `EmptyState`, `NoAccess`, `PageError`, …). Every screen renders all four states:
   - loading: `isPending` → a skeleton (`CardListSkeleton`, `TableSkeleton`)
   - error: `isError` → `PageError` with `errorMessage(error)` and `onRetry={() => void query.refetch()}`
   - empty: success with no items → `EmptyState` with an icon, title and a next-step description
   - no access: `isForbidden(error)` (from `@/lib/error-message`) → `NoAccess`
5. **Route.** Pages are lazy-loaded in `src/router.tsx`:
   ```tsx
   const XPage = lazy(() => import('@/features/x/XPage').then((m) => ({ default: m.XPage })));
   ```
   Put it under `ProtectedRoute` / `AppLayout`; wrap with `RoleGuard roles={[...]}` for restricted areas, and add the nav entry in `components/layout/Sidebar.tsx`. For a project tab, add the value to the tab list in `ProjectDetailPage.tsx` (`?tab=` search param) instead of a new route.
6. **Forms.** Use `hooks/use-zod-form.ts` with the Zod schema from `packages/shared`; field errors immediately, form errors on submit.
7. **Styling.** The configured Tailwind tokens only (`text-foreground`, `bg-muted`, `border-border`); no inline styles except truly dynamic values; no hard-coded colours (`theme-management` skill).
8. **Test `*.test.tsx` next to the component** with Testing Library and `renderRoute` from `@/test/render`. Mock `@/lib/api-client` as in `DecisionsTab.test.tsx` and cover: loading, empty, error with retry, forbidden, the happy path, and each user interaction (load more, submit, delete). Query by role and name, not by implementation details.
9. **Verify.** `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

## Checklist

- [ ] Only `@brd/ui` components; nothing re-created from the registry
- [ ] Loading, empty, error and no-access all handled
- [ ] Data via `apiClient` in `features/<name>/hooks/`; keys in `query-keys.ts`
- [ ] Page lazy-loaded behind the auth/role guard
- [ ] Test covers all states and interactions

Related skills: `frontend-state`, `theme-management`, `performance-nfr`, `code-standards`.
