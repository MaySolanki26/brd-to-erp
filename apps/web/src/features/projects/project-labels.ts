import { formatDateShort, parseDateValue } from '@brd/ui';
import type { ProjectRole, ProjectStatus } from '@brd/shared';

export const ROLE_LABELS: Record<ProjectRole, string> = {
  OWNER: 'Owner',
  ANALYST: 'Analyst',
  APPROVER: 'Approver',
  VIEWER: 'Viewer',
};

export const ROLE_OPTIONS = Object.keys(ROLE_LABELS) as ProjectRole[];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
};

export const STATUS_TONES: Record<ProjectStatus, 'neutral' | 'success' | 'info' | 'warning'> = {
  DRAFT: 'neutral',
  ACTIVE: 'success',
  COMPLETED: 'info',
  ARCHIVED: 'warning',
};

/** "16 Oct, 2026" for running text. Tables use the `DateText` component, which adds the full value on hover. */
export function formatDate(iso: string): string {
  const date = parseDateValue(iso);
  return date ? formatDateShort(date) : '';
}
