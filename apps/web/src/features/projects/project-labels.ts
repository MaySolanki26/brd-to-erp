import type { ProjectRole, ProjectStatus } from '@brd/shared';

export const ROLE_LABELS: Record<ProjectRole, string> = {
  OWNER: 'Owner',
  ANALYST: 'Analyst',
  APPROVER: 'Approver',
  VIEWER: 'Viewer',
};

export const ROLE_OPTIONS = Object.keys(ROLE_LABELS) as ProjectRole[];

export const STATUS_TONES: Record<ProjectStatus, 'neutral' | 'success' | 'info' | 'warning'> = {
  DRAFT: 'neutral',
  ACTIVE: 'success',
  COMPLETED: 'info',
  ARCHIVED: 'warning',
};

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
