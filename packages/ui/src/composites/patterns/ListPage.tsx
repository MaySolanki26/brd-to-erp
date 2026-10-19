import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useSetPageHeader } from '../app-shell/PageHeader';
import { InformativeBar } from '../InformativeBar';
import { PageLoader } from '../PageLoader';
import { PageError } from '../PageError';
import { EmptyState } from '../EmptyState';
import { NoAccess } from '../NoAccess';
import { ViewBar, type ViewTab } from '../ViewBar';

type ListPageState = 'loading' | 'empty' | 'error' | 'no-access' | 'ready';

export interface ListPageProps {
  state: ListPageState;
  /** Shown when `state` is "ready". */
  children: ReactNode;

  /** Page title in the top bar; `info` is its ⓘ description. */
  title?: string;
  info?: string;
  /** Saved views as underline tabs. Without it, one tab named `viewLabel` (or the title) is shown. */
  views?: ViewTab[];
  activeView?: string;
  onViewChange?: (id: string) => void;
  viewLabel?: string;
  /** Export and the primary action, at the right of line 1. */
  actionBarRight?: ReactNode;
  actionBarChildren?: ReactNode;

  /** A custom tools line (search, filters) for lists that do not use DataTable. */
  toolbar?: ReactNode;
  /** Replaces the default skeleton while loading. */
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

/**
 * The template list page: title in the top bar, line 1 = view tabs + actions, line 2 = tools,
 * then the table on a white surface that runs edge to edge. Every state is handled here.
 */
export function ListPage({
  state,
  children,
  title,
  info,
  views,
  activeView,
  onViewChange,
  viewLabel,
  actionBarRight,
  actionBarChildren,
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
}: ListPageProps) {
  const inTopBar = useSetPageHeader(title, info);
  const tabs = views ?? [{ id: 'all', name: viewLabel ?? title ?? 'All' }];

  return (
    <div className="uab-page uab-page-resource">
      <div className="uab-page-main">
        {!inTopBar && title && <InformativeBar title={title} info={info} />}
        <ViewBar
          views={tabs}
          activeId={activeView ?? tabs[0]?.id ?? 'all'}
          onSelect={onViewChange ?? (() => undefined)}
          label={`${title ?? 'List'} views`}
          actions={
            actionBarRight || actionBarChildren ? (
              <>
                {actionBarChildren}
                {actionBarRight}
              </>
            ) : undefined
          }
        />
        {toolbar && <div className="uab-view-tools uab-view-tools-row">{toolbar}</div>}
        {state === 'ready' ? (
          <>
            {children}
            {footer}
          </>
        ) : (
          <div className="uab-content-surface">
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
          </div>
        )}
      </div>
      {overlays}
    </div>
  );
}
