import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { CheckCircle2, Plus } from 'lucide-react';
import { cn } from '../lib/cn';
import { Button } from '../button';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  fill?: boolean;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon: Icon,
  actionLabel,
  onAction,
  action,
  secondaryAction,
  fill = false,
  className,
}: EmptyStateProps) {
  const hasCustomActions = Boolean(action || secondaryAction);

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-4 py-12 text-center',
        fill && 'my-auto min-h-full flex-1',
        className,
      )}
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        {Icon ? (
          <Icon className="h-8 w-8 text-primary" strokeWidth={1.5} />
        ) : (
          <CheckCircle2 className="h-8 w-8 text-primary" strokeWidth={1.5} />
        )}
      </div>

      <h3 className="text-foreground mb-1 text-3xl font-medium">{title}</h3>
      {description && (
        <p className="text-muted-foreground mb-4 max-w-sm text-xl">{description}</p>
      )}

      {hasCustomActions ? (
        <div className="flex items-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : (
        actionLabel &&
        onAction && (
          <Button onClick={onAction} size="xs" className="gap-2">
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            {actionLabel}
          </Button>
        )
      )}
    </div>
  );
}
