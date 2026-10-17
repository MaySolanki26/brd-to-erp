import { describe, expect, it } from 'vitest';
import { isAllowed } from './permissions';

describe('isAllowed', () => {
  it('denies everything until the user is known', () => {
    expect(isAllowed(null, { roles: ['ORG_ADMIN', 'MEMBER'] })).toBe(false);
    expect(isAllowed(null, { permission: 'READ', projectRole: 'OWNER' })).toBe(false);
  });

  it('matches organisation roles', () => {
    expect(isAllowed('ORG_ADMIN', { roles: ['ORG_ADMIN'] })).toBe(true);
    expect(isAllowed('MEMBER', { roles: ['ORG_ADMIN'] })).toBe(false);
  });

  it('lets organisation admins act on any project', () => {
    expect(isAllowed('ORG_ADMIN', { permission: 'ARCHIVE_PROJECT', projectRole: null })).toBe(true);
  });

  it('gives members only what their project role grants', () => {
    expect(isAllowed('MEMBER', { permission: 'ARCHIVE_PROJECT', projectRole: 'OWNER' })).toBe(true);
    expect(isAllowed('MEMBER', { permission: 'ADD_SOURCE', projectRole: 'ANALYST' })).toBe(true);
    expect(isAllowed('MEMBER', { permission: 'ADD_SOURCE', projectRole: 'VIEWER' })).toBe(false);
    expect(isAllowed('MEMBER', { permission: 'READ', projectRole: null })).toBe(false);
  });
});
