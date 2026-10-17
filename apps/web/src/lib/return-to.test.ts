import { describe, expect, it } from 'vitest';
import { loginUrl, safeReturnTo } from './return-to';

describe('safeReturnTo', () => {
  it('keeps same-origin relative paths with query and hash', () => {
    expect(safeReturnTo('/projects/abc?tab=members#x')).toBe('/projects/abc?tab=members#x');
  });

  it.each([
    ['null', null],
    ['empty', ''],
    ['absolute url', 'https://evil.example/steal'],
    ['protocol-relative url', '//evil.example'],
    ['backslash trick', '/\\evil.example'],
    ['control character', '/projects\n/x'],
    ['no leading slash', 'projects'],
    ['login page itself', '/login'],
    ['login with query', '/login?returnTo=/projects'],
  ])('falls back to the home page for %s', (_name, value) => {
    expect(safeReturnTo(value)).toBe('/');
  });
});

describe('loginUrl', () => {
  it('encodes the destination', () => {
    expect(loginUrl('/projects/1?tab=members')).toBe(
      '/login?returnTo=%2Fprojects%2F1%3Ftab%3Dmembers',
    );
  });

  it('omits the parameter for the home page and for unsafe values', () => {
    expect(loginUrl('/')).toBe('/login');
    expect(loginUrl('//evil.example')).toBe('/login');
  });
});
