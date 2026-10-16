import { AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '../lib/cn';
import { Button } from '../button';

interface PageErrorProps {
  message?: string;
  description?: string;
  onRetry?: () => void;
  variant?: 'inline' | 'full';
  className?: string;
}

export function PageError({
  message = 'Failed to load data',
  description = 'Something went wrong. Please try again.',
  onRetry,
  variant = 'inline',
  className,
}: PageErrorProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        variant === 'full'
          ? 'h-full'
          : 'mt-4 rounded-xl border border-gray-100 bg-white py-12',
        className,
      )}
    >
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-50">
        <AlertCircle className="h-5 w-5 text-red-500" strokeWidth={1.5} />
      </div>

      <p className="text-foreground text-xl font-medium">{message}</p>
      <p className="text-muted-foreground mt-1 max-w-xs text-lg">{description}</p>

      {onRetry && (
        <Button variant="outline" size="xs" className="mt-4 h-8 gap-1.5 text-lg" onClick={onRetry}>
          <RefreshCw className="h-3 w-3" strokeWidth={1.5} />
          Retry
        </Button>
      )}
    </div>
  );
}
