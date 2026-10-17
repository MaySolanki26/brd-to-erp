import { describe, expect, it } from 'vitest';
import {
  PROJECT_PERMISSIONS,
  ProjectPermission,
  projectRolesWith,
  type ProjectRole,
} from '@brd/shared';

// docs/specs/understanding-flow.md section 1.
const EXPECTED: Record<ProjectRole, ProjectPermission[]> = {
  VIEWER: ['READ'],
  APPROVER: ['READ', 'APPROVE'],
  ANALYST: ['READ', 'ADD_SOURCE', 'ANSWER_QUESTION', 'REPROCESS', 'SUBMIT_REPORT'],
  OWNER: [
    'READ',
    'ADD_SOURCE',
    'ANSWER_QUESTION',
    'REPROCESS',
    'SUBMIT_REPORT',
    'APPROVE',
    'UPDATE_PROJECT',
    'MANAGE_MEMBERS',
    'ARCHIVE_PROJECT',
  ],
};

describe('project permissions', () => {
  it.each(Object.keys(EXPECTED) as ProjectRole[])(
    '%s has exactly the permissions in the spec',
    (role) => {
      expect([...PROJECT_PERMISSIONS[role]].sort()).toEqual([...EXPECTED[role]].sort());
    },
  );

  it('lets only approvers and owners approve', () => {
    expect(projectRolesWith(ProjectPermission.APPROVE).sort()).toEqual(['APPROVER', 'OWNER']);
  });

  it('lets only analysts and owners write and submit reports', () => {
    expect(projectRolesWith(ProjectPermission.SUBMIT_REPORT).sort()).toEqual(['ANALYST', 'OWNER']);
  });

  it('keeps member management, archiving and project edits to owners', () => {
    for (const permission of [
      ProjectPermission.MANAGE_MEMBERS,
      ProjectPermission.ARCHIVE_PROJECT,
      ProjectPermission.UPDATE_PROJECT,
    ]) {
      expect(projectRolesWith(permission)).toEqual(['OWNER']);
    }
  });

  it('gives every role read access', () => {
    expect(projectRolesWith(ProjectPermission.READ).sort()).toEqual([
      'ANALYST',
      'APPROVER',
      'OWNER',
      'VIEWER',
    ]);
  });
});
