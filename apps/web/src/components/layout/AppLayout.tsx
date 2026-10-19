import { Suspense, useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { KeyRound, LogOut, Search } from 'lucide-react';
import {
  AppShell,
  AppearanceMenu,
  Canvas,
  CommandPalette,
  ContextSidebar,
  ErrorBoundary,
  IconRail,
  MobileNav,
  NotificationBell,
  PHONE,
  PageLoader,
  TABLET,
  TopBar,
  UserMenu,
  useCommandShortcut,
  useMedia,
  usePageHeader,
  type AppShellUser,
  type CommandGroupDef,
  type RailModule,
  type SidebarItem,
  type SidebarSection,
} from '@brd/ui';
import { ProjectPermission } from '@brd/shared';
import { useCan } from '@/hooks/use-can';
import { useAuth } from '@/providers/auth-provider';
import { useProject } from '@/features/projects/hooks/use-projects';
import { useSampleNotifications } from '@/features/notifications/hooks/use-sample-notifications';
import { useAppearance } from '@/features/shell/hooks/use-appearance';
import { useFavorites } from '@/features/shell/hooks/use-favorites';
import { useRecents } from '@/features/shell/hooks/use-recents';
import { useSidebarPreferences } from '@/features/shell/hooks/use-sidebar-preferences';
import {
  MODULES,
  PROJECT_TABS,
  activeTargetKey,
  moduleForPath,
  projectTabKey,
  targetsForModule,
  type ModuleKey,
  type NavTarget,
  type ProjectContext,
} from '@/features/shell/navigation';
import type { SavedPage } from '@/features/shell/shell-preferences';
import { APP_NAME } from './AppBrand';

const ORG_ROLE_LABELS: Record<string, string> = {
  ORG_ADMIN: 'Organization admin',
  MEMBER: 'Member',
};

const MODULE_TITLES: Record<ModuleKey, string> = {
  dashboard: 'Dashboard',
  projects: 'Projects',
  team: 'Team',
  design: 'Design system',
};

/** Remembers the page title the top bar shows, so "Recent" can name the pages the person opened. */
function RecentsRecorder({
  pageKey,
  path,
  record,
}: {
  pageKey: string;
  path: string;
  record: (page: SavedPage) => void;
}) {
  const header = usePageHeader();
  const title = header?.title;

  useEffect(() => {
    if (!title) return;
    const tab = pageKey.startsWith('project:') ? pageKey.split(':')[2] : undefined;
    const tabLabel = PROJECT_TABS.find((item) => item.key === tab)?.label;
    record({
      key: pageKey,
      label: tabLabel && tab !== 'overview' ? `${title} · ${tabLabel}` : title,
      path,
    });
  }, [title, pageKey, path, record]);

  return null;
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const canAct = useCan();
  const location = useLocation();
  const navigate = useNavigate();
  const userId = user?.id ?? '';

  const sidebarPrefs = useSidebarPreferences();
  const appearance = useAppearance();
  const phone = useMedia(PHONE);
  const drawerNav = useMedia(TABLET);
  const favorites = useFavorites(userId);
  const recents = useRecents(userId);
  const notifications = useSampleNotifications();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const togglePalette = useCallback(() => setPaletteOpen((value) => !value), []);
  useCommandShortcut(togglePalette);

  const projectMatch = useMatch('/projects/:projectId');
  const project = useProject(projectMatch?.params.projectId ?? '');
  const projectContext: ProjectContext | null =
    projectMatch?.params.projectId && project.data
      ? {
          id: projectMatch.params.projectId,
          name: project.data.name,
          canManage: canAct({
            permission: ProjectPermission.MANAGE_MEMBERS,
            projectRole: project.data.myRole,
          }),
        }
      : null;

  const moduleKey = moduleForPath(location.pathname);
  const activeKey = activeTargetKey(location.pathname, location.search);
  const currentPath = `${location.pathname}${location.search}`;

  const visibleModules = MODULES.filter(
    (module) => !module.roles || canAct({ roles: module.roles }),
  );
  const railModules: RailModule[] = visibleModules.map((module) => ({
    key: module.key,
    label: module.label,
    icon: module.icon,
    onSelect: () => navigate(module.path),
  }));

  const go = useCallback((path: string) => navigate(path), [navigate]);
  const toItem = (target: NavTarget): SidebarItem => ({
    key: target.key,
    label: target.label,
    icon: target.icon,
    onSelect: () => go(target.path),
  });

  const moduleTargets = targetsForModule(moduleKey, projectContext);
  const pageTargets = moduleTargets.filter((target) => !target.key.startsWith('project:'));
  const projectTargets = moduleTargets.filter((target) => target.key.startsWith('project:'));
  const shownKeys = new Set(moduleTargets.map((target) => target.key));
  const recentItems = recents.pages
    .filter((page) => page.key !== activeKey && !shownKeys.has(page.key))
    .map((page): SidebarItem => ({
      key: page.key,
      label: page.label,
      onSelect: () => go(page.path),
    }));

  const sections: SidebarSection[] = [
    { key: 'pages', label: 'Pages', items: pageTargets.map(toItem) },
    ...(projectContext && projectTargets.length > 0
      ? [
          {
            key: 'project',
            label: 'Project',
            items: [
              {
                key: `project:${projectContext.id}`,
                label: projectContext.name,
                children: projectTargets.map((target) => ({
                  key: target.key,
                  label: target.label,
                  onSelect: () => go(target.path),
                })),
              },
            ],
          },
        ]
      : []),
    ...(recentItems.length > 0
      ? [{ key: 'recent', label: 'Recent', recent: true, items: recentItems }]
      : []),
  ];

  const favoriteItems: SidebarItem[] = favorites.pages.map((page) => ({
    key: page.key,
    label: page.label,
    onSelect: () => go(page.path),
  }));

  const toggleFavorite = (key: string) => {
    const known = [
      ...moduleTargets,
      ...recents.pages.map((page) => ({ key: page.key, label: page.label, path: page.path })),
      ...favorites.pages,
    ].find((target) => target.key === key);
    if (known) favorites.toggle({ key: known.key, label: known.label, path: known.path });
  };

  const paletteGroups: CommandGroupDef[] = [
    {
      key: 'pages',
      label: 'Pages',
      items: [
        ...visibleModules.map((module) => ({
          key: module.key,
          label: module.label,
          icon: module.icon,
          onSelect: () => navigate(module.path),
        })),
        ...(projectContext
          ? PROJECT_TABS.filter((tab) => !tab.needsManage || projectContext.canManage).map(
              (tab) => ({
                key: projectTabKey(projectContext.id, tab.key),
                label: `${projectContext.name} · ${tab.label}`,
                icon: tab.icon,
                onSelect: () => navigate(`/projects/${projectContext.id}?tab=${tab.key}`),
              }),
            )
          : []),
      ],
    },
    {
      key: 'recent',
      label: 'Recent',
      items: recents.pages.map((page) => ({
        key: page.key,
        label: page.label,
        onSelect: () => navigate(page.path),
      })),
    },
    {
      key: 'actions',
      label: 'Actions',
      items: [
        {
          key: 'change-password',
          label: 'Change password',
          icon: KeyRound,
          onSelect: () => navigate('/change-password'),
        },
        { key: 'log-out', label: 'Log out', icon: LogOut, onSelect: () => void logout() },
      ],
    },
  ];

  const appUser: AppShellUser | undefined = user
    ? {
        name: user.name,
        email: user.email,
        role: ORG_ROLE_LABELS[user.role.name] ?? user.role.name,
      }
    : undefined;

  const sidebarProps = {
    title: MODULE_TITLES[moduleKey],
    sections,
    activeKey,
    favorites: favoriteItems,
    favoriteKeys: favorites.keys,
    onToggleFavorite: toggleFavorite,
  };

  return (
    <AppShell
      railSkin={appearance.railSkin}
      rail={
        phone ? undefined : (
          <IconRail
            modules={railModules}
            activeKey={moduleKey}
            brandInitials={APP_NAME.slice(0, 2).toUpperCase()}
            brandLabel={APP_NAME}
            onBrandSelect={() => navigate('/')}
            utilities={[
              { key: 'search', label: 'Search · Ctrl K', icon: Search, onSelect: openPalette },
            ]}
          />
        )
      }
      sidebar={
        drawerNav || sidebarPrefs.collapsed ? undefined : (
          <ContextSidebar
            {...sidebarProps}
            width={sidebarPrefs.width}
            onWidthChange={sidebarPrefs.setWidth}
            onCollapse={() => sidebarPrefs.setCollapsed(true)}
          />
        )
      }
      topBar={
        <TopBar
          onMenu={drawerNav ? () => setMobileOpen(true) : undefined}
          onExpandSidebar={
            !drawerNav && sidebarPrefs.collapsed
              ? () => sidebarPrefs.setCollapsed(false)
              : undefined
          }
          onSearch={openPalette}
          right={
            <>
              <NotificationBell
                isSample
                items={notifications.items}
                onMarkRead={notifications.markRead}
                onMarkAllRead={notifications.markAllRead}
              />
              <AppearanceMenu
                mode={appearance.mode}
                onModeChange={appearance.setMode}
                paletteId={appearance.paletteId}
                onPaletteChange={appearance.setPaletteId}
                customPalettes={appearance.customPalettes}
                onSaveCustom={appearance.saveCustom}
                onDeleteCustom={appearance.deleteCustom}
              />
              {appUser && (
                <UserMenu
                  user={appUser}
                  onLogout={logout}
                  actions={[
                    {
                      key: 'change-password',
                      label: 'Change password',
                      icon: KeyRound,
                      onClick: () => navigate('/change-password'),
                    },
                  ]}
                />
              )}
            </>
          }
        />
      }
    >
      <RecentsRecorder pageKey={activeKey} path={currentPath} record={recents.record} />
      <MobileNav
        {...sidebarProps}
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        modules={railModules}
        activeModuleKey={moduleKey}
        showModules={phone}
      />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} groups={paletteGroups} />

      <Canvas>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </Canvas>
    </AppShell>
  );
}
