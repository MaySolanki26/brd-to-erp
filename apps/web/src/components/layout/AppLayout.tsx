import { Suspense, useState } from 'react';
import { Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom';
import {
  AppShell,
  AppSidebar,
  AppSidebarMobile,
  AppHeader,
  ErrorBoundary,
  PageLoader,
  ThemeToggle,
  TooltipProvider,
  useSidebarState,
  type NavItem,
  type BreadcrumbItem,
  type AppShellUser,
} from '@brd/ui';
import { FolderKanban, KeyRound, LayoutDashboard, Users } from 'lucide-react';
import { OrgRole, type RoleName } from '@brd/shared';
import { useCan } from '@/hooks/use-can';
import { useAuth } from '@/providers/auth-provider';
import { useProject } from '@/features/projects/hooks/use-projects';
import { AppBrand } from './AppBrand';

interface RoleNavItem extends NavItem {
  /** Organisation roles that see this item. Everyone sees it when left out. */
  roles?: readonly RoleName[];
}

const NAV_ITEMS: RoleNavItem[] = [
  { key: '/', label: 'Dashboard', icon: LayoutDashboard },
  { key: '/projects', label: 'Projects', icon: FolderKanban },
  { key: '/team', label: 'Team', icon: Users, roles: [OrgRole.ORG_ADMIN] },
];

const BREADCRUMB_MAP: Record<string, BreadcrumbItem[]> = {
  '/': [{ label: 'Dashboard' }],
  '/projects': [{ label: 'Projects' }],
  '/team': [{ label: 'Team' }],
};

function isActivePath(key: string, pathname: string): boolean {
  return key === '/' ? pathname === '/' : pathname === key || pathname.startsWith(`${key}/`);
}

function breadcrumbsFor(
  pathname: string,
  projectName: string | undefined,
  goToProjects: () => void,
): BreadcrumbItem[] {
  if (pathname.startsWith('/projects/')) {
    return [{ label: 'Projects', onClick: goToProjects }, { label: projectName ?? 'Project' }];
  }
  return BREADCRUMB_MAP[pathname] ?? [{ label: 'Home' }];
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const canAct = useCan();
  const { collapsed, toggle } = useSidebarState();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || canAct({ roles: item.roles }));
  const activeKey =
    visibleItems.find((item) => isActivePath(item.key, location.pathname))?.key ?? '/';

  const navItems: NavItem[] = visibleItems.map(({ roles: _roles, ...item }) => ({
    ...item,
    onClick: () => {
      navigate(item.key);
      setMobileOpen(false);
    },
  }));

  const appUser: AppShellUser | undefined = user
    ? { name: user.name, email: user.email, role: user.role.name }
    : undefined;

  const projectMatch = useMatch('/projects/:projectId');
  const project = useProject(projectMatch?.params.projectId ?? '');
  const breadcrumbs = breadcrumbsFor(location.pathname, project.data?.name, () =>
    navigate('/projects'),
  );

  return (
    <TooltipProvider>
      <AppShell
        sidebar={
          <AppSidebar
            items={navItems}
            activeKey={activeKey}
            collapsed={collapsed}
            onToggle={toggle}
            branding={<AppBrand collapsed={collapsed} />}
            user={appUser}
            onLogout={logout}
          />
        }
      >
        <AppSidebarMobile
          items={navItems}
          activeKey={activeKey}
          open={mobileOpen}
          onOpenChange={setMobileOpen}
          branding={<AppBrand />}
          user={appUser}
          onLogout={logout}
        />

        <AppHeader
          breadcrumbs={breadcrumbs}
          user={appUser}
          onLogout={logout}
          onMobileMenuOpen={() => setMobileOpen(true)}
          actions={<ThemeToggle />}
          userMenuActions={[
            {
              key: 'change-password',
              label: 'Change password',
              icon: KeyRound,
              onClick: () => navigate('/change-password'),
            },
          ]}
        />

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </AppShell>
    </TooltipProvider>
  );
}
