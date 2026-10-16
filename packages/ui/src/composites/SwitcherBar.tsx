import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn';

export interface SwitcherItem<K extends string = string> {
  key: K;
  label?: ReactNode;
  icon?: LucideIcon;
  count?: number;
  responsiveLabel?: boolean;
}

interface SwitcherBarProps<K extends string = string> {
  items: SwitcherItem<K>[];
  value: K;
  onChange: (key: K) => void;
  variant?: 'line' | 'box';
  children?: ReactNode;
  className?: string;
}

export function SwitcherBar<K extends string = string>({
  items,
  value,
  onChange,
  variant = 'line',
  children,
  className,
}: SwitcherBarProps<K>) {
  if (variant === 'box') {
    return (
      <div
        className={cn(
          'bg-muted border-border/50 inline-flex shrink-0 rounded-lg border p-0.5',
          className,
        )}
      >
        {items.map((item) => {
          const isActive = item.key === value;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={cn(
                'flex cursor-pointer items-center gap-1.5 rounded-md px-3.5 py-1.5 text-lg font-medium transition-all',
                isActive
                  ? 'bg-background text-foreground font-semibold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />}
              {item.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'border-border bg-surface flex h-10 shrink-0 items-center border-b px-5',
        className,
      )}
    >
      <nav className="-ml-1.5 flex flex-1 gap-1.5 self-stretch overflow-x-auto">
        {items.map((item) => {
          const isActive = item.key === value;
          const Icon = item.icon;
          const responsive = item.responsiveLabel ?? true;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={cn(
                'hover:text-foreground relative flex items-center gap-1.5 whitespace-nowrap px-1.5 py-2.5 text-lg font-medium transition-colors',
                isActive ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />}
              {item.label && (
                <span className={cn(responsive && 'hidden sm:inline')}>{item.label}</span>
              )}
              {item.count !== undefined && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-xs font-medium',
                    isActive ? 'bg-primary-light text-primary' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {item.count}
                </span>
              )}
              {isActive && (
                <span className="bg-primary absolute -bottom-px left-0 right-0 h-0.5 rounded-full" />
              )}
            </button>
          );
        })}
      </nav>
      {children && <div className="ml-3 flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}
