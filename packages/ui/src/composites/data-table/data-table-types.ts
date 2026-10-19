import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/* ── Column definition ──────────────────────────────── */

export interface DataTableColumnDef<TData> {
  id: string;
  header: string;
  cell?: (row: TData) => ReactNode;
  /** A minimum width in px; spare table width is shared across the data columns. */
  width?: number | string;
  /** Ignored: every table column is left-aligned, so each value starts under its header. */
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  sortKey?: string;
  /** `date` shows the value as "16 Oct, 2026" with the full value on hover. Default `text`. */
  kind?: 'text' | 'date';
  /** False keeps the column out of the Columns menu (a title column, for example). Default true. */
  canHide?: boolean;
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

/* ── Search & filters ───────────────────────────────── */

export interface DataTableSearch {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

export interface DataTableFilterOption {
  value: string;
  label: string;
}

export interface DataTableFilterDef {
  id: string;
  /** Also the accessible name of the select. */
  label: string;
  /** Text for the "no filter" choice. Defaults to "All <label>". */
  allLabel?: string;
  options: DataTableFilterOption[];
}

/** Selected value per filter id. An empty string or missing id means "all". */
export type DataTableFilterValues = Record<string, string>;

/* ── Row actions ────────────────────────────────────── */

export interface RowAction<TData> {
  key: string;
  /** A fixed label, or one that depends on the row ("Deactivate" or "Reactivate"). */
  label: string | ((row: TData) => string);
  /** Icon name from the template icon set, e.g. "eye" or "pencil". */
  icon?: string;
  /** Shown as an icon button in the Actions column; the others go into the "More" menu. */
  quick?: boolean;
  onClick: (row: TData) => void;
  destructive?: boolean;
  hidden?: (row: TData) => boolean;
  /** Greys the action out with this reason in its tooltip. */
  disabledReason?: (row: TData) => string | undefined;
}

/* ── DataTable props ────────────────────────────────── */

export interface DataTableProps<TData> {
  columns: DataTableColumnDef<TData>[];
  data: TData[];
  getRowId?: (row: TData) => string;
  /** Accessible name of the table. */
  ariaLabel?: string;
  /** Singular and plural nouns for the footer ("1–25 of 55 customers"). Default "item" / "items". */
  noun?: { one: string; other: string };

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

  // Server-driven search and filters (the page owns the state, e.g. in the URL)
  search?: DataTableSearch;
  filters?: DataTableFilterDef[];
  filterValues?: DataTableFilterValues;
  onFilterChange?: (id: string, value: string) => void;
  /** Receives every filter at once when the person presses Apply. Without it, `onFilterChange` is called per changed filter. */
  onApplyFilters?: (values: DataTableFilterValues) => void;
  onClearFilters?: () => void;

  // Columns the person hides in the Columns menu. Controlled, so the page can remember them.
  hiddenColumns?: string[];
  onHiddenColumnsChange?: (ids: string[]) => void;

  // Selection
  selectable?: boolean;
  selected?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  /** Buttons at the right end of the tools line when no rows are selected, e.g. "Add context note". */
  toolbarActions?: ReactNode;
  /** Shown at the right end of the tools line while rows are selected, e.g. "Change status" or "Export selected". */
  bulkActions?: ReactNode;

  // Row actions
  rowActions?: RowAction<TData>[];

  // Row click
  onRowClick?: (row: TData) => void;
  /** The row whose details are open (highlighted). */
  activeRowId?: string;
  /** Extra classes for a row, e.g. `row-attention` to highlight rows that need a look. */
  rowClassName?: (row: TData) => string | undefined;
}
