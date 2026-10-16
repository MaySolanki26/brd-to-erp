import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppShell,
  AppSidebar,
  AppSidebarMobile,
  AppHeader,
  ErrorBoundary,
  TooltipProvider,
  useSidebarState,
  type NavItem,
  type BreadcrumbItem,
  type AppShellUser,
  Badge,
} from '@brd/ui';
import { LayoutDashboard, FileText, Users, Settings, Component } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';

const NAV_ITEMS: NavItem[] = [
  { key: '/', label: 'Dashboard', icon: LayoutDashboard },
  { key: '/documents', label: 'Documents', icon: FileText },
  { key: '/team', label: 'Team', icon: Users },
  { key: '/settings', label: 'Settings', icon: Settings },
  { key: '/dev/showcase', label: 'Showcase', icon: Component, badge: <Badge variant="outline" className="text-[10px] px-1.5 py-0">Dev</Badge> },
];

const BREADCRUMB_MAP: Record<string, BreadcrumbItem[]> = {
  '/': [{ label: 'Dashboard' }],
  '/documents': [{ label: 'Documents' }],
  '/team': [{ label: 'Team' }],
  '/settings': [{ label: 'Settings' }],
  '/dev/showcase': [{ label: 'Dev' }, { label: 'Showcase' }],
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const { collapsed, toggle } = useSidebarState();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const activeKey = NAV_ITEMS.find((item) => item.key === location.pathname)?.key ?? '/';

  const navItems: NavItem[] = NAV_ITEMS.map((item) => ({
    ...item,
    onClick: () => {
      navigate(item.key);
      setMobileOpen(false);
    },
  }));

  const appUser: AppShellUser | undefined = user
    ? { name: user.name, email: user.email, role: user.role.name }
    : undefined;

  const breadcrumbs = BREADCRUMB_MAP[location.pathname] ?? [{ label: 'Home' }];

  const branding = collapsed ? (
    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xl font-bold">
      B
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xl font-bold">
        B
      </div>
      <span className="text-2xl font-semibold text-foreground">BRD Platform</span>
    </div>
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
            branding={branding}
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
          branding={
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xl font-bold">
                B
              </div>
              <span className="text-2xl font-semibold text-foreground">BRD Platform</span>
            </div>
          }
          user={appUser}
          onLogout={logout}
        />

        <AppHeader
          breadcrumbs={breadcrumbs}
          user={appUser}
          onLogout={logout}
          onMobileMenuOpen={() => setMobileOpen(true)}
          userMenuActions={[
            { key: 'settings', label: 'Settings', icon: Settings, onClick: () => navigate('/settings') },
          ]}
        />

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </AppShell>
    </TooltipProvider>
  );
}
