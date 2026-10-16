import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn';
import type { BreadcrumbItem } from './types';

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  maxVisible?: number;
  className?: string;
}

export function Breadcrumbs({ items, maxVisible = 4, className }: BreadcrumbsProps) {
  const displayItems = useMemo(() => {
    if (items.length <= maxVisible) return items;
    // Show first, ellipsis, then last (maxVisible - 1) items
    const tail = items.slice(-(maxVisible - 1));
    return [items[0]!, { label: '\u2026' } as BreadcrumbItem, ...tail];
  }, [items, maxVisible]);

  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center gap-1.5">
        {displayItems.map((item, idx) => {
          const isLast = idx === displayItems.length - 1;
          const isEllipsis = item.label === '\u2026';

          return (
            <li key={`${item.label}-${idx}`} className="flex items-center gap-1.5">
              {idx > 0 && (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
              {isLast || isEllipsis ? (
                <span
                  className={cn(
                    'text-xl',
                    isLast ? 'font-medium text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {item.label}
                </span>
              ) : item.href ? (
                <a
                  href={item.href}
                  className="text-xl text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </a>
              ) : item.onClick ? (
                <button
                  type="button"
                  onClick={item.onClick}
                  className="text-xl text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </button>
              ) : (
                <span className="text-xl text-muted-foreground">{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
