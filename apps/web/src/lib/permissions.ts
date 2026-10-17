import {
  OrgRole,
  PROJECT_PERMISSIONS,
  type ProjectPermission,
  type ProjectRole,
  type RoleName,
} from '@brd/shared';

/**
 * What a user must have. Either one of the listed organisation roles, or a project permission
 * granted through the user's role in that project (organisation admins always pass).
 */
export type AccessRule =
  | { roles: readonly RoleName[] }
  | { permission: ProjectPermission; projectRole: ProjectRole | null | undefined };

/** The server enforces every rule again; this only decides what to show. */
export function isAllowed(orgRole: RoleName | null, rule: AccessRule): boolean {
  if (!orgRole) return false;
  if ('roles' in rule) return rule.roles.includes(orgRole);
  if (orgRole === OrgRole.ORG_ADMIN) return true;
  return rule.projectRole ? PROJECT_PERMISSIONS[rule.projectRole].includes(rule.permission) : false;
}
