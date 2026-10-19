import type { ReactNode } from 'react';
import { TooltipLayer } from '../../uab/primitives/TooltipLayer';
import { PageHeaderProvider } from './PageHeader';

interface AppShellProps {
  /** Icon rail (hidden on phones by the caller). */
  rail?: ReactNode;
  /** Context sidebar; leave out when collapsed or on small screens. */
  sidebar?: ReactNode;
  topBar: ReactNode;
  /** `palette` when the person chose a colour palette; otherwise one of the four built-in rail skins. */
  railSkin?: 'softCharcoal' | 'midnightNavy' | 'graphiteBlack' | 'softLight' | 'palette';
  children: ReactNode;
}

/** Four regions: icon rail | context sidebar | workspace (top bar + page). Mounts the one global tooltip layer. */
export function AppShell({
  rail,
  sidebar,
  topBar,
  railSkin = 'softCharcoal',
  children,
}: AppShellProps) {
  return (
    <PageHeaderProvider>
      <div className="uab-app" data-rail-skin={railSkin}>
        <div className="uab-shell">
          {rail}
          {sidebar}
          <div className="uab-workspace">
            {topBar}
            {children}
          </div>
        </div>
        <TooltipLayer />
      </div>
    </PageHeaderProvider>
  );
}

/** The scrolling page area under the top bar. */
export function Canvas({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="uab-canvas" tabIndex={-1}>
      {children}
    </main>
  );
}
