import type { LucideIcon } from 'lucide-react';
import { cx } from '../../uab/lib/format';
import type { RailModule, RailUtility } from './types';

export interface IconRailProps {
  modules: RailModule[];
  activeKey: string;
  /** Initials on the logo tile at the top. */
  brandInitials: string;
  brandLabel: string;
  onBrandSelect: () => void;
  /** Global tools at the bottom: search, inbox, settings. */
  utilities?: RailUtility[];
  className?: string;
}

function RailIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon size={20} strokeWidth={1.75} aria-hidden="true" focusable={false} />;
}

function RailBadge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span className="uab-icon-btn-badge uab-rail-badge" aria-hidden="true">
      {count > 9 ? '9+' : count}
    </span>
  );
}

/**
 * The global icon rail: logo, module shortcuts, then global tools at the bottom. The selected module
 * is shown by its own tile; there is no indicator bar beside it. Tooltips come from `data-tooltip`.
 */
export function IconRail({
  modules,
  activeKey,
  brandInitials,
  brandLabel,
  onBrandSelect,
  utilities = [],
  className,
}: IconRailProps) {
  return (
    <nav className={cx('uab-rail', className)} aria-label="Modules">
      <button
        type="button"
        className="uab-rail-brand"
        aria-label={`${brandLabel} home`}
        data-tooltip={brandLabel}
        onClick={onBrandSelect}
      >
        <span aria-hidden="true">{brandInitials}</span>
      </button>
      <ul className="uab-rail-list">
        {modules
          .filter((module) => module.visible !== false)
          .map((module) => (
            <li key={module.key}>
              <button
                type="button"
                className={cx('uab-rail-item', module.key === activeKey && 'uab-is-active')}
                aria-current={module.key === activeKey ? 'page' : undefined}
                aria-label={module.label}
                data-tooltip={module.label}
                onClick={module.onSelect}
              >
                <RailIcon icon={module.icon} />
                <RailBadge count={module.badge} />
              </button>
            </li>
          ))}
      </ul>
      <ul className="uab-rail-list uab-rail-bottom">
        {utilities.map((utility) => (
          <li key={utility.key}>
            <button
              type="button"
              className={cx('uab-rail-item', utility.active && 'uab-is-active')}
              aria-label={
                utility.badge ? `${utility.label}, ${utility.badge} unread` : utility.label
              }
              data-tooltip={utility.label}
              onClick={utility.onSelect}
            >
              <RailIcon icon={utility.icon} />
              <RailBadge count={utility.badge} />
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
