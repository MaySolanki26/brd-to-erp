import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

/** The monorepo root is the nearest ancestor holding pnpm-workspace.yaml. */
export function findRepoRoot(from: string): string | null {
  let dir = resolve(from);
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** True when `target` resolves to the repository root or anything below it. */
export function isInsideRepo(target: string, cwd: string): boolean {
  const root = findRepoRoot(cwd);
  if (!root) return false;
  const rel = relative(root, resolve(cwd, target));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}
