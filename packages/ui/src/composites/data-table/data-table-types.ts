import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/* ── Column definition ──────────────────────────────── */

export interface DataTableColumnDef<TData> {
  id: string;
  header: string;
  cell?: (row: TData) => ReactNode;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  sortKey?: string;
}

/* ── Sorting ────────────────────────────────────────── */

export type SortOrder = 'asc' | 'desc';

export interface SortState {
  key: string;
  order: SortOrder;
}

/* ── Pagination ─────────────────────────────────────── */

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

/* ── Row actions ────────────────────────────────────── */

export interface RowAction<TData> {
  key: string;
  label: string;
  icon?: LucideIcon;
  onClick: (row: TData) => void;
  destructive?: boolean;
  hidden?: (row: TData) => boolean;
}

/* ── DataTable props ────────────────────────────────── */

export interface DataTableProps<TData> {
  columns: DataTableColumnDef<TData>[];
  data: TData[];
  getRowId?: (row: TData) => string;

  // States
  loading?: boolean;
  error?: { message?: string; onRetry?: () => void } | null;

  // Empty
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: LucideIcon;
  emptyAction?: ReactNode;

  // Server-driven sort
  sort?: SortState | null;
  onSort?: (sort: SortState) => void;

  // Server-driven pagination
  pagination?: PaginationState;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];

  // Selection
  selectable?: boolean;
  selected?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;

  // Row actions
  rowActions?: RowAction<TData>[];

  // Row click
  onRowClick?: (row: TData) => void;

  // Styling
  className?: string;
  stickyHeader?: boolean;
  compact?: boolean;
}
