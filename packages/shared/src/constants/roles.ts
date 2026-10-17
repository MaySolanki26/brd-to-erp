export const OrgRole = {
  ORG_ADMIN: 'ORG_ADMIN',
  MEMBER: 'MEMBER',
} as const;

export type OrgRole = (typeof OrgRole)[keyof typeof OrgRole];

export const ProjectRole = {
  OWNER: 'OWNER',
  ANALYST: 'ANALYST',
  APPROVER: 'APPROVER',
  VIEWER: 'VIEWER',
} as const;

export type ProjectRole = (typeof ProjectRole)[keyof typeof ProjectRole];

/** Org role names exposed to the web app as the user's role. */
export const RoleName = OrgRole;
export type RoleName = OrgRole;

export const ProjectPermission = {
  READ: 'READ',
  ADD_SOURCE: 'ADD_SOURCE',
  ANSWER_QUESTION: 'ANSWER_QUESTION',
  REPROCESS: 'REPROCESS',
  APPROVE: 'APPROVE',
  UPDATE_PROJECT: 'UPDATE_PROJECT',
  MANAGE_MEMBERS: 'MANAGE_MEMBERS',
  ARCHIVE_PROJECT: 'ARCHIVE_PROJECT',
} as const;

export type ProjectPermission = (typeof ProjectPermission)[keyof typeof ProjectPermission];

const ANALYST_PERMISSIONS: readonly ProjectPermission[] = [
  ProjectPermission.READ,
  ProjectPermission.ADD_SOURCE,
  ProjectPermission.ANSWER_QUESTION,
  ProjectPermission.REPROCESS,
];

export const PROJECT_PERMISSIONS: Record<ProjectRole, readonly ProjectPermission[]> = {
  VIEWER: [ProjectPermission.READ],
  APPROVER: [ProjectPermission.READ, ProjectPermission.APPROVE],
  ANALYST: ANALYST_PERMISSIONS,
  OWNER: [
    ...ANALYST_PERMISSIONS,
    ProjectPermission.APPROVE,
    ProjectPermission.UPDATE_PROJECT,
    ProjectPermission.MANAGE_MEMBERS,
    ProjectPermission.ARCHIVE_PROJECT,
  ],
};

export function projectRolesWith(permission: ProjectPermission): ProjectRole[] {
  return (Object.keys(PROJECT_PERMISSIONS) as ProjectRole[]).filter((role) =>
    PROJECT_PERMISSIONS[role].includes(permission),
  );
}
