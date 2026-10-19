import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../lib/cn';
import { Button } from '../button';
import { useSetPageHeader } from './app-shell/PageHeader';

interface InformativeBarProps {
  title?: ReactNode;
  info?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  onBack?: () => void;
  leading?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function InformativeBar({
  title,
  info,
  icon,
  badge,
  onBack,
  leading,
  children,
  className,
}: InformativeBarProps) {
  // Inside the app shell the title and its description move to the top bar (no title row in the page).
  const inTopBar = useSetPageHeader(
    typeof title === 'string' ? title : undefined,
    typeof info === 'string' ? info : undefined,
  );
  const hasContent = Boolean(onBack || badge || children || leading || icon);
  if (inTopBar && !hasContent) return null;

  return (
    <div
      className={cn(
        'border-border bg-surface flex h-11 shrink-0 items-center gap-3 border-b px-5',
        className,
      )}
    >
      {onBack && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="-ml-1 shrink-0"
          onClick={onBack}
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        </Button>
      )}

      {leading ?? (
        <div className="flex min-w-0 items-center gap-2">
          {icon && <span className="text-muted-foreground flex shrink-0 items-center">{icon}</span>}
          {title && !inTopBar && (
            <h1 className="text-foreground truncate text-fs-primary font-semibold tracking-tight">
              {title}
            </h1>
          )}
          {badge && <span className="shrink-0">{badge}</span>}
          {info && !inTopBar && (
            <span className="text-muted-foreground truncate text-lg font-medium">{info}</span>
          )}
        </div>
      )}

      {children && <div className="ml-auto flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}
