import { cx } from '../../uab/lib/format';
import { IconButton } from '../../uab/primitives/Button';
import { SelectMenu } from '../../uab/primitives/SelectMenu';
import type { PaginationState } from './data-table-types';

interface DataTablePaginationProps {
  pagination: PaginationState;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  noun?: { one: string; other: string };
}

const GAP = 'gap';
type PageItem = number | typeof GAP;

/** 1 … p-1 p p+1 … N (1-based): the first and last page and the neighbours of the current one. */
export function pageItems(page: number, totalPages: number): PageItem[] {
  const items: PageItem[] = [];
  for (let current = 1; current <= totalPages; current += 1) {
    if (current === 1 || current === totalPages || Math.abs(current - page) <= 1)
      items.push(current);
    else if (items[items.length - 1] !== GAP) items.push(GAP);
  }
  return items;
}

/** Frozen footer: "1–25 of 55 customers" at the left, numbered pages and "25 / page" at the right. */
export function DataTablePagination({
  pagination,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
  noun = { one: 'item', other: 'items' },
}: DataTablePaginationProps) {
  const { page, pageSize, total } = pagination;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="uab-grid-footer">
      <span className="uab-grid-footer-range" aria-live="polite">
        <strong>
          {from}–{to}
        </strong>{' '}
        of {total.toLocaleString()} {total === 1 ? noun.one : noun.other}
      </span>
      <nav className="uab-grid-pages" aria-label="Pagination">
        <IconButton
          icon="chevron-left"
          label="Previous page"
          disabledReason={page <= 1 ? 'First page' : undefined}
          onClick={() => onPageChange?.(page - 1)}
        />
        {pageItems(page, totalPages).map((item, index) =>
          item === GAP ? (
            <span key={`gap-${String(index)}`} className="uab-grid-page-gap" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className={cx('uab-grid-page', item === page && 'uab-is-current')}
              aria-current={item === page ? 'page' : undefined}
              aria-label={`Page ${String(item)}`}
              onClick={() => onPageChange?.(item)}
            >
              {item}
            </button>
          ),
        )}
        <IconButton
          icon="chevron-right"
          label="Next page"
          disabledReason={page >= totalPages ? 'Last page' : undefined}
          onClick={() => onPageChange?.(page + 1)}
        />
      </nav>
      {onPageSizeChange && (
        <SelectMenu
          label="Rows per page"
          value={String(pageSize)}
          options={pageSizeOptions.map((size) => ({
            value: String(size),
            label: `${String(size)} / page`,
          }))}
          onChange={(value) => onPageSizeChange(Number(value))}
        />
      )}
    </div>
  );
}
