import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isInsideRepo } from './repo-path.js';

function makeRepo(): { root: string; app: string } {
  const root = mkdtempSync(join(tmpdir(), 'brd-repo-'));
  writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages: []\n');
  const app = join(root, 'apps', 'api');
  mkdirSync(app, { recursive: true });
  return { root, app };
}

describe('isInsideRepo', () => {
  it('flags absolute paths inside the repository', () => {
    const { root, app } = makeRepo();
    expect(isInsideRepo(join(root, 'storage'), app)).toBe(true);
    expect(isInsideRepo(root, app)).toBe(true);
  });

  it('flags relative paths that stay inside the repository', () => {
    const { app } = makeRepo();
    expect(isInsideRepo('./uploads', app)).toBe(true);
    expect(isInsideRepo('../../data', app)).toBe(true);
  });

  it('accepts paths outside the repository', () => {
    const { app } = makeRepo();
    expect(isInsideRepo(join(tmpdir(), 'brd-uploads'), app)).toBe(false);
    expect(isInsideRepo('../../../outside', app)).toBe(false);
  });

  it('does not treat a sibling that shares the repository name prefix as inside', () => {
    const { root, app } = makeRepo();
    expect(isInsideRepo(`${root}-uploads`, app)).toBe(false);
  });

  it('accepts everything when no repository root is found', () => {
    expect(isInsideRepo('/etc/brd', '/')).toBe(false);
  });
});
