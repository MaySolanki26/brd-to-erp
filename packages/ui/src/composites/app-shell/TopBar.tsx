import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { IconButton } from '../../uab/primitives/Button';
import { InfoTip } from '../../uab/primitives/InfoTip';
import { usePageHeader } from './PageHeader';

export interface TopBarProps {
  /** Phones and tablets: opens the navigation drawer. */
  onMenu?: () => void;
  /** Set when the sidebar is collapsed: shows the panel icon that expands it. */
  onExpandSidebar?: () => void;
  /** Opens the command palette from the centred search box. */
  onSearch: () => void;
  /** Notifications, appearance and account controls. */
  right?: ReactNode;
}

const isMac = (): boolean =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Title and ⓘ at the left, global search in the centre, tools at the right. */
export function TopBar({ onMenu, onExpandSidebar, onSearch, right }: TopBarProps) {
  const header = usePageHeader();

  return (
    <div className="uab-topbar">
      <div className="uab-topbar-left">
        {onMenu && <IconButton icon="menu" label="Open navigation" onClick={onMenu} />}
        {onExpandSidebar && (
          <IconButton icon="panel-left" label="Expand sidebar" onClick={onExpandSidebar} />
        )}
        <div className="uab-topbar-title">
          {header && (
            <>
              <h1 className="uab-page-title">{header.title}</h1>
              {header.description && (
                <InfoTip text={header.description} label={`About ${header.title}`} />
              )}
            </>
          )}
        </div>
      </div>
      <button
        type="button"
        className="uab-topbar-search"
        onClick={onSearch}
        aria-label="Search pages and actions"
      >
        <Search size={14} strokeWidth={1.75} aria-hidden="true" focusable={false} />
        <span>Search…</span>
        <kbd>{isMac() ? '⌘ K' : 'Ctrl K'}</kbd>
      </button>
      <div className="uab-topbar-right">{right}</div>
    </div>
  );
}
