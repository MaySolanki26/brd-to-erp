import type { OrgRole, ProjectRole, UserDto } from '@brd/shared';
import { ForbiddenError, NotFoundError } from '../../errors/app-error.js';
import { findMembershipRole, findProjectInOrg, type ProjectRecord } from './access.repository.js';

export interface ProjectAccess {
  project: ProjectRecord;
  /** The caller's membership role; null for an ORG_ADMIN who is not a member. */
  role: ProjectRole | null;
}

const ORG_ADMIN: OrgRole = 'ORG_ADMIN';

/**
 * Resolves the caller's access to a project. Anything the caller may not see is a
 * 404 so project existence is never revealed; a member lacking the role gets 403.
 */
export async function resolveProjectAccess(
  user: UserDto,
  projectId: string,
  allowedRoles: readonly ProjectRole[],
): Promise<ProjectAccess> {
  const project = await findProjectInOrg(user.organizationId, projectId);
  if (!project) {
    throw new NotFoundError('Project not found');
  }

  const role = (await findMembershipRole(
    user.organizationId,
    projectId,
    user.id,
  )) as ProjectRole | null;

  if (user.orgRole === ORG_ADMIN) {
    return { project, role };
  }
  if (!role) {
    throw new NotFoundError('Project not found');
  }
  if (!allowedRoles.includes(role)) {
    throw new ForbiddenError('Insufficient project role');
  }
  return { project, role };
}
