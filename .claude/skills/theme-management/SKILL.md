---
name: theme-management
description: Sarvadhi theme and design-token standards — token structure, CSS variables, light/dark/system modes without flash, optional per-tenant branding, contrast and accessibility rules, and how components consume tokens. Use when adding colors, styling components, building dark mode, or applying client branding.
---

# Theme Management

## 1. Principles

- **Tokens are the only source of colors, spacing, radius, shadows, typography.** No hardcoded hex/px values in components.
- Primarily light theme (enterprise default), dark mode supported, system preference respected.
- Theme switching changes CSS variables only; components never branch on theme in JavaScript for styling.
- Accessible by default: WCAG 2.1 AA contrast in both modes.

## 2. Token layers

| Layer                    | Purpose                                                   | Example                                                                                                                                                                                                                              |
| ------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Primitive**            | raw palette and scales; never used directly in components | `--blue-600: #2563eb`                                                                                                                                                                                                                |
| **Semantic**             | meaning; components use these                             | `--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-border`, `--color-primary`, `--color-primary-contrast`, `--color-success`, `--color-warning`, `--color-danger`, `--color-info`, `--color-focus-ring` |
| **Component** (optional) | specific overrides                                        | `--table-row-hover`, `--sidebar-bg`                                                                                                                                                                                                  |

Other scales (semantic names):

- Spacing: `--space-1` (4px) … `--space-8` (48px), 4px base grid
- Radius: `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-full`
- Shadow: `--shadow-sm`, `--shadow-md`, `--shadow-lg`
- Typography: `--font-sans`, `--font-mono`, `--text-xs` … `--text-2xl`, `--leading-*`, `--weight-*`
- Z-index: `--z-dropdown`, `--z-sticky`, `--z-modal`, `--z-toast`
- Motion: `--duration-fast` (150ms), `--duration-normal` (250ms), `--ease-standard`

Tokens live in `packages/ui/src/theme/tokens.css` (+ a typed `tokens.ts` export when JS needs values, e.g., charts).

## 3. CSS structure

```css
:root {
  /* light (default) */
  --color-bg: #f8fafc;
  --color-surface: #ffffff;
  --color-text: #0f172a;
  --color-text-muted: #475569;
  --color-border: #e2e8f0;
  --color-primary: #2563eb;
  --color-primary-contrast: #ffffff;
  /* ... */
}

:root[data-theme='dark'] {
  --color-bg: #0b1120;
  --color-surface: #111827;
  --color-text: #e5e7eb;
  --color-text-muted: #9ca3af;
  --color-border: #1f2937;
  --color-primary: #3b82f6;
  --color-primary-contrast: #0b1120;
  /* ... */
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-fast: 0ms;
    --duration-normal: 0ms;
  }
}
```

If the project uses Tailwind, map Tailwind theme colors to these variables (`colors: { primary: 'var(--color-primary)' }`) so utilities stay token-based. Arbitrary values (`bg-[#123456]`) are not allowed.

## 4. Mode selection (light / dark / system)

- Preference stored via the storage wrapper (`frontend-state`): `'light' | 'dark' | 'system'`, default `'system'` (or `'light'` if the product requires light-first).
- Resolved mode: `system` → `matchMedia('(prefers-color-scheme: dark)')`, listening for changes.
- Applied by setting `document.documentElement.dataset.theme` and `color-scheme` (`light`/`dark`) so native inputs and scrollbars match.
- **No flash of wrong theme:** a tiny inline script in `index.html` `<head>` reads the preference (with try/catch) and sets `data-theme` before the app renders.
- `ThemeProvider` + `useTheme()` hook expose `{ preference, resolvedMode, setPreference }`. No other code reads or writes the theme.
- Optional: sync the preference to the user profile on the server so it follows the user across devices (server value wins after login).

## 5. Tenant branding (optional, per project)

- Branding config per organization from the API: `{ logoUrl, primaryColor, primaryContrast?, appName? }`.
- Only **specific semantic tokens** can be overridden (primary, primary-contrast, maybe sidebar accent). Never let tenants change danger/success colors or text/background contrast.
- Validate contrast on save (server or admin UI): primary vs primary-contrast ≥ 4.5:1; if it fails, compute an accessible contrast color or reject.
- Generate hover/active shades from the primary color with a color utility; don't ask tenants for every shade.
- Apply by setting CSS variables on `document.documentElement` after login; reset on logout.
- Logos: sized containers, `alt` text, fallback to app name.

## 6. Component rules

- Components use semantic tokens only (`var(--color-surface)`), never primitives or hex values.
- Status colors always paired with an icon or text (color is not the only signal).
- Focus states visible in both modes (`--color-focus-ring`, 2px outline, offset).
- Charts read colors from `tokens.ts` and use a palette checked for both modes and color-blind safety.
- Images/illustrations that look wrong in dark mode get a dark variant or a neutral background.
- Every new component is checked in light and dark before merge (Storybook or a demo page).

## 7. Accessibility checks

- Text contrast ≥ 4.5:1 (≥ 3:1 for large text and UI component boundaries) in both modes.
- Don't rely on hover only; touch targets ≥ 40×40 px for primary actions.
- Respect `prefers-reduced-motion`.

## 8. CI enforcement

- Stylelint (or ESLint plugin) rule: no hex/rgb colors outside `packages/ui/src/theme/`.
- Contrast test for semantic token pairs in both modes (script using a contrast library).

## Done checklist

- [ ] Only semantic tokens used; no hardcoded colors/sizes
- [ ] Works in light, dark, and system; no theme flash on load
- [ ] Contrast AA in both modes; focus visible
- [ ] Branding (if used) limited to allowed tokens and contrast-validated
- [ ] Theme preference stored via the storage wrapper
