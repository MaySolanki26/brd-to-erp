// Page Shell
export { PageShell, PageShellBody } from './PageShell';
export { ActionBar } from './ActionBar';
export { InformativeBar } from './InformativeBar';
export { SwitcherBar, type SwitcherItem } from './SwitcherBar';

// Feedback & States
export { EmptyState } from './EmptyState';
export { ErrorBoundary } from './ErrorBoundary';
export { PageError } from './PageError';
export { PageLoader } from './PageLoader';
export { DelayedFallback } from './DelayedFallback';

// Dialogs & Drawers
export { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog';
export { FormDrawer, DrawerShell, type FormDrawerProps, type DrawerShellProps, type DrawerSize } from './FormDrawer';
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
export { StatCard } from './StatCard';
export { TruncatedText } from './TruncatedText';
export { CopyButton, copyToClipboard, type CopyButtonProps } from './CopyButton';
export { ProgressRing } from './ProgressRing';
export { MarkdownContent } from './MarkdownContent';

// Avatars
export { UserAvatar, type UserAvatarProps } from './UserAvatar';
export { AvatarGroup, type AvatarGroupItem } from './AvatarGroup';

// Date
export { DatePicker, DatePickerPanel, DatePickerInput, type DayIndicator } from './DatePicker';
export { DateRangeControl } from './DateRangeControl';

// Controls
export { SearchInput } from './SearchInput';
export { ViewToggle, type ViewMode } from './ViewToggle';
export { FilterButton, type FilterButtonProps } from './FilterButton';

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
  AppSidebar,
  AppSidebarMobile,
  AppHeader,
  Breadcrumbs,
  UserMenu,
  useSidebarState,
  type NavItem,
  type NavChildItem,
  type BreadcrumbItem,
  type AppShellUser,
  type SidebarState,
  type UserMenuAction,
  type AppSidebarProps,
  type AppHeaderProps,
} from './app-shell';

// NoAccess
export { NoAccess } from './NoAccess';

// DataTable
export {
  DataTable,
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
