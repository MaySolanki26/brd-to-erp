import type { LegacyColumnDef } from '@tanstack/react-table/legacy';
import type { RowData } from '@tanstack/react-table';
import { Checkbox } from '../../checkbox';

export function createSelectionColumn<TData extends RowData>(): LegacyColumnDef<TData> {
  return {
    id: '__select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="translate-y-[2px]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-[2px]"
        onClick={(e) => e.stopPropagation()}
      />
    ),
    size: 40,
    enableSorting: false,
    enableHiding: false,
  };
}
