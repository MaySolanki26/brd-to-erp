import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from '../../button';
import type { SortOrder, SortState } from './data-table-types';

interface DataTableSortHeaderProps {
  label: string;
  sortKey: string;
  sort?: SortState | null;
  onSort?: (sort: SortState) => void;
  align?: 'left' | 'center' | 'right';
}

function nextOrder(current: SortOrder | null): SortOrder {
  if (current === 'asc') return 'desc';
  return 'asc';
}

export function DataTableSortHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = 'left',
}: DataTableSortHeaderProps) {
  const isActive = sort?.key === sortKey;
  const currentOrder = isActive ? sort.order : null;

  const handleClick = () => {
    onSort?.({ key: sortKey, order: nextOrder(currentOrder) });
  };

  const Icon = isActive
    ? currentOrder === 'asc'
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <Button
      variant="ghost"
      size="xs"
      className={cn(
        '-ml-2 h-7 gap-1 text-lg font-medium',
        align === 'right' && '-mr-2 ml-auto',
        align === 'center' && 'mx-auto',
      )}
      onClick={handleClick}
    >
      {label}
      <Icon className={cn('h-3.5 w-3.5', !isActive && 'opacity-40')} />
    </Button>
  );
}
