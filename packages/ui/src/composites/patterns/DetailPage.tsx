import type { ReactNode } from 'react';
import { Button } from '../../uab/primitives/Button';
import { useSetPageHeader } from '../app-shell/PageHeader';
import { InformativeBar } from '../InformativeBar';
import { PageLoader } from '../PageLoader';
import { PageError } from '../PageError';
import { NoAccess } from '../NoAccess';
import { ViewBar } from '../ViewBar';

type DetailPageState = 'loading' | 'error' | 'no-access' | 'ready';

export interface DetailPageTab {
  key: string;
  label: ReactNode;
  /** Rendered only while this tab is active. */
  content: ReactNode;
}

export interface DetailPageProps {
  state: DetailPageState;
  /** Body shown when `tabs` is not used. */
  children?: ReactNode;

  // Header
  title?: ReactNode;
  onBack?: () => void;
  badge?: ReactNode;
  headerRight?: ReactNode;

  // Tabs (the caller decides which tabs the user may see)
  tabs?: DetailPageTab[];
  activeTab?: string;
  onTabChange?: (key: string) => void;

  // Error
  errorMessage?: string;
  errorDescription?: string;
  onRetry?: () => void;

  // NoAccess
  noAccessTitle?: string;
  noAccessDescription?: string;

  /** Extra content after the body, such as confirm dialogs. */
  footer?: ReactNode;
  className?: string;
}

/**
 * The template record page: the title is in the top bar; line 1 is the section tabs (underline tabs with
 * a sliding line) with the badge, Back and actions at the right; the active section fills the page.
 */
export function DetailPage({
  state,
  children,
  title,
  onBack,
  badge,
  headerRight,
  tabs,
  activeTab,
  onTabChange,
  errorMessage,
  errorDescription,
  onRetry,
  noAccessTitle,
  noAccessDescription,
  footer,
}: DetailPageProps) {
  const inTopBar = useSetPageHeader(typeof title === 'string' ? title : undefined);
  const active = tabs?.find((tab) => tab.key === activeTab) ?? tabs?.[0];
  const actions = (
    <>
      {badge}
      {onBack && (
        <Button icon="chevron-left" onClick={onBack}>
          Back
        </Button>
      )}
      {state === 'ready' ? headerRight : null}
    </>
  );

  return (
    <div className="uab-page uab-page-resource">
      <div className="uab-page-main">
        {!inTopBar && title && <InformativeBar title={title} />}
        {state === 'ready' && tabs && tabs.length > 0 ? (
          <ViewBar
            views={tabs.map((tab) => ({ id: tab.key, name: tab.label, icon: 'list' }))}
            activeId={active?.key ?? ''}
            onSelect={(key) => onTabChange?.(key)}
            label="Sections"
            actions={actions}
          />
        ) : (
          <div className="uab-view-toolbar uab-view-tabs-row">
            <span className="uab-viewbar-spacer" />
            <div className="uab-view-tools uab-view-tools-primary">{actions}</div>
          </div>
        )}
        {state === 'loading' && <PageLoader />}
        {state === 'error' && (
          <PageError message={errorMessage} description={errorDescription} onRetry={onRetry} />
        )}
        {state === 'no-access' && (
          <NoAccess title={noAccessTitle} description={noAccessDescription} />
        )}
        {state === 'ready' && (tabs && tabs.length > 0 ? active?.content : children)}
      </div>
      {footer}
    </div>
  );
}
