// Fails when a hex or literal rgb()/rgba() color appears outside src/theme/.
// Components must use semantic tokens (Tailwind utilities backed by CSS variables).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const SCAN_DIRS = ['packages/ui/src', 'apps/web/src'];
const EXTENSIONS = ['.ts', '.tsx', '.css'];
const COLOR_PATTERN = /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/;

function* files(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (EXTENSIONS.some((ext) => path.endsWith(ext))) yield path;
  }
}

const offenders = [];
for (const dir of SCAN_DIRS) {
  for (const file of files(join(root, dir))) {
    const rel = relative(root, file);
    if (rel.includes(`${sep}theme${sep}`)) continue;
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, index) => {
        if (COLOR_PATTERN.test(line)) offenders.push(`${rel}:${index + 1}: ${line.trim()}`);
      });
  }
}

if (offenders.length > 0) {
  console.error('Hardcoded colors found outside src/theme/:');
  console.error(offenders.join('\n'));
  process.exit(1);
}
console.log('No hardcoded colors outside src/theme/');
