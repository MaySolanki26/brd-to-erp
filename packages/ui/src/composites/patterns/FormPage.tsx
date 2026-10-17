import type { ReactNode, FormEvent } from 'react';
import { cn } from '../../lib/cn';
import { Button } from '../../button';
import { PageShell, PageShellBody } from '../PageShell';
import { InformativeBar } from '../InformativeBar';
import { PageLoader } from '../PageLoader';
import { PageError } from '../PageError';
import { NoAccess } from '../NoAccess';

type FormPageState = 'loading' | 'error' | 'no-access' | 'ready';
type FormPageSize = 'sm' | 'md' | 'lg' | 'xl';

const sizeMap: Record<FormPageSize, string> = {
  sm: 'max-w-lg',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
};

export interface FormPageProps {
  state: FormPageState;
  children: ReactNode;

  // Header
  title?: ReactNode;
  onBack?: () => void;
  badge?: ReactNode;
  headerRight?: ReactNode;

  // Form
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  submitting?: boolean;
  submitDisabled?: boolean;
  size?: FormPageSize;

  // Error
  errorMessage?: string;
  errorDescription?: string;
  onRetry?: () => void;

  // NoAccess
  noAccessTitle?: string;
  noAccessDescription?: string;

  className?: string;
}

export function FormPage({
  state,
  children,
  title,
  onBack,
  badge,
  headerRight,
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  submitting = false,
  submitDisabled = false,
  size = 'md',
  errorMessage,
  errorDescription,
  onRetry,
  noAccessTitle,
  noAccessDescription,
  className,
}: FormPageProps) {
  return (
    <PageShell className={className}>
      <InformativeBar title={title} onBack={onBack} badge={badge}>
        {headerRight}
      </InformativeBar>

      {state === 'loading' && (
        <PageShellBody scroll>
          <PageLoader />
        </PageShellBody>
      )}

      {state === 'error' && (
        <PageShellBody scroll>
          <PageError
            variant="full"
            message={errorMessage}
            description={errorDescription}
            onRetry={onRetry}
          />
        </PageShellBody>
      )}

      {state === 'no-access' && (
        <PageShellBody scroll>
          <NoAccess variant="full" title={noAccessTitle} description={noAccessDescription} />
        </PageShellBody>
      )}

      {state === 'ready' && (
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <PageShellBody padded scroll>
            <div className={cn('mx-auto w-full', sizeMap[size])}>
              {children}
            </div>
          </PageShellBody>

          <div className="border-border bg-surface flex shrink-0 items-center justify-end gap-3 border-t px-5 py-3">
            {onCancel && (
              <Button type="button" variant="outline" size="sm" onClick={onCancel}>
                {cancelLabel}
              </Button>
            )}
            <Button type="submit" size="sm" disabled={submitDisabled || submitting}>
              {submitting ? 'Saving\u2026' : submitLabel}
            </Button>
          </div>
        </form>
      )}
    </PageShell>
  );
}
