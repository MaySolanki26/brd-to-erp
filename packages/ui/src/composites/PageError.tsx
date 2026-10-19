import { AlertTriangle } from 'lucide-react';
import { Button } from '../uab/primitives/Button';

interface PageErrorProps {
  message?: string;
  description?: string;
  onRetry?: () => void;
  /** Kept for compatibility; the template state looks the same inline and full. */
  variant?: 'inline' | 'full';
  className?: string;
}

/** The template error state: what failed, why, and a Retry button. */
export function PageError({
  message = 'Failed to load data',
  description = 'Something went wrong. Please try again.',
  onRetry,
}: PageErrorProps) {
  return (
    <div className="uab-state" role="alert">
      <span className="uab-state-icon uab-tone-danger">
        <AlertTriangle size={20} strokeWidth={1.75} aria-hidden="true" focusable={false} />
      </span>
      <p className="uab-state-title">{message}</p>
      <p className="uab-state-text">{description}</p>
      {onRetry && (
        <Button icon="reset" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
