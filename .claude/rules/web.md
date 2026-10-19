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

## Template rules (UAB owner decisions; full text in `.claude/skills/SKILL.md`, audit in `docs/frontend/template-audit.md`)

- **Source of truth:** the template's own CSS, generated into `packages/ui/src/theme/template.css` with every class prefixed `uab-`. Style with `@brd/ui` components or `uab-*` classes; do not restyle with new Tailwind utilities, and do not copy markup from memory: check the reference app.
- **Type:** exactly three sizes: primary 18px, secondary 16px, supportive 13px. No other font sizes.
- **Controls:** buttons, icon buttons, compact inputs and selects are 32px; form inputs and selects 40px. Never set a height on a `Button`; use `size="icon"` and the `compact` prop on `Input`.
- **Page header:** no breadcrumbs and no title row in the page. The title (and its ⓘ description) is shown in the top bar through the page pattern's `title` and `info`.
- **Explanatory text** goes in `InfoTip` (ⓘ), not visible sentences. Data, statuses, errors, confirmation consequences and empty-state messages stay visible.
- **Popups:** no × icon on any dialog or drawer; every popup closes with a footer Cancel. Drawers are one width (560px).
- **Deleting, removing or discarding** always asks first with `confirmDelete()`; never a one-click delete and never `window.confirm`.
- **Missing values** use `EmptyValue` ("N/A"); **dates** use `DateText` ("16 Oct, 2026", full value on hover). No raw `toLocaleString` in tables.
- **Dropdowns:** never a native `<select>`. Use `SelectMenu`, `MultiSelectMenu` and `DatePicker`. Popups are `Dialog`, `Drawer` (through `FormDrawer`), `Popover` and `Menu`; there are no Radix dialog, select or tooltip wrappers any more (tooltips are `data-tooltip`).
- **Tables:** use `DataTable` (left-aligned columns, dot+text statuses, pinned Actions column, hover-only row checkboxes, frozen pagination). Truncated text reveals itself (`TruncatedText`).
- **Status** is a dot plus text (`StatusBadge`), never colour alone.
- **Colour:** semantic tokens only. Users may change the accent colour, sidebar colour and rail skin (`AppearanceMenu`); do not hardcode a colour or assume the default accent.
