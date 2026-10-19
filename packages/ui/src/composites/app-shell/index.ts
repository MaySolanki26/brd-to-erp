export { AppShell, Canvas } from './AppShell';
export { IconRail, type IconRailProps } from './IconRail';
export {
  ContextSidebar,
  SidebarContent,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  type ContextSidebarProps,
  type SidebarContentProps,
} from './ContextSidebar';
export { MobileNav, type MobileNavProps } from './MobileNav';
export { TopBar, type TopBarProps } from './TopBar';
export {
  PageHeaderProvider,
  usePageHeader,
  useSetPageHeader,
  type PageHeaderState,
} from './PageHeader';
export { CommandPalette, useCommandShortcut, type CommandPaletteProps } from './CommandPalette';
export { NotificationBell, type NotificationBellProps } from './NotificationBell';
export {
  AppearanceMenu,
  ThemePicker,
  type AppearanceMenuProps,
  type ThemePickerProps,
} from './AppearanceMenu';
export { UserMenu } from './UserMenu';

export type {
  RailModule,
  RailUtility,
  SidebarChild,
  SidebarItem,
  SidebarSection,
  AppShellUser,
  UserMenuAction,
  CommandEntry,
  CommandGroupDef,
  NotificationEntry,
} from './types';
