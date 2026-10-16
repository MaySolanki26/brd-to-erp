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
