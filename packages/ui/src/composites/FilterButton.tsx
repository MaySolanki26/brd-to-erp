import { forwardRef, type ComponentProps } from 'react';
import { Filter } from 'lucide-react';
import { cn } from '../lib/cn';
import { Button } from '../button';

export interface FilterButtonProps extends ComponentProps<typeof Button> {
  activeCount?: number;
  label?: string;
}

export const FilterButton = forwardRef<HTMLButtonElement, FilterButtonProps>(function FilterButton(
  { activeCount = 0, label = 'Filter', className, ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      variant="outline"
      size="xs"
      className={cn('h-7 gap-1.5 text-lg', className)}
      {...props}
    >
      <Filter className="h-3.5 w-3.5" strokeWidth={1.5} />
      {label}
      {activeCount > 0 && (
        <span className="bg-primary text-primary-foreground ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-xs font-medium">
          {activeCount}
        </span>
      )}
    </Button>
  );
});
