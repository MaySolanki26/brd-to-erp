import type { ProjectRole } from '../constants/roles.js';

export type ProjectStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

export interface ProjectDto {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  organizationId: string;
  /** The caller's role in this project; null for an ORG_ADMIN without membership. */
  myRole: ProjectRole | null;
  createdAt: string;
  updatedAt: string;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface MemberCandidateDto {
  userId: string;
  name: string;
  email: string;
}

export interface MemberDto {
  userId: string;
  name: string;
  email: string;
  role: ProjectRole;
  createdAt: string;
}
