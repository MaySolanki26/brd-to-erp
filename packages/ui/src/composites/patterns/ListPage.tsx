import type { ReactNode } from 'react';
import { PageShell, PageShellBody } from '../PageShell';
import { ActionBar } from '../ActionBar';
import { PageLoader } from '../PageLoader';
import { PageError } from '../PageError';
import { EmptyState } from '../EmptyState';
import { NoAccess } from '../NoAccess';

type ListPageState = 'loading' | 'empty' | 'error' | 'no-access' | 'ready';

export interface ListPageProps {
  state: ListPageState;
  children: ReactNode;

  // ActionBar
  actionBarChildren?: ReactNode;
  actionBarRight?: ReactNode;

  // Error
  errorMessage?: string;
  onRetry?: () => void;

  // Empty
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;

  // NoAccess
  noAccessTitle?: string;
  noAccessDescription?: string;

  className?: string;
}

export function ListPage({
  state,
  children,
  actionBarChildren,
  actionBarRight,
  errorMessage,
  onRetry,
  emptyTitle = 'No results',
  emptyDescription,
  emptyAction,
  noAccessTitle,
  noAccessDescription,
  className,
}: ListPageProps) {
  return (
    <PageShell className={className}>
      {(actionBarChildren || actionBarRight) && (
        <ActionBar bordered right={actionBarRight}>
          {actionBarChildren}
        </ActionBar>
      )}
      <PageShellBody scroll>
        {state === 'loading' && <PageLoader />}
        {state === 'error' && <PageError message={errorMessage} onRetry={onRetry} />}
        {state === 'no-access' && (
          <NoAccess variant="full" title={noAccessTitle} description={noAccessDescription} />
        )}
        {state === 'empty' && (
          <EmptyState
            fill
            title={emptyTitle}
            description={emptyDescription}
            action={emptyAction}
          />
        )}
        {state === 'ready' && children}
      </PageShellBody>
    </PageShell>
  );
}
