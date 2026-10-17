---
name: ui-page
description: Scaffold a screen or project tab in apps/web with packages/ui only - pick ListPage, DetailPage or FormPage (or inline states for a tab), React Query hooks, URL state, forms, the five required states, permission checks with <Can>, route and tests. Use when adding a page, a tab or a drawer form.
---

# UI page

Rules: `.claude/rules/web.md`. Components: `packages/ui/registry.json` (props and a usage example for each). State placement: `frontend-state`. Colors and spacing: `theme-management` (tokens only). The worked example is a **Milestones** tab with a create drawer plus a **Project settings** page; both were compiled, linted and tested in a scratch copy of this repository. Files: `templates/`.

## When to use

A new screen, a new tab on the project page, or a create / edit form. Not for API work (`api-module`).

## Pick the pattern first

| You are building | Use | Look at |
| --- | --- | --- |
| A routed list of records with search, table and paging | `ListPage` | `features/projects/ProjectsPage.tsx` |
| A routed record page with tabs | `DetailPage` (its `tabs` prop; keep the active tab in `?tab=`) | `features/projects/ProjectDetailPage.tsx` |
| A routed full-page form inside the app shell | `FormPage` | `templates/components.md` (Project settings) |
| A section inside a record's tab | No page pattern: render the five states inline | `MilestonesTab`, `features/decisions/components/DecisionsTab.tsx` |
| Create or edit over a list | `FormDrawer` + `useZodForm` | `CreateMilestoneDrawer`, `CreateProjectDrawer` |
| A server-driven table with sort and filters | `DataTable` (page owns the state) | `features/knowledge/components/KnowledgeList.tsx` |
| A standalone page outside the shell (sign-in, forced password change) | Centered `Card` | `LoginPage`, `ChangePasswordPage` |

## The five states (every screen)

| State | Trigger | Render |
| --- | --- | --- |
| loading | `query.isPending` | a skeleton (`TableSkeleton`, `CardListSkeleton`) or the pattern's `state="loading"` |
| empty | success with no items | `EmptyState` with an icon, a title and the next step; a different message when a search is active |
| error | `query.isError` | `PageError` with `errorMessage(error)` and `onRetry={() => void query.refetch()}` |
| no-access | `isForbidden(error)`, or the user lacks the permission | `NoAccess` |
| ready | data | the content |

`ListPage` takes `state` with exactly these five values. For a record that may not exist, treat a 404 as its own `EmptyState` ("not found"), as `ProjectDetailPage` does.

## Steps

Below, `<name>` is the feature folder, for example `milestones`.

1. **Plan first.** List the files and wait for approval. Confirm the endpoint and shared types exist (`api-module`) and that `pnpm build:packages` has been run.
2. **Query keys** in `src/lib/query-keys.ts`: a factory under the right group, with a prefix key so a mutation can invalidate the whole family (`templates/hooks.md`).
3. **Hooks** in `features/<name>/hooks/` (`templates/hooks.md`):
   - reads: `useQuery` / `useInfiniteQuery` with `apiClient.get<T>(...)`, DTO types from `@brd/shared`, `staleTime` from `STALE` (`@/lib/query-client`), `placeholderData: keepPreviousData` for paged lists;
   - writes: `useApiMutation` (`@/hooks/use-api-mutation`): it refreshes the listed keys and toasts. Set `errorToast: false` only when the screen shows the error itself (a form, a conflict);
   - filters, search and page live in the URL: `useUrlState(zodObject)` (`@/hooks/use-url-state`), every field with `.catch(default)`. Never Redux, never `fetch` or `axios`.
4. **Components** in `features/<name>/components/` (or `<Name>Page.tsx`). Functional components; logic in hooks; `@brd/ui` imports only. No inline `style`, no raw colors: use token classes (`text-muted-foreground`, `bg-surface`, `border-border`).
5. **Permissions.** Wrap buttons and menu items in `<Can permission={ProjectPermission.X} projectRole={project.myRole}>` or `<Can roles={['ORG_ADMIN']}>`; for logic use `useCan()`. `Can` answers "no" until the user is loaded. It only hides things: the API enforces every rule.
6. **Forms.** `useZodForm(schema)` with a schema from `packages/shared` (add a form-shaped schema there when the form edits text that the API stores as a date or null). Field errors via `FormMessage`; a failed save via `FormError`; drawers get `dirty={form.formState.isDirty}` so closing asks to discard.
7. **Route and navigation.**
   - New page: lazy-load it in `src/router.tsx` (`lazy(() => import('@/features/x/XPage').then((m) => ({ default: m.XPage })))`) under `ProtectedRoute` / `AppLayout`; wrap restricted areas in `<RoleGuard roles={[...]} />`. Add the nav item to `NAV_ITEMS` in `components/layout/AppLayout.tsx` (`roles: [...]` hides it from others) and a breadcrumb entry.
   - New project tab: add an entry to the `tabs` array in `ProjectDetailPage.tsx`. **Update `ProjectDetailPage.test.tsx`**: it asserts the exact tab list and count.
8. **Tests** (`templates/tests.md`), `*.test.tsx` next to the component, with `renderRoute` and `makeAuth` / `makeUser` from `@/test/render`; mock `@/lib/api-client` and `@/providers/auth-provider` as the templates do. Cover: loading, empty, error with retry, forbidden, the happy path, permission shown / hidden, and each interaction (submit with a validation error, successful submit, server error). Query by role and name.
9. **Verify.** `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

## Done checklist

- [ ] Pattern chosen from the table; only `@brd/ui` components; nothing re-created from the registry
- [ ] Loading, empty, error, no-access and ready all rendered and tested
- [ ] Data through `apiClient` in `features/<name>/hooks/`; keys from `query-keys.ts`; URL holds filters, search and page
- [ ] Writes use `useApiMutation`; `errorToast: false` only where the error is shown in place
- [ ] Buttons and menus that need a permission use `<Can>` / `useCan()`
- [ ] Forms: shared Zod schema, field errors, `FormError`, `dirty` on drawers
- [ ] Page lazy-loaded behind the auth / role guard; nav and breadcrumb added; tab list test updated for new tabs
- [ ] Tokens only, no inline styles or raw colors
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass

Related skills: `frontend-state`, `theme-management`, `performance-nfr`, `code-standards`, `api-module`.
