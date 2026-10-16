# Rules for apps/web/**

## Components

- Functional components with hooks only. No class components.
- Use components from `packages/ui` (check `ui/registry.json` for available components). Do not recreate existing UI primitives.
- Every screen must handle four states: **loading**, **empty**, **error**, and **no-access**.
- Keep components small and focused. Extract logic into custom hooks.

## State and data

- No business logic in components — extract to hooks (`use*.ts`) or shared utils.
- API calls go through a typed API client (`apiClient`), never raw `fetch` or `axios`.
- Colocate hooks with the feature they serve: `features/<name>/hooks/`.

## Routing

- One route file per feature area in `routes/`.
- Lazy-load page components with `React.lazy` + `Suspense`.
- Protect routes with auth guards; redirect unauthorized users.

## Styling

- Follow the project's styling approach (CSS modules / Tailwind / styled-components — whichever is configured).
- No inline styles except for truly dynamic values (e.g., calculated widths).

## Forms

- Validate form inputs with Zod schemas from `packages/shared`.
- Show field-level errors immediately; show form-level errors on submit.

## Testing

- Every page and complex component gets a Vitest + Testing Library test.
- Test user interactions and rendered output, not implementation details.
- Name test files `*.test.tsx` next to the source file.
