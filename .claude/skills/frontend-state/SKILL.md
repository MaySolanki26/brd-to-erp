---
name: frontend-state
description: Sarvadhi React state management standards — where each kind of state lives (React Query for server data, Redux Toolkit for global client state, URL for filters, component state for local UI), Redux slice rules, query keys and invalidation, and safe localStorage/sessionStorage usage. Use when adding Redux slices, API hooks, filters, persisted preferences, or any browser storage.
---

# Frontend State Management

## 1. Where state lives (decide first)

| Kind of state                    | Where                                                            | Example                                                                                       |
| -------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Server data** (from API)       | **React Query** (or RTK Query if the project standardizes on it) | projects list, customer detail                                                                |
| Shareable view state             | **URL search params**                                            | filters, sort, page, selected tab                                                             |
| Global client state (many pages) | **Redux Toolkit**                                                | sidebar collapsed, active organization switcher, multi-step wizard draft, notification center |
| Form state                       | react-hook-form + Zod                                            | create/edit forms                                                                             |
| Local UI state                   | `useState` / `useReducer`                                        | modal open, hover                                                                             |
| Persisted preferences            | localStorage via the storage wrapper                             | theme, table density, column visibility                                                       |
| Session identity                 | httpOnly cookies + `/auth/me` query                              | never in Redux persist or localStorage                                                        |

**Rule: never copy server data into Redux.** It duplicates the source of truth and goes stale. If a component needs API data, it uses the query hook.

Use one server-state library per project. If the project uses RTK Query, the React Query rules below apply to it the same way (tags = query keys).

## 2. React Query rules

- One hook per endpoint in `features/<feature>/api/`: `useProjectsQuery`, `useCreateProjectMutation`.
- **Query key factory** per feature:
  ```ts
  export const projectKeys = {
    all: ['projects'] as const,
    list: (params: ListProjectsQuery) => [...projectKeys.all, 'list', params] as const,
    detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
  };
  ```
- Include the **organization id** in keys when users can switch organizations (or clear the cache on switch).
- `staleTime` set per query: reference data (5–30 min), lists (30 s), detail (30 s), live status (0 + polling).
- Mutations: on success → `invalidateQueries` for affected keys + toast. Optimistic updates only for simple, reversible actions, with rollback on error.
- Polling only while needed (`refetchInterval` returns `false` when status is final).
- Responses validated with shared Zod schemas in the API client (fail loudly in development).
- On logout or 401-after-refresh-failure: `queryClient.clear()`.
- See `templates/query-hooks.md`.

## 3. Redux Toolkit rules

- Use only `@reduxjs/toolkit` (`createSlice`, `configureStore`). No legacy Redux patterns, no custom middleware without approval.
- One slice per feature in `features/<feature>/store/`; global app slices in `src/store/`.
- State is minimal and serializable (no class instances, Dates as ISO strings, no functions).
- Typed hooks only: `useAppDispatch`, `useAppSelector`.
- Selectors next to the slice; derived data via `createSelector` (memoized), not stored.
- Reducers stay pure; side effects go in React Query mutations or thunks (thunks only for client-side flows that are not API data).
- Reset relevant slices on logout (`resetAll` action handled by each slice or a root reducer reset).
- Persist only specific, small preference slices via the storage wrapper; **never** persist the whole store or anything containing personal data. Avoid `redux-persist` unless approved.
- See `templates/redux-slice.md`.

## 4. URL state rules

- Filters, search, sort, page, tab live in the URL so links are shareable and back/forward works.
- Parse and validate URL params with Zod; invalid params fall back to defaults.
- Debounce search before updating the URL.

## 5. Browser storage rules (localStorage / sessionStorage)

Allowed: UI preferences (theme, density, sidebar state, column visibility, last opened tab), non-sensitive drafts with user benefit.

**Forbidden:** access/refresh tokens, passwords, personal data (names, phones, emails of others), API responses with business data, permissions/roles (they are decided by the server).

Rules (all enforced by the wrapper in `templates/storage.md`):

1. Access only through the `storage` wrapper. No direct `localStorage.getItem` in components.
2. **Namespaced, versioned keys:** `{app}:{scope}:{name}:v{n}`, e.g., `erp:user:7f3a:table-density:v1`. User-specific preferences include the user id so shared computers don't mix them.
3. **Validate on read** with Zod; on failure, remove the key and return the default.
4. **try/catch** every access (private mode, quota exceeded, disabled storage). The app works without storage.
5. Size limit: keep each value small (< 10 KB); never store large lists.
6. **Clear user-scoped keys on logout.**
7. Version bump when the shape changes; old versions are removed on app start.
8. Cross-tab sync (if needed) via the `storage` event, validated the same way.
9. sessionStorage for per-tab temporary state only (e.g., wizard step), same rules.

## 6. Performance notes

- Select narrowly from Redux (`useAppSelector(selectSidebarCollapsed)`), not whole slices.
- Do not put rapidly changing values (mouse position, input keystrokes) in Redux.
- Large lists stay in React Query cache; paginate on the server.

## Done checklist

- [ ] State placed per the table in section 1
- [ ] No API data in Redux; query keys from the factory; invalidation on mutations
- [ ] Redux slices typed, serializable, reset on logout
- [ ] URL holds filters/sort/page
- [ ] Storage only via wrapper; no tokens/personal data; keys versioned and cleared on logout
