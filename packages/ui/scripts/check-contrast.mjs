// Verifies WCAG AA contrast for key token pairs in light and dark mode.
// Usage: node scripts/check-contrast.mjs   (exit code 1 on failure)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/theme/tokens.css'),
  'utf8',
);

function declarations(selector) {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`Missing block: ${selector}`);
  const end = css.indexOf('\n}', start);
  const body = css.slice(start, end);
  const result = {};
  for (const match of body.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)) {
    result[match[1]] = match[2].trim();
  }
  return result;
}

function resolver(tokens) {
  const resolve = (name, depth = 0) => {
    if (depth > 10) throw new Error(`Cyclic token: ${name}`);
    const value = tokens[name];
    if (value === undefined) throw new Error(`Unknown token: ${name}`);
    const ref = value.match(/^var\((--[\w-]+)\)$/);
    return ref ? resolve(ref[1], depth + 1) : value;
  };
  return (name) => resolve(name).split(/\s+/).map(Number);
}

function luminance([r, g, b]) {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground, background, minimum ratio]
const TEXT = 4.5;
const UI = 3;
const PAIRS = [
  ['--color-text', '--color-bg', TEXT],
  ['--color-text', '--color-surface', TEXT],
  ['--color-text', '--color-muted', TEXT],
  ['--color-text-muted', '--color-bg', TEXT],
  ['--color-text-muted', '--color-surface', TEXT],
  ['--color-text-muted', '--color-muted', TEXT],
  ['--color-card-text', '--color-card', TEXT],
  ['--color-accent-text', '--color-accent', TEXT],
  ['--color-primary-contrast', '--color-primary', TEXT],
  ['--color-primary', '--color-bg', TEXT],
  ['--color-primary', '--color-primary-light', TEXT],
  ['--color-danger-contrast', '--color-danger', TEXT],
  ['--color-danger', '--color-bg', TEXT],
  ['--color-danger-text', '--color-danger-light', TEXT],
  ['--color-success-text', '--color-success-light', TEXT],
  ['--color-warning-text', '--color-warning-light', TEXT],
  ['--color-info-text', '--color-info-light', TEXT],
  ['--tone-success-fg', '--tone-success-bg', TEXT],
  ['--tone-warning-fg', '--tone-warning-bg', TEXT],
  ['--tone-danger-fg', '--tone-danger-bg', TEXT],
  ['--tone-info-fg', '--tone-info-bg', TEXT],
  ['--tone-brand-fg', '--tone-brand-bg', TEXT],
  ['--tone-neutral-fg', '--tone-neutral-bg', TEXT],
  ['--rail-icon', '--rail-bg', TEXT],
  ['--rail-selected-icon', '--rail-selected-bg', TEXT],
  ['--color-text', '--sidebar-bg', TEXT],
  ['--color-text-muted', '--sidebar-bg', TEXT],
  // Avatar fallbacks draw initials in the page background color on these hues.
  ['--color-bg', '--color-primary', TEXT],
  ['--color-bg', '--color-success', TEXT],
  ['--color-bg', '--violet', TEXT],
  ['--color-bg', '--color-danger', TEXT],
  ['--color-bg', '--color-info', TEXT],
  ['--color-bg', '--color-warning', TEXT],
  ['--color-focus-ring', '--color-bg', UI],
];

const light = declarations(':root');
const dark = { ...light, ...declarations(":root[data-theme='dark']") };
let failures = 0;

for (const [mode, tokens] of [['light', light], ['dark', dark]]) {
  const get = resolver(tokens);
  for (const [fg, bg, min] of PAIRS) {
    const value = ratio(get(fg), get(bg));
    if (value < min) {
      failures += 1;
      console.error(`FAIL [${mode}] ${fg} on ${bg}: ${value.toFixed(2)} < ${min}`);
    }
  }
}

if (failures > 0) {
  console.error(`${failures} contrast check(s) failed`);
  process.exit(1);
}
console.log(`Contrast OK: ${PAIRS.length} pairs x 2 modes`);
