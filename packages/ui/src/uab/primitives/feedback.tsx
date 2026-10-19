import type { ReactNode } from 'react';
import { cx } from '../lib/format';
import { Button } from './Button';
import { Icon } from './Icon';

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

// ---------------------------------------------------------------- status chip (text + dot; never color-only)

export function StatusChip({
  label,
  tone = 'neutral',
  className,
}: {
  label: string;
  tone?: Tone;
  className?: string;
}) {
  if (!label) return null;
  return (
    <span className={cx('uab-chip', `uab-tone-${tone}`, className)}>
      <span className="uab-chip-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return <span className={cx('uab-badge', `uab-tone-${tone}`)}>{children}</span>;
}

export function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  const initials = name
    .replace('Dr. ', '')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');
  const hue = [...name].reduce((h, c) => (h + c.charCodeAt(0) * 7) % 360, 0);
  return (
    <span
      className="uab-avatar"
      style={{
        width: size,
        height: size,
        fontSize: 'var(--fs-supportive)',
        ['--avatar-h' as string]: hue,
      }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

// ---------------------------------------------------------------- states

export function EmptyState({
  icon = 'inbox',
  title,
  children,
  action,
}: {
  icon?: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="uab-state">
      <span className="uab-state-icon">
        <Icon name={icon} size={20} />
      </span>
      <p className="uab-state-title">{title}</p>
      {children && <p className="uab-state-text">{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  children,
  onRetry,
}: {
  title?: string;
  children?: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div className="uab-state" role="alert">
      <span className="uab-state-icon uab-tone-danger">
        <Icon name="alert" size={20} />
      </span>
      <p className="uab-state-title">{title}</p>
      {children && <p className="uab-state-text">{children}</p>}
      {onRetry && (
        <Button icon="reset" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function NoAccess({ what }: { what: string }) {
  return (
    <div className="uab-state">
      <span className="uab-state-icon">
        <Icon name="lock" size={20} />
      </span>
      <p className="uab-state-title">No access to {what}</p>
      <p className="uab-state-text">
        Your current role does not include this area. Switch role from the account menu to explore
        other permissions.
      </p>
    </div>
  );
}

export function Skeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="uab-skeleton" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <span key={i} className="uab-skeleton-row" />
      ))}
    </div>
  );
}

export function InlineAlert({
  tone = 'info',
  children,
  title,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  title?: string;
  children: ReactNode;
}) {
  const icon =
    tone === 'danger' || tone === 'warning' ? 'alert' : tone === 'success' ? 'check' : 'info';
  return (
    <div
      className={cx('uab-inline-alert', `uab-tone-${tone}`)}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <Icon name={icon} />
      <div>
        {title && <strong>{title}</strong>}
        <div>{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- tabs

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="uab-tabs">
      {tabs.map((t, i) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          id={`tab-${t.id}`}
          aria-selected={value === t.id}
          aria-controls={`panel-${t.id}`}
          tabIndex={value === t.id ? 0 : -1}
          className={cx('uab-tab', value === t.id && 'uab-is-active')}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              const next =
                tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
              if (!next) return;
              onChange(next.id);
              (
                e.currentTarget.parentElement?.querySelector(
                  `#tab-${next.id}`,
                ) as HTMLElement | null
              )?.focus();
            }
          }}
        >
          {t.label}
          {t.count !== undefined && <span className="uab-tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
