import type {
  CreateProjectInput,
  ListProjectsQuery,
  PagedResult,
  ProjectDto,
  ProjectRole,
  UpdateProjectInput,
  UserDto,
} from '@brd/shared';
import { ConflictError, NotFoundError } from '../../errors/app-error.js';
import { withTransaction } from '../../lib/transaction.js';
import type { ProjectAccess } from '../access/access.service.js';
import type { ProjectRecord } from '../access/access.repository.js';
import { createAuditLog } from '../audit/audit.repository.js';
import * as repo from './projects.repository.js';

export function toProjectDto(project: ProjectRecord, myRole: ProjectRole | null): ProjectDto {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    organizationId: project.organizationId,
    myRole,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export async function listProjects(
  user: UserDto,
  query: ListProjectsQuery,
): Promise<PagedResult<ProjectDto>> {
  const { items, total } = await repo.listProjects({
    organizationId: user.organizationId,
    userId: user.id,
    allInOrg: user.orgRole === 'ORG_ADMIN',
    includeArchived: query.includeArchived,
    page: query.page,
    pageSize: query.pageSize,
  });
  return {
    items: items.map((p) => toProjectDto(p, p.myRole)),
    page: query.page,
    pageSize: query.pageSize,
    total,
  };
}

export async function createProject(user: UserDto, input: CreateProjectInput): Promise<ProjectDto> {
  return withTransaction(async (tx) => {
    const project = await repo.createProject({ ...input, organizationId: user.organizationId }, tx);
    await repo.addOwner(
      { projectId: project.id, userId: user.id, organizationId: user.organizationId },
      tx,
    );
    await createAuditLog(
      {
        action: 'CREATE',
        entity: 'Project',
        entityId: project.id,
        userId: user.id,
        organizationId: user.organizationId,
        metadata: { name: project.name },
      },
      tx,
    );
    return toProjectDto(project, 'OWNER');
  });
}

export async function updateProject(
  user: UserDto,
  access: ProjectAccess,
  input: UpdateProjectInput,
): Promise<ProjectDto> {
  if (access.project.status === 'ARCHIVED') {
    throw new ConflictError('Archived projects cannot be modified');
  }
  return withTransaction(async (tx) => {
    const updated = await repo.updateProject(user.organizationId, access.project.id, input, tx);
    if (!updated) {
      throw new NotFoundError('Project not found');
    }
    await createAuditLog(
      {
        action: 'UPDATE',
        entity: 'Project',
        entityId: updated.id,
        userId: user.id,
        organizationId: user.organizationId,
        metadata: { fields: Object.keys(input) },
      },
      tx,
    );
    return toProjectDto(updated, access.role);
  });
}

export async function archiveProject(user: UserDto, access: ProjectAccess): Promise<ProjectDto> {
  if (access.project.status === 'ARCHIVED') {
    return toProjectDto(access.project, access.role);
  }
  return withTransaction(async (tx) => {
    const archived = await repo.updateProject(
      user.organizationId,
      access.project.id,
      { status: 'ARCHIVED' },
      tx,
    );
    if (!archived) {
      throw new NotFoundError('Project not found');
    }
    await createAuditLog(
      {
        action: 'UPDATE',
        entity: 'Project',
        entityId: archived.id,
        userId: user.id,
        organizationId: user.organizationId,
        metadata: { archived: true },
      },
      tx,
    );
    return toProjectDto(archived, access.role);
  });
}
