import type { LucideIcon } from 'lucide-react';
import {
  Boxes,
  FileText,
  Files,
  FolderKanban,
  Gavel,
  Info,
  LayoutDashboard,
  LayoutTemplate,
  ListChecks,
  MessageCircleQuestion,
  Scale,
  Users,
} from 'lucide-react';
import { OrgRole, type RoleName } from '@brd/shared';

export type ModuleKey = 'dashboard' | 'projects' | 'team' | 'design';

export interface ModuleDef {
  key: ModuleKey;
  label: string;
  icon: LucideIcon;
  path: string;
  /** Organisation roles that see this module. Everyone sees it when left out. */
  roles?: readonly RoleName[];
}

export const MODULES: readonly ModuleDef[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { key: 'projects', label: 'Projects', icon: FolderKanban, path: '/projects' },
  { key: 'team', label: 'Team', icon: Users, path: '/team', roles: [OrgRole.ORG_ADMIN] },
  {
    key: 'design',
    label: 'Design system',
    icon: LayoutTemplate,
    path: '/design',
    roles: [OrgRole.ORG_ADMIN],
  },
];

const PAGE_LABELS: Record<ModuleKey, string> = {
  dashboard: 'Overview',
  projects: 'All projects',
  team: 'Users',
  design: 'Sample page',
};

export function moduleForPath(pathname: string): ModuleKey {
  if (pathname.startsWith('/projects')) return 'projects';
  if (pathname.startsWith('/team')) return 'team';
  if (pathname.startsWith('/design')) return 'design';
  return 'dashboard';
}

export interface ProjectTabDef {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Only people who manage the project's members see this tab. */
  needsManage?: boolean;
}

/** The tabs of the project page, in the order the page shows them. */
export const PROJECT_TABS: readonly ProjectTabDef[] = [
  { key: 'overview', label: 'Overview', icon: Info },
  { key: 'sources', label: 'Sources', icon: Files },
  { key: 'requirements', label: 'Requirements', icon: ListChecks },
  { key: 'rules', label: 'Rules', icon: Scale },
  { key: 'modules', label: 'Modules', icon: Boxes },
  { key: 'questions', label: 'Questions', icon: MessageCircleQuestion },
  { key: 'decisions', label: 'Decisions', icon: Gavel },
  { key: 'report', label: 'Report', icon: FileText },
  { key: 'members', label: 'Members', icon: Users, needsManage: true },
];

/** One place a person can go. `key` is stable: favourites and "recent" are saved by it. */
export interface NavTarget {
  key: string;
  label: string;
  path: string;
  icon?: LucideIcon;
}

export const pageKey = (path: string): string => `page:${path}`;
export const projectTabKey = (projectId: string, tab: string): string =>
  `project:${projectId}:${tab}`;
export const projectTabPath = (projectId: string, tab: string): string =>
  `/projects/${projectId}?tab=${tab}`;

export interface ProjectContext {
  id: string;
  name: string;
  canManage: boolean;
}

/** The module's pages, plus the open project's tabs when one is open. */
export function targetsForModule(module: ModuleKey, project: ProjectContext | null): NavTarget[] {
  const def = MODULES.find((item) => item.key === module);
  if (!def) return [];
  const pages: NavTarget[] = [
    {
      key: pageKey(def.path),
      label: PAGE_LABELS[module],
      path: def.path,
      icon: def.icon,
    },
  ];
  if (module === 'projects' && project) {
    PROJECT_TABS.filter((tab) => !tab.needsManage || project.canManage).forEach((tab) =>
      pages.push({
        key: projectTabKey(project.id, tab.key),
        label: tab.label,
        path: projectTabPath(project.id, tab.key),
        icon: tab.icon,
      }),
    );
  }
  return pages;
}

/** The key of the row that matches the current URL. */
export function activeTargetKey(pathname: string, search: string): string {
  const match = /^\/projects\/([^/]+)$/.exec(pathname);
  if (match?.[1]) {
    const tab = new URLSearchParams(search).get('tab') ?? 'overview';
    return projectTabKey(match[1], tab);
  }
  return pageKey(pathname);
}
