import type { FormEvent, ReactNode } from 'react';
import { Button } from '../../uab/primitives/Button';
import { useSetPageHeader } from '../app-shell/PageHeader';
import { InformativeBar } from '../InformativeBar';
import { PageLoader } from '../PageLoader';
import { PageError } from '../PageError';
import { NoAccess } from '../NoAccess';

type FormPageState = 'loading' | 'error' | 'no-access' | 'ready';

export interface FormPageProps {
  state: FormPageState;
  children: ReactNode;
  title?: string;
  /** The ⓘ description next to the title. */
  info?: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel?: () => void;
  onBack?: () => void;
  badge?: ReactNode;
  headerRight?: ReactNode;
  submitLabel?: string;
  cancelLabel?: string;
  submitting?: boolean;
  submitDisabled?: boolean;
  /** Kept for compatibility; the form grid decides how many columns fit. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  errorMessage?: string;
  errorDescription?: string;
  onRetry?: () => void;
  noAccessTitle?: string;
  noAccessDescription?: string;
  className?: string;
}

/** A full-page form: fields flow in the form grid; Cancel and Save sit in a footer at the bottom. */
export function FormPage({
  state,
  children,
  title,
  info,
  onSubmit,
  onCancel,
  onBack,
  badge,
  headerRight,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  submitting = false,
  submitDisabled = false,
  errorMessage,
  errorDescription,
  onRetry,
  noAccessTitle,
  noAccessDescription,
}: FormPageProps) {
  const inTopBar = useSetPageHeader(title, info);

  return (
    <div className="uab-page">
      <div className="uab-page-main">
        {!inTopBar && title && (
          <InformativeBar title={title} onBack={onBack} badge={badge}>
            {headerRight}
          </InformativeBar>
        )}
        {state === 'loading' && <PageLoader />}
        {state === 'error' && (
          <PageError message={errorMessage} description={errorDescription} onRetry={onRetry} />
        )}
        {state === 'no-access' && (
          <NoAccess title={noAccessTitle} description={noAccessDescription} />
        )}
        {state === 'ready' && (
          <form onSubmit={onSubmit} noValidate>
            <div className="uab-form-grid">{children}</div>
            <div className="uab-form-actions">
              {onCancel && <Button onClick={onCancel}>{cancelLabel}</Button>}
              <Button variant="primary" type="submit" disabled={submitDisabled || submitting}>
                {submitting ? 'Saving…' : submitLabel}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
