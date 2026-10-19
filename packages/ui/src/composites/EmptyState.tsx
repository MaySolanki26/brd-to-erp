import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { Button } from '../uab/primitives/Button';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  /** Kept for compatibility; the template state fills its container. */
  fill?: boolean;
  className?: string;
}

/** The template empty state: icon tile, title, one line of explanation and the next step. */
export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  actionLabel,
  onAction,
  action,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <div className="uab-state">
      <span className="uab-state-icon">
        <Icon size={20} strokeWidth={1.75} aria-hidden="true" focusable={false} />
      </span>
      <p className="uab-state-title">{title}</p>
      {description && <p className="uab-state-text">{description}</p>}
      {action}
      {secondaryAction}
      {!action && actionLabel && onAction && (
        <Button icon="plus" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
