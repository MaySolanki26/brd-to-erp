# Frontend template audit

Status: **audit written 2026-10-19; implemented the same day (see "Implementation status" at the end).** Sections 1 to 6 describe the template and the state of `apps/web` _before_ the work.
Date: 2026-10-19

## 0. Scope and sources

| Source             | Path                                                                                                                                                | What it is                                                                                                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Template           | `template/FE/`                                                                                                                                      | The "Universal Admin Builder 2.0" (UAB) skill package plus one built prototype, `template/FE/clinic-ops-admin/` (a clinic back-office app).                                                        |
| Your FE skills     | `.claude/skills/SKILL.md`, `UAB_2.0_Master_Specification_Enforced.md`, `UAB_2.0_Universal_Component_Library_Build_Blueprint.md`, `design-system.md` | Byte-identical copies of the template's `SKILL.md`, the two UAB documents and `references/design-system.md` (checked with `diff`). They are the same source as the template, not a second opinion. |
| Sarvadhi standards | `.claude/skills/frontend-state`, `theme-management`, `code-standards`, plus `ui-page` and `.claude/rules/web.md`, `AGENTS.md`                       | The rules this repository already follows.                                                                                                                                                         |
| Current app        | `apps/web`, `packages/ui`                                                                                                                           | What exists today.                                                                                                                                                                                 |

**Not covered or not verified.** I did not run the template or open it in a browser. I did not read the 5,078-line `app.css`, the full 823-line specification (sections 5 to 27 only by heading) or the blueprint body. Component props below come from the code signatures, and anything I did not read in full is marked "(signature only)". `template/BE` was not part of the request and was not read.

**How the UAB documents rank.** `SKILL.md` has a block "Project design rules (owner decisions, override the UAB defaults and the master specification)". That is 34 rules. This audit treats them as the template's real rule set. The specification and the template's own `tokens.ts` and README are older in places (see C24).

---

## 1. Template folder structure

```
template/FE/
├── SKILL.md                         Skill entry: mission, non-negotiables, 34 owner design rules, reading order
├── UAB_2.0_Master_Specification_Enforced.md    Locked design spec (823 lines)
├── UAB_2.0_Universal_Component_Library_Build_Blueprint.md   How to build the component library (498 lines)
├── references/                      Ten short topic files (architecture, design system, navigation/URLs, metadata,
│                                    components, workflows, enterprise services, integrations, security, quality)
├── agents/openai.yaml               Agent descriptor (not used by the app)
├── evals/, scripts/evaluate_skill.py   Static checks of the skill package only (not of app behaviour)
└── clinic-ops-admin/                The one built example app (Vite + React 18 + TypeScript, npm)
    ├── package.json                 4 runtime deps: react, react-dom, react-router-dom 6, lucide-react
    ├── vite.config.ts, tsconfig.json (strict + noUnused*), index.html
    ├── dist/                        Committed build output (should not be)
    └── src/
        ├── main.tsx, App.tsx        Entry; router, workspace gate, global hosts (toast, tooltip, confirm)
        ├── metadata/types.ts        Canonical contracts: Resource, Field, Master, Lifecycle, View, Filter, Role, Pack
        ├── domain/clinic/           The "domain pack": masters, 7 resources, 4 roles, modules, seed data, extensions
        ├── services/                The simulated server (runs in the browser): store, authz, runtime, validation,
        │                            filter, views, workflow, config, collab, scheduling, ledger, exporter, search,
        │                            settings, registry, hooks
        ├── components/
        │   ├── primitives/          Shared building blocks (button, dialog, drawer, select, date pickers, tooltip, ...)
        │   ├── shell/               AppShell (rail, sidebar, top bar, search palette), PageHeader, ThemePicker, help
        │   └── resource/            Metadata-driven data surfaces (grid, view bar, forms, inspector, board, calendar)
        ├── pages/                   Route-level pages: Dashboard, Resource (list/record), Work, Admin
        ├── tokens/                  tokens.css (primitive, semantic, component layers) and tokens.ts (status registry)
        ├── styles/app.css           One 5,078-line global stylesheet
        ├── lib/                     Pure helpers: dates, format, ids, palette, phi masking, routes, media queries
        └── test/                    Vitest files (10) plus setup
```

| Folder                  | Purpose                                                                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `metadata/`             | One typed definition of every resource and field. Grids, forms, filters, inspector and permissions all read it, so business meaning is defined once. |
| `domain/clinic/`        | Everything specific to the example domain. Swapping this folder is meant to retarget the app to another domain.                                      |
| `services/`             | A stand-in for a backend, written as plain functions over one JSON document. Marked in comments as "not a security boundary".                        |
| `components/primitives` | Domain-free UI parts. One implementation per concept.                                                                                                |
| `components/shell`      | The application frame and global navigation.                                                                                                         |
| `components/resource`   | Parts that take a `ResourceDefinition` and render a data surface.                                                                                    |
| `pages/`                | Routes that compose the above.                                                                                                                       |
| `tokens/`, `styles/`    | Design tokens and the single global stylesheet.                                                                                                      |
| `lib/`                  | Small pure utilities.                                                                                                                                |

Size: about 24,900 lines including docs; `AppShell.tsx` 811, `AdminPages.tsx` 983, `ViewControls.tsx` 740, `DataGrid.tsx` 566.

---

## 2. Component list

### 2.1 Primitives (`src/components/primitives/`)

| Name                                               | File                  | Purpose                                                                                                          | Key props                                                                                                     | Variants                                                                  |
| -------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `Button`                                           | `Button.tsx`          | Text button                                                                                                      | `variant`, `size`, `icon`, `iconRight`, `loading`, `disabledReason` (shown as tooltip and screen-reader text) | variant: primary, secondary, ghost, danger; size: default, compact (32px) |
| `IconButton`                                       | `Button.tsx`          | Icon-only button, always has a name and tooltip                                                                  | `icon`, `label`, `pressed`, `badge`, `disabledReason`, `variant`                                              | ghost, secondary                                                          |
| `Icon`                                             | `Icon.tsx`            | Looks up a lucide icon by string name                                                                            | `name`, `size` (16), `className`                                                                              | one icon set                                                              |
| `Dialog`                                           | `overlay.tsx`         | Centred modal; no × icon; footer Cancel                                                                          | `open`, `onClose`, `title`, `description`, `footer`, `size`, `role`                                           | size sm/md/lg; role dialog or alertdialog                                 |
| `confirmDelete` + `ConfirmHost`                    | `overlay.tsx`         | One-call global delete confirmation (alertdialog, Cancel focused, red confirm)                                   | `{title, message, confirmLabel, onConfirm}`                                                                   | none                                                                      |
| `Drawer`                                           | `overlay.tsx`         | Right-side panel, 560px, dimmed backdrop, header same height as the top bar                                      | `open`, `onClose`, `title`, `description`, `footer`, `wide`                                                   | normal, wide                                                              |
| `Popover`                                          | `overlay.tsx`         | Anchored floating panel with flip and clamp                                                                      | `open`, `onClose`, `anchor`, `label`, `width`, `align`                                                        | start/end                                                                 |
| `Menu`                                             | `overlay.tsx`         | Action menu from an anchor                                                                                       | `open`, `onClose`, `anchor`, `items`, `label`, `align`                                                        | items can be `danger`, disabled with reason, separated                    |
| hooks `useLayer`, `useFocusTrap`, `useFocusReturn` | `overlay.tsx`         | Shared Esc stack, focus trap and restore for every overlay                                                       |                                                                                                               |                                                                           |
| `SelectMenu`                                       | `SelectMenu.tsx`      | The one dropdown. Never native `<select>`                                                                        | `value`, `options`, `onChange`, `label`, `placeholder`, `disabled`, `invalid`, `block`, `searchable`          | 40px in forms, 32px compact; search box above about 8 options             |
| `MultiSelectMenu`                                  | `MultiSelectMenu.tsx` | Multi-value dropdown with search, "Select all", checkboxes, "N selected" footer                                  | `values`, `options`, `onChange`, `label`, `emptyLabel`, `block`, `invalid`, `disabled`                        |                                                                           |
| `DatePicker`                                       | `DatePicker.tsx`      | Custom calendar popover; never native date input                                                                 | `value`, `onChange`, `label`, `withTime`, `placeholder`, `invalid`, `disabled`, `block`, `clearable`          | date or date-time                                                         |
| `DateRangePicker`                                  | `DateRangePicker.tsx` | Two-month range picker for filters                                                                               | `value`, `onChange`, `label`                                                                                  |                                                                           |
| `StatusChip`, `Badge`                              | `feedback.tsx`        | Dot plus text status; label chip                                                                                 | `label`, `tone`                                                                                               | tone: neutral, info, success, warning, danger, accent                     |
| `Avatar`                                           | `feedback.tsx`        | Initials circle                                                                                                  | `name`, `size`                                                                                                |                                                                           |
| `EmptyState`, `ErrorState`, `NoAccess`, `Skeleton` | `feedback.tsx`        | The four screen states                                                                                           | `title`, `children`, `action`, `onRetry`, `what`, `rows`                                                      |                                                                           |
| `InlineAlert`                                      | `feedback.tsx`        | In-page message                                                                                                  | `tone`, `title`, `children`                                                                                   | info, warning, danger, success                                            |
| `MaskedField`                                      | `feedback.tsx`        | Shows masked value with an optional reveal                                                                       | `value`, `type`, `canReveal`                                                                                  | phone, email, identifier                                                  |
| `ToastProvider`, `useToast`                        | `feedback.tsx`        | Toasts                                                                                                           | `toast(message, tone)`                                                                                        |                                                                           |
| `Tabs`                                             | `feedback.tsx`        | Simple tab strip with counts                                                                                     | `tabs`, `value`, `onChange`, `label`                                                                          |                                                                           |
| `TooltipLayer`                                     | `TooltipLayer.tsx`    | The only tooltip: one layer at the app root, driven by `data-tooltip`; also reveals truncated text automatically | none (mounted once)                                                                                           |                                                                           |
| `InfoTip`                                          | `InfoTip.tsx`         | ⓘ icon that carries explanatory text                                                                             | `text`, `label`                                                                                               |                                                                           |
| `EmptyValue`, `DateText`                           | `display.tsx`         | Standard "N/A" and "16 Oct, 2026" rendering                                                                      | `label`; `value`                                                                                              |                                                                           |
| `OverflowChips`                                    | `OverflowChips.tsx`   | Chips on one line with "+N" and a list tooltip                                                                   | `items`, `label`, `tone`, `interactive`                                                                       |                                                                           |
| `ImageTile`, `PersonChip`, `AvatarStack`           | `People.tsx`          | Photo or initials, person line, overlapping avatars with people card                                             | `src`, `name`, `size`, `shape`; `people`, `max`                                                               | circle/rounded                                                            |
| `FadeScroller`                                     | `FadeScroller.tsx`    | Horizontal scroller that fades at the hidden edge                                                                | `children`, `label`                                                                                           |                                                                           |

### 2.2 Shell (`src/components/shell/`)

| Name          | Purpose                                                                                                      | Key props                                                                  | Notes                                                                                                                                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AppShell`    | Frame: `IconRail`, `ContextSidebar`, `TopBar`, canvas, mobile drawer, command palette                        | `children`                                                                 | Contains private parts: `IconRail`, `ContextSidebar` (resizable 200–360px, search, favourites, pins, recents, counts), `NavItem`, `FavStar`, `MobileNav`, `TopBar`, `WorkspaceSwitcher`, `NotificationBell`, `AccountMenu`, `CommandPalette` (Ctrl/⌘+K). 811 lines in one file. |
| `PageHeader`  | Puts the page title and ⓘ description into the top bar (portal to slot `topbar-title`), renders page actions | `title`, `description`, `actions` (`crumbs` accepted but unused by rule 1) |                                                                                                                                                                                                                                                                                 |
| `ThemePicker` | Theme (light/dark/system), rail skin, accent palette, custom palettes                                        | none                                                                       | Writes to the in-browser store.                                                                                                                                                                                                                                                 |
| `HelpContent` | Per-module help drawer text                                                                                  | `mod`                                                                      |                                                                                                                                                                                                                                                                                 |
| `ResetDialog` | Resets demo data                                                                                             | `open`, `onClose`                                                          | Prototype-only.                                                                                                                                                                                                                                                                 |

### 2.3 Resource surfaces (`src/components/resource/`)

| Name                                                      | Purpose                                                                                                                 | Key props (signature only)                                                                                                                                                                | Variants                                                                                                                     |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `DataGrid`                                                | The table                                                                                                               | `res`, `actor`, `rows`, `columns`, `onColumnsChange`, `sort`, `onSortChange`, `density`, `rowLines`, `groupBy`, `selected`, `onSelectedChange`, `activeId`, `onOpen`, `onEdit`, `rowMenu` | compact/comfortable; 1/2/3 lines per row; grouped; master-detail rows; mobile cards; resizable columns; sticky action column |
| `ViewBar`                                                 | Two-line toolbar: view tabs, "+" add view, unsaved-changes menu                                                         | `res`, `views`, `activeId`, `onSelect`, `actor`, `working`, `dirty`, `onReset`                                                                                                            | personal/team/org scope                                                                                                      |
| `FilterButton`, `FilterChips`, `ColumnManager`            | Filters panel (Apply/Clear plus advanced AND/OR builder), chips, column show/hide/order/pin                             | `res`, `actor`, `filter`, `onChange`                                                                                                                                                      |                                                                                                                              |
| `RecordInspector`                                         | Record drawer or full page: header with status, Details/Related/Activity/Comments tabs, workflow actions, edit in place | `resKey`, `recordId`, `onClose`, `siblings`, `onNavigate`, `variant`                                                                                                                      | `panel` (drawer), `page`                                                                                                     |
| `QuickComment`                                            | One comment composer with draft and `@` mentions                                                                        | `actor`, `resource`, `recordId`                                                                                                                                                           |                                                                                                                              |
| `FormDrawer`, `QuickCreateDialog`, `WizardDialog`         | Create/edit forms in a drawer, a dialog or a multi-step wizard                                                          | `resKey`, `recordId`, `open`, `onClose`, `initial`, `onSaved`/`onCreated`                                                                                                                 |                                                                                                                              |
| `useRecordForm`, `ConflictPanel`, `useUnsavedGuard`       | Form state, draft autosave, version-conflict resolution, discard guard                                                  |                                                                                                                                                                                           |                                                                                                                              |
| `FormSections`, `FormField`, `FieldInput`, `ErrorSummary` | Field renderers for the 17 field types; 1→2→3 columns by width                                                          | `field`, `access`, `values`, `setValue`, `error`, `actor`, `record`                                                                                                                       |                                                                                                                              |
| `FieldValue`, `MasterChip`                                | Read-only value rendering per field type                                                                                | `field`, `value`, `access`, `actor`, `linkRelations`, `rich`                                                                                                                              | rich = avatar + name view                                                                                                    |
| `BoardView`                                               | Kanban view                                                                                                             | `res`, `actor`, `rows`, `boardField`, `cardFields`, `onOpen`, `activeId`                                                                                                                  |                                                                                                                              |
| `CalendarView`                                            | Day/week time grid with lanes and overlap layout                                                                        | `res`, `actor`, `rows`, `onOpen`, `onCreateAt`, `activeId`, `date`, `onDateChange`                                                                                                        |                                                                                                                              |
| `BarChart`                                                | Small bar chart                                                                                                         | `data`, `label`, `unit`, `onSelect`                                                                                                                                                       |                                                                                                                              |
| `extensions.ts`                                           | Registry to add record actions and banners per resource                                                                 | `registerRecordActions`, `registerRecordBanner`                                                                                                                                           |                                                                                                                              |

### 2.4 Pages (`src/pages/`)

`DashboardPage` (stat tiles, charts, drill-down links), `ResourcePage` (list with view bar, filters, grid, footer pagination) and `RecordPage`, `SchedulePage`, `InboxPage` (approvals and tasks), `FullPageFormPage`, `MyWorkRedirect`, and the admin set `StudioPage` (configuration draft, validate, publish), `AccessPage`, `AuditPage`, `EventsPage`, `SettingsPage`.

### 2.5 Field types in the metadata

`text, longtext, email, phone, identifier, number, money, date, datetime, boolean, master, multimaster, relation, progress, lineitems, image, people`. Each field can carry `sensitivity` (none, contact, identifier, health, financial), `visibleWhen`/`requiredWhen` conditions, `readOnly`/`computed`/`system`, and `subFields` for rich rows.

---

## 3. Patterns used in the template

| Area                        | What the template does                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Routing**                 | React Router 6, `BrowserRouter`, nested `<Routes>`. URL contract `/o/:org/w/:ws/:module/:resource[/:recordId[/edit]]`, `?view=`, `?peek=:id` for the drawer, `/u/:user/my-work`. A `WorkspaceGate` resolves slugs. Routes are generic over the resource registry (`:module/:resource`), not one file per feature. No lazy loading, no route-level auth guard, no error boundary per route.               |
| **Layout**                  | Four regions: IconRail (60px) · ContextSidebar (240px, resizable, collapsible, favourites) · canvas · optional inspector drawer. Page title lives in the top bar with an ⓘ for the description; global search is centred; no breadcrumb row. List pages are full-white, table edge to edge. Phone and tablet breakpoints at 760 and 1100px with a nav drawer.                                            |
| **API client**              | None. `services/*` are synchronous functions over an in-browser store and `Query`/`WriteOptions` shapes meant to mirror a future API (idempotency keys, expected-version checks, `ServiceError`).                                                                                                                                                                                                        |
| **Data fetching**           | None. Components subscribe with `useSyncExternalStore` (`useRevision`, `useActor`) and re-read the store on every commit. No caching, loading or error lifecycle from a network.                                                                                                                                                                                                                         |
| **State**                   | No Redux, no React Query. Server-like state is one global store (`db.ts`: `getDb`, `commit`, `subscribe`). View state is local `useState` plus URL params and saved views. Personal settings sit inside the same store.                                                                                                                                                                                  |
| **Forms**                   | Metadata-driven: `useRecordForm` builds values from `ResourceDefinition`, `FormSections` lays out fields by container width. Draft autosave, unsaved-changes guard, version-conflict panel, wizard mode, line-item repeater. Not react-hook-form.                                                                                                                                                        |
| **Validation**              | Hand-written in `services/validation.ts` (required, conditional required, number min/max, line items, uniqueness). No Zod. Server-side re-validation is described but not present.                                                                                                                                                                                                                       |
| **Tables**                  | One custom `DataGrid`: sortable, resizable and pinned columns, column manager, density, grouping, master-detail rows, bulk actions on the search line, inline cell edit, row checkboxes hidden until hover, numbered pagination footer (25/50/100). Filtering, sorting and paging run client-side in `queryRecords`. Saved views with personal/team/org scope.                                           |
| **Theme**                   | Token layers primitive (`--p-*`) → semantic (`--s-*`) → component (`--c-*`) in `tokens.css`. Light default, dark through `prefers-color-scheme` and `[data-theme='dark']`. Four rail skins. Accent palettes, including user-defined hex palettes with automatic AA contrast correction (`lib/palette.ts`). Three text sizes only (18/16/13). Reduced-motion and coarse-pointer media queries.            |
| **localStorage**            | The entire database (records, views, comments, approvals, audit, session, settings, drafts) is one JSON value under `uab.clinic-ops.db.v1`, schema-versioned, read with try/catch but not schema-validated, synced across tabs by the `storage` event.                                                                                                                                                   |
| **Permissions**             | In-browser `authz.ts`: role → resource permissions (`read: all/own/none`, create, update, delete, export), field access (`edit/view/mask/hide`) from sensitivity classes plus overrides, workspace isolation, capabilities (`can(actor, 'config.publish')`). The UI hides or disables by these results and explains disabled controls through `disabledReason`. Documented as "not a security boundary". |
| **Tooltips, help**          | One global tooltip layer; ⓘ `InfoTip` for all explanatory text.                                                                                                                                                                                                                                                                                                                                          |
| **Testing**                 | Vitest + Testing Library, 10 files in `src/test/`, mostly service contracts and a few component tests. No lint config, no Prettier.                                                                                                                                                                                                                                                                      |
| **Code quality (measured)** | No `any`, `@ts-ignore` or `console`. About 80 non-null assertions (`x!`), none with a comment. 31 inline `style={{}}` and 3 hex literals in components. Several files hold many components (`feedback.tsx`, `overlay.tsx`, `AppShell.tsx`, `AdminPages.tsx`).                                                                                                                                            |

---

## 4. Conflicts

Each item: what the template/UAB skill says, what the Sarvadhi standards (or this repo) say, and a recommendation. **Decision** is left blank for you.

### C1. Technology stack and dependencies

- **Template:** React 18, React Router 6, npm, one hand-written 5,078-line CSS file, lucide-react 0.460. Four runtime dependencies. UAB: "preserve existing dependencies unless replacement is explicitly authorized".
- **Standards / repo:** React 19, React Router 7, pnpm, Tailwind 3 + Radix + class-variance-authority, TanStack Query and Table, react-hook-form, Zod, lucide-react 1.57. "No new dependency without asking."
- **Recommendation:** Keep our stack. Do not copy the template's package set or its CSS file. Treat the template as a behaviour and visual specification, not as code to paste.
- Decision: ______

### C2. Where shared UI lives

- **Template:** builds all primitives itself (Button, Dialog, Drawer, SelectMenu, ...). UAB: "one shared implementation per component family".
- **Standards:** `packages/ui` only; features must not create primitives; web rules say check `ui/registry.json` first.
- **Recommendation:** Implement every template component as an addition or change in `packages/ui` (and `registry.json`), never inside `apps/web`. This also keeps UAB's "single implementation" goal.
- Decision: ______

### C3. State management and data fetching

- **Template:** a global in-browser store read through `useSyncExternalStore`; no request lifecycle.
- **frontend-state:** server data in React Query with a key factory, per-query `staleTime`, polling only while needed; filters/sort/page in the URL validated with Zod; Redux Toolkit only for cross-page client state; never copy server data into Redux.
- **Recommendation:** Keep React Query + URL state (already in `apps/web`). Do not adopt the revision-subscription store. Redux stays unused until a real cross-page client state appears (none exists today).
- Decision: ______

### C4. Browser persistence

- **Template:** the whole app database, including the signed-in user id and role, saved views, drafts and comments, lives in one localStorage key; the user can reset it.
- **frontend-state:** localStorage only for UI preferences; forbidden: tokens, roles/permissions, business data, personal data. Access only through the storage wrapper; namespaced versioned keys `{app}:{scope}:{name}:v{n}`; Zod-validate on read; clear user-scoped keys on logout. `code-standards` also says validate localStorage reads with Zod. The repo already has `apps/web/src/lib/storage.ts` and `safeStorage` in `packages/ui`.
- **Recommendation:** Per-user UI preferences (sidebar width and collapsed, density, theme, favourites, recents, column choices) go through the wrapper. Saved views, comments and drafts that matter must be server data (new API) or dropped. Do not store session or role.
- Decision: ______

### C5. Permissions

- **Template:** a client-side policy engine with row scope, field access and masking, and a capabilities list; UI shows what the engine says.
- **Standards / repo:** `<Can>` and `useCan()` only hide; the API decides; the access model is org roles plus project roles with 404 for no access.
- **Recommendation:** Keep `<Can>`/`useCan`. Reuse the template's presentation rules only: disabled controls explain why (`disabledReason`), and masked values display as masked when the API sends them masked. Do not port `authz.ts`.
- Decision: ______

### C6. Token naming and layers

- **Template:** `--p-*` primitives, `--s-*` semantic, `--c-*` component; `--uab-*` locked geometry; accent purple `#5b47c7`.
- **theme-management:** semantic `--color-*`, `--space-*`, `--radius-*`, `--shadow-*`, `--font-*`/`--text-*`, `--z-*`, `--duration-*`; tokens in `packages/ui/src/theme/tokens.css`; components use semantic tokens only; lint blocks hex outside the theme folder. Current tokens store RGB triplets for Tailwind alpha and use indigo `79 70 229` as primary.
- **Recommendation:** Keep our names and the Tailwind mapping. Add the missing template tokens (rail, sidebar, view tab height, control heights, grid header/row hover, empty-value colour) as new semantic or component tokens. Decide whether the accent changes to purple or stays indigo.
- Decision (names): ______ Decision (accent): ______

### C7. Type scale

- **Template (owner rule 8):** exactly three sizes: 18 primary, 16 secondary, 13 supportive; 16px on phone inputs.
- **theme-management and repo:** a full scale; Tailwind sizes are shifted (`text-sm` 11px, `text-lg` 13px, `text-2xl` 16px, up to 30px) and components use many of them.
- **Recommendation:** Adopt the three roles as named aliases (`--fs-primary/secondary/supportive`) and migrate shell, tables, forms and dialogs to them. Leave the larger sizes for the dashboard and login only. Needs a design call because "no other font sizes anywhere" is stricter than our scale.
- Decision: ______

### C8. Control heights

- **Template (rule 7):** 32px for every button, icon button, compact input and view tab; 40px in forms; 44px touch.
- **Repo:** `Button` default `h-10`, input `h-10`, small `h-8`, icon-sm `h-8`.
- **Recommendation:** Add `--control-h-compact: 32px` and make compact the default in toolbars and tables; keep 40px in forms. Remove per-screen height overrides.
- Decision: ______

### C9. Theme switching and branding

- **Template:** system/light/dark plus four rail skins plus user-created accent palettes (any hex, contrast auto-corrected). Preference saved in the app store.
- **theme-management:** `ThemeProvider`/`useTheme` are the only readers; preference saved by the storage wrapper; inline script in `index.html` prevents a flash; tenant branding may change only specific semantic tokens, never danger/success or text contrast, and contrast is validated on save.
- **Recommendation:** Keep `ThemeProvider`. Add rail skins only if you want a dark rail; skip user-defined hex palettes (not needed for this product, and they widen the contrast risk). If kept, restrict them to accent and reuse the template's contrast check.
- Decision: ______

### C10. Hex colours and inline styles

- **Template:** hex in `tokens.css` (fine), but also 3 hex literals and 31 inline styles in components (people avatars, dynamic widths).
- **Standards:** no hex outside the theme folder (lint enforced), no inline styles except truly dynamic values.
- **Recommendation:** Port dynamic ones only (avatar hue, column width, resize). Remove the hex literals when porting.
- Decision: ______

### C11. Page chrome: breadcrumbs, header, search

- **Template (rules 1, 2):** no breadcrumb row; title and ⓘ in the top bar; global search centred; workspace switcher, notifications and account at right.
- **Repo / ui-page skill:** `AppHeader` with `Breadcrumbs`; `InformativeBar` for the page title row; the ui-page checklist says "add a breadcrumb entry" for every new page; `BREADCRUMB_MAP` in `AppLayout`.
- **Recommendation:** Follow the owner rule: remove breadcrumbs, move titles into the top bar, add the search entry (`cmdk` is already in `packages/ui`). Update `ui-page` and `registry.json` text that mentions breadcrumbs. The back-button case on detail pages needs a small decision.
- Decision: ______

### C12. Dialogs, drawers, confirmations

- **Template (rules 28, 30):** no × on any popup; every popup closes with a footer Cancel; drawer 560px with header height equal to the top bar; delete uses one global `confirmDelete` alertdialog; no `window.confirm`.
- **Repo:** Radix `Dialog` and `Sheet` draw an × by default (`hideCloseButton` exists on Dialog); `FormDrawer` has submit footer and `DiscardGuard`; `ConfirmDialog` is a controlled component with optional typed confirmation; `AlertDialog` primitive exists.
- **Recommendation:** Hide the × everywhere and add the footer Cancel; set drawer width and header height from tokens. Keep our controlled `ConfirmDialog` (it supports typed confirmation, which the template lacks) and add a thin `confirmDelete()` helper over it so call sites stay one line.
- Decision: ______

### C13. Dropdowns, dates and empty values

- **Template (rules 9, 14, 15, 24, 26):** custom `SelectMenu`, `MultiSelectMenu`, `DatePicker`; dates shown "16 Oct, 2026" with the full value in a tooltip; missing values show italic "N/A" via `EmptyValue`; no spinners on number inputs.
- **Repo:** Radix `Select` (not native, but values cannot be empty strings and there is no built-in search or "None"); `multi-select`, `DatePicker`, `DateRangeControl` exist; date and empty-value formats are not standardised (not checked per screen).
- **Recommendation:** Extend our primitives to meet the behaviour list (search above 8 options, None for optional fields, type-to-jump) rather than replacing them. Add `DateText` and `EmptyValue` to `packages/ui` and use them in all tables.
- Decision: ______

### C14. Tooltips

- **Template (rules 12, 13):** one global layer driven by `data-tooltip`; no native `title`; truncated text reveals itself automatically.
- **Repo:** Radix `Tooltip` per element (needs `TooltipProvider`), plus `TruncatedText`.
- **Recommendation:** Keep Radix (accessible, already used). Use `TruncatedText` in every table cell to meet rule 13. Do not add a second tooltip system.
- Decision: ______

### C15. Explanatory text

- **Template (rules 19, 23):** descriptions and help text appear only inside ⓘ tooltips; never the same information twice.
- **Repo:** `FormDrawer`, `EmptyState`, `InformativeBar` and many tabs print visible descriptions.
- **Recommendation:** Adopt for page, drawer and field descriptions. Keep visible text for data, statuses, errors and empty-state messages (the template allows those too).
- Decision: ______

### C16. Forms and validation

- **Template:** metadata-driven form renderer with hand-written validation; fields flow 1→2→3 per row by container width; section titles hidden; no number spinners.
- **Standards:** react-hook-form with `useZodForm`; shared Zod schemas from `packages/shared`; validation of every external input with Zod; field errors via `FormMessage`, form errors via `FormError`.
- **Recommendation:** Keep RHF + Zod. Take the template's layout rules (responsive columns, aligned label rows, in-input prefixes and suffixes) into a shared form-grid component.
- Decision: ______

### C17. Table architecture and saved views

- **Template:** client-side grid driven by metadata; saved views stored locally with personal/team/org scope; advanced AND/OR filter builder; all data loaded in the browser.
- **Standards / repo:** server-driven `DataTable` (TanStack), sort/filter/page in the URL (`useUrlState`), `DataTablePagination`; the API paginates.
- **Recommendation:** Keep the server-driven approach; restyle to the template's table rules and pagination footer; build column manager, density and sticky action column in `packages/ui`. Saved views and the AND/OR builder are new product scope: they need API work, so decide whether they are in or out.
- Decision: ______

### C18. Routing structure

- **Template:** generic metadata routes under `/o/:org/w/:ws/...`, no lazy load, no auth guard.
- **web rules:** one route file per feature, `React.lazy` pages, auth guards and redirects. The repo uses `createBrowserRouter`, lazy pages, `ProtectedRoute`, `RoleGuard`, `?tab=`.
- **Recommendation:** Keep our routes. The org/workspace slugs have no counterpart (one organization per user, projects are the container). Adopt only `?peek=` style URLs if you want drawers to be deep-linkable.
- Decision: ______

### C19. File naming and component granularity

- **Template:** PascalCase files; several components per file; 811 and 983-line files.
- **code-standards:** kebab-case files, one component per file, small functions. The existing repo actually uses PascalCase for component files (`ProjectDetailPage.tsx`) and kebab-case for hooks and libs, so the written rule and the repo already differ.
- **Recommendation:** One component per file, split anything over about 300 lines. For file case, follow what the repo does today (PascalCase components) and fix the written standard instead of renaming files.
- Decision: ______

### C20. TypeScript strictness and tests

- **Template:** about 80 non-null assertions without comments; tests in `src/test/`; no ESLint or Prettier; explicit return types missing.
- **Standards:** `!` only with a comment; explicit return types on exports; tests as `*.test.tsx` next to the source; ESLint `no-console`/`no-explicit-any`; every page and complex component has a test.
- **Recommendation:** Treat template code as pseudo-code; every ported component gets a colocated test and passes our lint.
- Decision: ______

### C21. Overall architecture: metadata-driven vs feature folders

- **Template:** one `ResourceDefinition` drives grid, forms, filters, inspector and permissions; "do not duplicate business meaning".
- **code-standards / ui-page:** `features/<feature>/{api,components,pages}` with one React Query hook per endpoint and explicit page patterns.
- **Recommendation:** Keep feature folders. The three knowledge lists (requirements, rules, modules) are the one place a small shared column/field config makes sense (`KnowledgeList` already does this). A full metadata runtime is not justified for this product.
- Decision: ______

### C22. Honest-prototype labelling

- **Template:** label synthetic data and local-only persistence; no pretend sign-in, upload or send.
- **Repo:** real API and auth; no conflict. Only relevant if any ported screen is built before its API exists. Rule: do not ship a control that does nothing.
- Decision: ______

### C23. Icons

- **Template:** `<Icon name="calendar">` string lookup.
- **Repo:** direct lucide imports (type-safe, tree-shaken).
- **Recommendation:** Keep direct imports. No string-name icon component.
- Decision: ______

### C24. Inconsistencies inside the template itself

These are not conflicts with Sarvadhi, but they need an answer before anything is built from them.

| Topic                  | One place says                                                        | Another says                                                       |
| ---------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Compact control height | Spec: 36px                                                            | Owner rule 7 and `tokens.css`: 32px                                |
| Nav row height         | Spec and `tokens.ts`: 34px                                            | Owner rule 33: 30px rows                                           |
| Section label size     | `tokens.ts`: 12px                                                     | Owner rule 8 and `tokens.css`: 13px                                |
| Inspector              | Spec and `tokens.ts`: 480px, expandable                               | Owner rule 28: 560px modal drawer, no ×, footer Cancel             |
| Relation lookups       | Owner rule 9: never native `<select>`                                 | Template README: native `<select>` still used for relation lookups |
| Breadcrumb             | Spec §4 lists Breadcrumb                                              | Owner rule 1: none                                                 |
| Phone mask example     | README notes the spec example `+91*******10` contradicts its own rule |                                                                    |

**Recommendation:** Use the owner rules in `SKILL.md` as the source and ignore the older values. Confirm that is what you want.

- Decision: ______

---

## 5. Gap list: current `apps/web` and `packages/ui` against the template

Legend: **Must** = needed to match the template rules you listed as owner decisions; **Product call** = needs a scope decision (see section 4); **N/A** = belongs to the clinic domain, not this product.

### 5.1 Foundation

| #   | Area                          | Template                                                                                    | Current                                                              | Change                                                       | Type                  |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------- |
| G1  | Type scale                    | 3 sizes, 18/16/13                                                                           | 9–30px scale; `text-lg` = 13px                                       | Add the 3 role tokens; migrate shell, tables, forms, dialogs | Must (C7)             |
| G2  | Control height                | 32 compact / 40 form / 44 touch                                                             | `h-10` default; `h-8` only on small and icon-sm                      | Add compact token; make toolbars and tables use it           | Must (C8)             |
| G3  | New tokens                    | Rail, sidebar, view tab height, grid header/row hover, empty-value colour, z-layers, motion | Partial (sidebar background, spacing, radius, font)                  | Add the missing ones to `tokens.css` and the Tailwind preset | Must                  |
| G4  | Dark mode flash               | Inline script before render (theme skill)                                                   | Check `index.html`                                                   | Verify; add if missing                                       | Must (verify)         |
| G5  | Accent and rail skins         | Purple accent, four rail skins                                                              | Indigo accent, no rail                                               | Decide accent; add rail skins only if an icon rail is built  | Product call (C6, C9) |
| G6  | Lint for hex and inline style | Template breaks it                                                                          | `@brd/ui` has `check-no-hardcoded-colors.mjs`; web has no style lint | Extend the check to `apps/web`                               | Should                |

### 5.2 Shell and navigation

| #   | Area                        | Template                                                                                                   | Current                                             | Change                                                                                                                | Type                     |
| --- | --------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| G7  | Icon rail + context sidebar | Two columns, module icons, resizable sidebar, section separators, "Find a page", favourites, pins, recents | One collapsible sidebar (`AppSidebar`) with 3 items | Decide if a rail is needed for 3 pages; at least add sidebar resize, section labels and favourites if you want parity | Product call             |
| G8  | Top bar                     | Title + ⓘ left, centred global search, switcher, notifications, account right                              | `AppHeader` with breadcrumbs and user menu          | Move titles into the bar, remove breadcrumbs, add search entry                                                        | Must (C11)               |
| G9  | Command palette (Ctrl/⌘+K)  | Pages, views, records, exact ID                                                                            | None (`command.tsx` primitive only)                 | Build over a search endpoint; scope to projects, items, questions                                                     | Product call (needs API) |
| G10 | Notifications               | Bell with read, snooze, mark all                                                                           | None                                                | Needs a notifications API                                                                                             | Product call             |
| G11 | Mobile navigation           | Rail and sidebar become a drawer                                                                           | `AppSidebarMobile` exists                           | Verify against the template's phone rules                                                                             | Should                   |
| G12 | Page header                 | ⓘ description, never visible text                                                                          | `InformativeBar` with visible info                  | Add `InfoTip`; remove visible descriptions                                                                            | Must (C15)               |

### 5.3 Overlays and feedback

| #   | Area                | Template                                                            | Current                                                             | Change                                                             | Type       |
| --- | ------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------- |
| G13 | Close icon          | None on any popup                                                   | × on `Dialog` and `Sheet`                                           | Hide the ×; add footer Cancel to every popup                       | Must (C12) |
| G14 | Drawer              | 560px, header height = top bar, Edit in footer, prev/next in header | `FormDrawer` and `Sheet`, width varies                              | Standardise width, header and footer                               | Must       |
| G15 | Delete confirmation | `confirmDelete()` + `ConfirmHost`                                   | `ConfirmDialog` per call site                                       | Add helper over `ConfirmDialog`; audit every delete/discard/remove | Must       |
| G16 | Tooltips            | One layer, auto-reveal of truncated text                            | Radix per element; `TruncatedText`                                  | Use `TruncatedText` in all table cells; add `InfoTip`              | Must (C14) |
| G17 | Empty value         | Italic "N/A", no icon                                               | Not standardised                                                    | Add `EmptyValue`; replace "—" and blanks                           | Must       |
| G18 | Date text           | "16 Oct, 2026" + tooltip "Fri, 16 Oct 2026 08:30 AM"                | Check per screen                                                    | Add `DateText`; replace raw date formatting                        | Must       |
| G19 | Toasts, states      | Toast; Empty/Error/NoAccess/Skeleton                                | Present (`toast`, `EmptyState`, `PageError`, `NoAccess`, skeletons) | None; keep five states                                             | OK         |

### 5.4 Inputs

| #   | Area          | Template                                                                             | Current                                             | Change                               | Type       |
| --- | ------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------- | ------------------------------------ | ---------- |
| G20 | Single select | Search above 8 options, None, type-to-jump, flips up                                 | Radix `Select`, no search, no empty value           | Extend or wrap                       | Must (C13) |
| G21 | Multi select  | Search, Select all, checkboxes, "N selected", chips with +N                          | `multi-select` exists                               | Compare behaviour; add missing parts | Should     |
| G22 | Date pickers  | Sunday-first grid, ringed today, Today/Clear, time row, range with two months        | `DatePicker`, `DateRangeControl` (react-day-picker) | Compare and adjust                   | Should     |
| G23 | Number input  | No spinners                                                                          | Not checked                                         | Add style                            | Should     |
| G24 | Form layout   | 1→2→3 columns by width; hidden section titles; aligned label rows; in-input prefixes | Per-form layout                                     | Shared form grid in `packages/ui`    | Must (C16) |

### 5.5 Data surfaces

| #   | Area                   | Template                                                                                                                 | Current                                                   | Change                                                              | Type                |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------- | ------------------- |
| G25 | Table look             | Borderless, white, edge to edge, 13px, left-aligned, status as dot + text, sticky Actions with shadow only when scrolled | `DataTable` (TanStack) in card style                      | Restyle per rules 4 and 17                                          | Must                |
| G26 | Table behaviour        | Resize handles, pinned actions column, row checkbox on hover, bulk actions on the search line, expandable rows, grouping | Sort, pagination, search, filters, selection, row actions | Add resize, hover checkbox, bulk-actions placement, expandable rows | Should              |
| G27 | Pagination footer      | Fixed footer, "1–25 of N", numbered pages, "25 / page" dropdown opening upward                                           | `DataTablePagination`                                     | Restyle and make frozen                                             | Must                |
| G28 | Toolbar                | Two lines: view tabs + add + Export + primary; then search, Filters ⌄, Columns ⌄, count/bulk                             | `ListPage` with `toolbar` slot and `ActionBar`            | Rebuild toolbar to the two-line layout                              | Must                |
| G29 | Filters                | Apply/Clear form panel; advanced AND/OR builder; chips for dates                                                         | `FilterButton`, `DataTableToolbar` filters (select-based) | Add panel; builder is Product call                                  | Must / Product call |
| G30 | Saved views            | Personal/team/org, unsaved menu, default, share link                                                                     | None                                                      | Needs API and permissions                                           | Product call (C17)  |
| G31 | Column manager         | Search, show/hide, reorder, pin, persist                                                                                 | None                                                      | Add; persist through the storage wrapper                            | Should              |
| G32 | Overflow chips, people | `OverflowChips`, `AvatarStack` with people card, rich 2/3-line rows                                                      | `AvatarGroup`, `UserAvatar`                               | Add `OverflowChips`; people card if needed                          | Should              |
| G33 | Record inspector       | Drawer with Details/Related/Activity/Comments, prev/next, one comment composer                                           | `SourceChunkDrawer`, Decisions tab, no generic inspector  | Decide if items (requirements, rules, questions) get an inspector   | Product call        |
| G34 | Board, calendar        | Kanban and calendar views                                                                                                | None                                                      | Likely N/A for BRD review; board by status could fit                | Product call        |
| G35 | Dashboard              | Stat tiles and charts with drill-down                                                                                    | `DashboardPage`, `StatCard`                               | Align look; charts only if wanted                                   | Should              |

### 5.6 Foundations in the template that this product does not need

N/A: scheduling and room conflicts, billing and payments, PHI masking, role switcher with demo users, workspace/organization slugs and switcher, configuration studio, simulated workflow approvals (the product has its own report approval in the API), simulated audit and event trace pages (real audit exists server-side, no screen), simulated messaging, `Import studio`.

### 5.7 Process gaps

| #   | Gap                                                                                                                                                                | Change                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G36 | `ui-page` and `registry.json` still describe breadcrumbs and visible descriptions                                                                                  | Update after C11 and C15 are decided                                                                                                                                                                                                   |
| G37 | No visual or accessibility evidence for the template                                                                                                               | Before porting, run the template and capture 1440/768/390px screenshots to compare against; test keyboard, zoom 200% and contrast. The template's own README lists screen reader, zoom, forced colours, axe and contrast as not tested |
| G38 | `registry.json` has no entry for the new shared pieces (`InfoTip`, `EmptyValue`, `DateText`, `OverflowChips`, `confirmDelete`, form grid, column manager, toolbar) | Add as each one is built                                                                                                                                                                                                               |

---

## 6. Suggested decision order

1. **C1, C2, C21** (stack, where UI lives, architecture). Everything else depends on these. Recommendation: keep stack, extend `packages/ui`, keep feature folders.
2. **C6, C7, C8, C9** (tokens, type scale, control height, theme). Decides the look and affects every file.
3. **C11, C12, C15** (page chrome, overlays, explanatory text). The most visible changes.
4. **C17, G9, G10, G30** (saved views, search, notifications). These need new API work and are a scope question.
5. Everything else follows the recommendations above.

Nothing has been implemented. After you decide, the next step is a plan listing the files to change, as the project rules require.

---

## 7. Implementation status (2026-10-19, second pass)

The first pass restyled our components from the written rules and did not match the template closely. The second pass reuses the template itself:

- `packages/ui/scripts/build-template-css.mjs` builds `src/theme/template.css` and `template-tokens.css` from the reference app's stylesheet, with every class prefixed `uab-` so it cannot collide with Tailwind. `src/theme/template-extras.css` holds the few pieces the template does not have (sign-in page, file drop target, upload rows, inspector body).
- The template primitives (button, icon, overlays, select, multi-select, date picker, chips, tabs, tooltips) live in `packages/ui/src/uab/` and are exported through `@brd/ui`. Our public component names stay; their markup is the template's.
- Colour themes (palettes) are in `packages/ui/src/theme/palette.ts`. The default palette is the template violet (`#5b47c7`); Indigo is a preset. People can pick a preset or create, edit and delete their own, and the accent, sidebar and icon rail follow.
- The Radix wrappers for select, dialog, alert dialog, sheet, popover, dropdown, context menu, tooltip, tabs, accordion, collapsible, command, calendar, stepper, slider and the old multi-select and date range control were removed. Nothing in `apps/web` uses them.
- Converted screens: sign-in and change password, shell (rail, sidebar, top bar), Projects, Team, Dashboard, project detail tabs (Overview, Sources, Requirements, Rules, Modules, Questions, Decisions, Members), drawers and dialogs, upload drop target and queue, `/design` sample page.

### Still open

| Item                                | Note                                                                                                                                                                          |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard                           | Stat tiles and one panel. The reference dashboard cards with sparklines are not built.                                                                                        |
| Report tab                          | Still an empty state.                                                                                                                                                         |
| Not built                           | Column pin and reorder, expandable rows, grouping, board and calendar views, AND/OR filter builder.                                                                           |
| Sample only (no API)                | Saved views, record inspector on real records, notifications, record search in the palette.                                                                                   |
| Favourites, recents, column choices | Stored per user and cleared on sign-out (`frontend-state` skill). Decide whether favourites should survive sign-out.                                                          |
| Not verified                        | Layout at 768 and 390px, keyboard and screen-reader use, 200% zoom, and dark-mode contrast of custom colours are not checked beyond unit tests and the token contrast script. |
