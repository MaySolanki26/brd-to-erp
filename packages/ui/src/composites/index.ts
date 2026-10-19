// Page Shell
export { PageShell, PageShellBody } from './PageShell';
export { ActionBar } from './ActionBar';
export { InformativeBar } from './InformativeBar';
export { SwitcherBar, type SwitcherItem } from './SwitcherBar';

// Feedback & States
export { InlineAlert } from '../uab/primitives/feedback';
export { EmptyState } from './EmptyState';
export { ErrorBoundary } from './ErrorBoundary';
export { PageError } from './PageError';
export { PageLoader } from './PageLoader';
export { DelayedFallback } from './DelayedFallback';

// Dialogs & Drawers
export { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog';
export {
  ConfirmHost,
  confirmDelete,
  dismissConfirmDelete,
  type ConfirmOptions as ConfirmDeleteOptions,
} from '../uab/primitives/overlay';
export { FormDrawer, type FormDrawerProps, type DrawerSize } from './FormDrawer';
export {
  DiscardBar,
  DiscardGuardProvider,
  FooterDiscardGuard,
  useDiscardGuard,
  useDiscardGuardState,
  type DiscardGuardState,
  type DiscardBarProps,
  type UseDiscardGuardOptions,
} from './DiscardGuard';

// Data Display
export { StatusBadge, type StatusBadgeProps, type StatusTone } from './StatusBadge';
export { StatCard, StatGrid } from './StatCard';
export { TruncatedText } from './TruncatedText';
export { EmptyValue, type EmptyValueProps } from './EmptyValue';
export { DateText, type DateTextProps } from './DateText';
export { InfoTip, type InfoTipProps } from './InfoTip';
export { OverflowChips, type OverflowChipsProps } from './OverflowChips';
export { CopyButton, copyToClipboard, type CopyButtonProps } from './CopyButton';
export { ProgressRing } from './ProgressRing';
export { MarkdownContent } from './MarkdownContent';

// Avatars
export { UserAvatar, type UserAvatarProps } from './UserAvatar';

// Date

// Views and records
export { ViewBar, type ViewBarProps, type ViewTab } from './ViewBar';
export {
  RecordInspector,
  type RecordInspectorProps,
  type InspectorTab,
  type InspectorComment,
} from './RecordInspector';

// Controls
export { SelectMenu, type SelectMenuProps } from './SelectMenu';
export { SearchInput } from './SearchInput';

// Forms
export { FormGrid, FormGridItem, type FormGridItemProps } from './FormGrid';

// Settings
export { SettingsSection, SettingsField, SettingsSaveBar } from './SettingsSection';

// Skeletons
export { TableSkeleton, type TableSkeletonColumn } from './TableSkeleton';
export { TableRowSkeleton } from './TableRowSkeleton';
export { CardListSkeleton } from './CardListSkeleton';

// Scroll
export { InfiniteScrollSentinel } from './InfiniteScrollSentinel';

// App Shell
export {
  AppShell,
  IconRail,
  Canvas,
  ContextSidebar,
  SidebarContent,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  MobileNav,
  TopBar,
  PageHeaderProvider,
  usePageHeader,
  useSetPageHeader,
  CommandPalette,
  useCommandShortcut,
  NotificationBell,
  AppearanceMenu,
  ThemePicker,
  UserMenu,
  type IconRailProps,
  type ContextSidebarProps,
  type SidebarContentProps,
  type MobileNavProps,
  type TopBarProps,
  type PageHeaderState,
  type CommandPaletteProps,
  type NotificationBellProps,
  type AppearanceMenuProps,
  type ThemePickerProps,
  type RailUtility,
  type RailModule,
  type SidebarChild,
  type SidebarItem,
  type SidebarSection,
  type AppShellUser,
  type UserMenuAction,
  type CommandEntry,
  type CommandGroupDef,
  type NotificationEntry,
} from './app-shell';

// NoAccess
export { NoAccess } from './NoAccess';

export { FormError } from './FormError';

// DataTable
export {
  DataTable,
  DataTablePagination,
  DataTableToolbar,
  type DataTableSearch,
  type DataTableFilterDef,
  type DataTableFilterOption,
  type DataTableFilterValues,
  type DataTableProps,
  type DataTableColumnDef,
  type RowAction,
  type SortState,
  type SortOrder,
  type PaginationState,
} from './data-table';

// Page Patterns
export { ListPage, type ListPageProps } from './patterns';
export { DetailPage, type DetailPageProps, type DetailPageTab } from './patterns';
export { FormPage, type FormPageProps } from './patterns';
