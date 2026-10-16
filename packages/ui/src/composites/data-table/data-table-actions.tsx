import { MoreHorizontal } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from '../../button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../dropdown-menu';
import type { RowAction } from './data-table-types';

interface DataTableRowActionsProps<TData> {
  row: TData;
  actions: RowAction<TData>[];
}

export function DataTableRowActions<TData>({ row, actions }: DataTableRowActionsProps<TData>) {
  const visibleActions = actions.filter((a) => !a.hidden?.(row));
  if (visibleActions.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {visibleActions.map((action) => (
          <DropdownMenuItem
            key={action.key}
            onClick={(e) => {
              e.stopPropagation();
              action.onClick(row);
            }}
            className={cn(action.destructive && 'text-destructive')}
          >
            {action.icon && <action.icon className="mr-2 h-4 w-4" />}
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
