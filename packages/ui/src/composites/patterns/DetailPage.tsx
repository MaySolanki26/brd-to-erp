import type { ReactNode } from 'react';
import { PageShell, PageShellBody } from '../PageShell';
import { InformativeBar } from '../InformativeBar';
import { PageLoader } from '../PageLoader';
import { PageError } from '../PageError';
import { NoAccess } from '../NoAccess';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../tabs';

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
  className,
}: DetailPageProps) {
  return (
    <PageShell className={className}>
      <InformativeBar title={title} onBack={onBack} badge={badge}>
        {state === 'ready' ? headerRight : null}
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
        <PageShellBody padded scroll>
          {tabs && tabs.length > 0 ? (
            <Tabs value={activeTab ?? tabs[0]?.key} onValueChange={onTabChange}>
              <TabsList>
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.key} value={tab.key}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {tabs.map((tab) => (
                <TabsContent key={tab.key} value={tab.key} className="mt-4">
                  {tab.content}
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            children
          )}
        </PageShellBody>
      )}
      {footer}
    </PageShell>
  );
}
