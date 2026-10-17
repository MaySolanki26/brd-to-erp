import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { PageShell, PageShellBody } from '../PageShell';
import { ActionBar } from '../ActionBar';
import { InformativeBar } from '../InformativeBar';
import { PageLoader } from '../PageLoader';
import { PageError } from '../PageError';
import { EmptyState } from '../EmptyState';
import { NoAccess } from '../NoAccess';

type ListPageState = 'loading' | 'empty' | 'error' | 'no-access' | 'ready';

export interface ListPageProps {
  state: ListPageState;
  /** Shown when `state` is "ready". */
  children: ReactNode;

  // Header: an InformativeBar when `title` is set, otherwise an ActionBar
  title?: ReactNode;
  info?: ReactNode;
  actionBarChildren?: ReactNode;
  actionBarRight?: ReactNode;

  /** Search and filters. Stays visible in every state so filters can be cleared. */
  toolbar?: ReactNode;
  /** Replaces the default spinner while loading, e.g. a table skeleton. */
  loadingFallback?: ReactNode;
  /** Pagination or other content below the list; shown only when ready. */
  footer?: ReactNode;
  /** Content after the page body, such as drawers and dialogs. */
  overlays?: ReactNode;

  // Error
  errorMessage?: string;
  errorDescription?: string;
  onRetry?: () => void;

  // Empty
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: LucideIcon;
  emptyAction?: ReactNode;

  // NoAccess
  noAccessTitle?: string;
  noAccessDescription?: string;

  className?: string;
}

export function ListPage({
  state,
  children,
  title,
  info,
  actionBarChildren,
  actionBarRight,
  toolbar,
  loadingFallback,
  footer,
  overlays,
  errorMessage,
  errorDescription,
  onRetry,
  emptyTitle = 'No results',
  emptyDescription,
  emptyIcon,
  emptyAction,
  noAccessTitle,
  noAccessDescription,
  className,
}: ListPageProps) {
  return (
    <PageShell className={className}>
      {title ? (
        <InformativeBar title={title} info={info}>
          {actionBarRight}
        </InformativeBar>
      ) : (
        (actionBarChildren || actionBarRight) && (
          <ActionBar bordered right={actionBarRight}>
            {actionBarChildren}
          </ActionBar>
        )
      )}
      <PageShellBody padded scroll>
        {toolbar}
        {state === 'loading' && (loadingFallback ?? <PageLoader />)}
        {state === 'error' && (
          <PageError message={errorMessage} description={errorDescription} onRetry={onRetry} />
        )}
        {state === 'no-access' && (
          <NoAccess title={noAccessTitle} description={noAccessDescription} />
        )}
        {state === 'empty' && (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            icon={emptyIcon}
            action={emptyAction}
          />
        )}
        {state === 'ready' && children}
        {state === 'ready' && footer}
      </PageShellBody>
      {overlays}
    </PageShell>
  );
}
