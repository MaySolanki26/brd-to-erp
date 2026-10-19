// Theme
export * from './theme';

// Utilities
export { cn } from './lib/cn';
export { safeStorage } from './lib/safe-storage';
export { getInitials, getAvatarColor } from './lib/avatar';
export { formatDateLong, formatDateShort, hasTimeOfDay, parseDateValue } from './lib/date-format';

// Primitives
export { Button, buttonVariants, type ButtonProps } from './button';
export { Input, type InputProps } from './input';
export { Textarea } from './textarea';
export { Label } from './label';
export { Checkbox } from './checkbox';
export { RadioGroup, RadioGroupItem } from './radio-group';
export { Switch } from './switch';
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from './card';
export { Badge, badgeVariants, type BadgeProps } from './badge';
export { Avatar, AvatarImage, AvatarFallback } from './avatar';
export { Separator } from './separator';
export { Skeleton } from './skeleton';
export { Progress } from './progress';
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from './table';
export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
} from './form';
export { toast, ToastProvider, useToast } from './toast';

// Template overlays and pickers
export {
  Dialog,
  Drawer,
  Popover,
  Menu,
  type DialogProps,
  type MenuItem,
} from './uab/primitives/overlay';
export { DatePicker } from './uab/primitives/DatePicker';
export { DateRangePicker } from './uab/primitives/DateRangePicker';
export { MultiSelectMenu, type MultiOption } from './uab/primitives/MultiSelectMenu';
export { Tabs } from './uab/primitives/feedback';

// Composites
export {
  // Page Shell
  PageShell,
  PageShellBody,
  ActionBar,
  InformativeBar,
  SwitcherBar,
  type SwitcherItem,
  // Feedback & States
  EmptyState,
  ErrorBoundary,
  PageError,
  PageLoader,
  DelayedFallback,
  // Dialogs & Drawers
  ConfirmDialog,
  type ConfirmDialogProps,
  FormDrawer,
  type FormDrawerProps,
  type DrawerSize,
  DiscardBar,
  DiscardGuardProvider,
  FooterDiscardGuard,
  useDiscardGuard,
  useDiscardGuardState,
  type DiscardGuardState,
  type DiscardBarProps,
  type UseDiscardGuardOptions,
  // Data Display
  StatusBadge,
  type StatusBadgeProps,
  type StatusTone,
  StatCard,
  StatGrid,
  TruncatedText,
  CopyButton,
  copyToClipboard,
  type CopyButtonProps,
  ProgressRing,
  MarkdownContent,
  // Avatars
  UserAvatar,
  type UserAvatarProps,
  // Date
  // Controls
  SearchInput,
  // Settings
  SettingsSection,
  SettingsField,
  SettingsSaveBar,
  // Skeletons
  TableSkeleton,
  type TableSkeletonColumn,
  TableRowSkeleton,
  CardListSkeleton,
  // Scroll
  InfiniteScrollSentinel,
  // App Shell
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
  InlineAlert,
  // Phase 2 shared pieces
  ConfirmHost,
  confirmDelete,
  dismissConfirmDelete,
  type ConfirmDeleteOptions,
  EmptyValue,
  type EmptyValueProps,
  DateText,
  type DateTextProps,
  InfoTip,
  type InfoTipProps,
  OverflowChips,
  type OverflowChipsProps,
  FormGrid,
  FormGridItem,
  type FormGridItemProps,
  ViewBar,
  type ViewBarProps,
  type ViewTab,
  RecordInspector,
  type RecordInspectorProps,
  type InspectorTab,
  type InspectorComment,
  SelectMenu,
  type SelectMenuProps,
  // NoAccess
  NoAccess,
  FormError,
  // DataTable
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
  // Page Patterns
  ListPage,
  type ListPageProps,
  DetailPage,
  type DetailPageProps,
  type DetailPageTab,
  FormPage,
  type FormPageProps,
} from './composites';
