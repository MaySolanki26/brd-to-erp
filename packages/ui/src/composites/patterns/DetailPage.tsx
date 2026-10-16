import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { PageShell, PageShellBody } from '../PageShell';
import { InformativeBar } from '../InformativeBar';
import { SwitcherBar, type SwitcherItem } from '../SwitcherBar';
import { PageLoader } from '../PageLoader';
import { PageError } from '../PageError';
import { NoAccess } from '../NoAccess';

type DetailPageState = 'loading' | 'error' | 'no-access' | 'ready';

export interface DetailPageTab {
  key: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
}

export interface DetailPageProps {
  state: DetailPageState;
  children: ReactNode;

  // Header
  title?: ReactNode;
  onBack?: () => void;
  badge?: ReactNode;
  headerRight?: ReactNode;

  // Tabs
  tabs?: DetailPageTab[];
  activeTab?: string;
  onTabChange?: (key: string) => void;

  // Error
  errorMessage?: string;
  onRetry?: () => void;

  // NoAccess
  noAccessTitle?: string;
  noAccessDescription?: string;

  className?: string;
}

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
  onRetry,
  noAccessTitle,
  noAccessDescription,
  className,
}: DetailPageProps) {
  const switcherItems: SwitcherItem[] | undefined = tabs?.map((t) => ({
    key: t.key,
    label: t.label,
    icon: t.icon,
    count: t.count,
  }));

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
          <PageError message={errorMessage} onRetry={onRetry} />
        </PageShellBody>
      )}

      {state === 'no-access' && (
        <PageShellBody scroll>
          <NoAccess variant="full" title={noAccessTitle} description={noAccessDescription} />
        </PageShellBody>
      )}

      {state === 'ready' && (
        <>
          {switcherItems && activeTab && onTabChange && (
            <SwitcherBar
              items={switcherItems}
              value={activeTab}
              onChange={onTabChange}
            />
          )}
          <PageShellBody scroll>{children}</PageShellBody>
        </>
      )}
    </PageShell>
  );
}
