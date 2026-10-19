import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, RotateCcw, Search, Star, type LucideIcon } from 'lucide-react';
import { cx } from '../../uab/lib/format';
import { IconButton } from '../../uab/primitives/Button';
import type { SidebarChild, SidebarItem, SidebarSection } from './types';

export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 360;
export const SIDEBAR_DEFAULT_WIDTH = 240;
const KEY_STEP = 16;

export interface SidebarContentProps {
  title: string;
  sections: SidebarSection[];
  activeKey: string | null;
  /** Items already resolved from any module; shown first under "Favorites". */
  favorites?: SidebarItem[];
  favoriteKeys?: readonly string[];
  onToggleFavorite?: (key: string) => void;
  /** Control at the right of the header, e.g. the collapse button. */
  headerAction?: ReactNode;
  /** Called after any row is chosen (used to close the mobile drawer). */
  onNavigate?: () => void;
}

interface Option {
  key: string;
  label: string;
  icon?: LucideIcon;
  onSelect?: () => void;
}

function flatten(sections: SidebarSection[]): Option[] {
  return sections
    .filter((section) => !section.recent)
    .flatMap((section) =>
      section.items
        .filter((item) => item.visible !== false)
        .flatMap((item): Option[] =>
          item.children?.length
            ? item.children.map((child) => ({ ...child, label: `${item.label} · ${child.label}` }))
            : [item],
        ),
    );
}

function Row({
  item,
  active,
  starred,
  child,
  onToggleFavorite,
  onChoose,
}: {
  item: { key: string; label: string; icon?: LucideIcon; count?: number };
  active: boolean;
  starred: boolean;
  child?: boolean;
  onToggleFavorite?: (key: string) => void;
  onChoose: () => void;
}) {
  const Icon = item.icon;
  return (
    <li className="uab-nav-item">
      <button
        type="button"
        className={cx(
          'uab-nav-row',
          (!Icon || child) && 'uab-nav-child',
          active && 'uab-is-active',
        )}
        aria-current={active ? 'page' : undefined}
        onClick={onChoose}
      >
        {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden="true" focusable={false} />}
        <span className="uab-nav-label">{item.label}</span>
      </button>
      {onToggleFavorite && (
        <button
          type="button"
          className={cx('uab-nav-star', starred && 'uab-is-on')}
          aria-pressed={starred}
          aria-label={
            starred ? `Remove ${item.label} from favorites` : `Add ${item.label} to favorites`
          }
          data-tooltip={starred ? 'Remove from favorites' : 'Add to favorites'}
          onClick={() => onToggleFavorite(item.key)}
        >
          <Star size={14} strokeWidth={1.75} aria-hidden="true" focusable={false} />
        </button>
      )}
    </li>
  );
}

/** The sidebar's rows: search, favourites, sections with groups. Shared by the desktop sidebar and the mobile drawer. */
export function SidebarContent({
  title,
  sections,
  activeKey,
  favorites = [],
  favoriteKeys = [],
  onToggleFavorite,
  headerAction,
  onNavigate,
}: SidebarContentProps) {
  const [query, setQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(new Set());
  const options = useMemo(() => flatten(sections), [sections]);
  const needle = query.trim().toLowerCase();
  const results = needle
    ? options.filter((option) => option.label.toLowerCase().includes(needle))
    : [];

  const choose = (onSelect?: () => void) => () => {
    onSelect?.();
    onNavigate?.();
  };

  const toggleGroup = (key: string) =>
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const renderChild = (child: SidebarChild) => (
    <Row
      key={child.key}
      item={child}
      active={child.key === activeKey}
      starred={favoriteKeys.includes(child.key)}
      child
      onToggleFavorite={onToggleFavorite}
      onChoose={choose(child.onSelect)}
    />
  );

  const renderItem = (item: SidebarItem, recent?: boolean) => {
    if (item.visible === false) return null;
    if (item.children?.length) {
      const open = !collapsedGroups.has(item.key);
      return (
        <li key={item.key} className="uab-nav-tree">
          <button
            type="button"
            className="uab-nav-row uab-nav-toggle"
            aria-expanded={open}
            onClick={() => toggleGroup(item.key)}
          >
            {open ? (
              <ChevronDown size={14} aria-hidden="true" />
            ) : (
              <ChevronRight size={14} aria-hidden="true" />
            )}
            <span className="uab-nav-label">{item.label}</span>
            <span className="uab-nav-count">{item.count ?? item.children.length}</span>
          </button>
          {open && (
            <ul className="uab-nav-list uab-nav-children">{item.children.map(renderChild)}</ul>
          )}
        </li>
      );
    }
    return (
      <Row
        key={item.key}
        item={recent ? { ...item, icon: RotateCcw } : item}
        active={item.key === activeKey}
        starred={favoriteKeys.includes(item.key)}
        onToggleFavorite={recent ? undefined : onToggleFavorite}
        onChoose={choose(item.onSelect)}
      />
    );
  };

  return (
    <>
      <div className="uab-sidebar-head">
        <span className="uab-sidebar-title">{title}</span>
        {headerAction}
      </div>
      <div className="uab-sidebar-search">
        <Search size={14} strokeWidth={1.75} aria-hidden="true" focusable={false} />
        <input
          type="search"
          placeholder={`Find a page (${options.length})`}
          aria-label="Find a page"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.key === 'Escape' && setQuery('')}
        />
      </div>
      <div className="uab-sidebar-scroll">
        {needle ? (
          <section aria-label="Results">
            <span className="uab-nav-section uab-is-static">Results</span>
            {results.length ? (
              <ul className="uab-nav-list">
                {results.map((option) => (
                  <Row
                    key={option.key}
                    item={option}
                    active={option.key === activeKey}
                    starred={favoriteKeys.includes(option.key)}
                    onToggleFavorite={onToggleFavorite}
                    onChoose={choose(option.onSelect)}
                  />
                ))}
              </ul>
            ) : (
              <p className="uab-nav-empty uab-muted">No pages match “{query}”.</p>
            )}
          </section>
        ) : (
          <>
            {favorites.length > 0 && (
              <section aria-label="Favorites">
                <span className="uab-nav-section uab-is-static">Favorites</span>
                <ul className="uab-nav-list">
                  {favorites.map((favorite) => (
                    <Row
                      key={favorite.key}
                      item={favorite}
                      active={favorite.key === activeKey}
                      starred
                      onToggleFavorite={onToggleFavorite}
                      onChoose={choose(favorite.onSelect)}
                    />
                  ))}
                </ul>
              </section>
            )}
            {sections.map((section) => (
              <section
                key={section.key}
                aria-label={section.label ?? title}
                className={section.recent ? 'uab-nav-group' : undefined}
              >
                {section.label && (
                  <span className="uab-nav-section uab-is-static">{section.label}</span>
                )}
                <ul className="uab-nav-list">
                  {section.items.map((item) => renderItem(item, section.recent))}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>
    </>
  );
}

export interface ContextSidebarProps extends Omit<
  SidebarContentProps,
  'headerAction' | 'onNavigate'
> {
  width: number;
  onWidthChange: (width: number) => void;
  /** The panel icon at the top of the sidebar that collapses it. */
  onCollapse: () => void;
  className?: string;
}

const clampWidth = (width: number): number =>
  Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)));

/** The module sidebar: resizable (200–360px), with a collapse toggle at the top. */
export function ContextSidebar({
  width,
  onWidthChange,
  onCollapse,
  className,
  ...content
}: ContextSidebarProps) {
  const startDrag = (startX: number) => {
    const start = width;
    const move = (event: PointerEvent) => onWidthChange(clampWidth(start + event.clientX - startX));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    // The width is the one dynamic value: the person drags it.
    <nav className={cx('uab-sidebar', className)} style={{ width }} aria-label="Module navigation">
      <SidebarContent
        {...content}
        headerAction={
          <IconButton
            icon="panel-left"
            label="Collapse sidebar"
            onClick={onCollapse}
            className="uab-sidebar-toggle"
          />
        }
      />
      <div
        className="uab-sidebar-resize"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        aria-valuemin={SIDEBAR_MIN_WIDTH}
        aria-valuemax={SIDEBAR_MAX_WIDTH}
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={(event) => {
          event.preventDefault();
          startDrag(event.clientX);
        }}
        onDoubleClick={() => onWidthChange(SIDEBAR_DEFAULT_WIDTH)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') onWidthChange(clampWidth(width - KEY_STEP));
          else if (event.key === 'ArrowRight') onWidthChange(clampWidth(width + KEY_STEP));
          else if (event.key === 'Home') onWidthChange(SIDEBAR_MIN_WIDTH);
          else if (event.key === 'End') onWidthChange(SIDEBAR_MAX_WIDTH);
          else return;
          event.preventDefault();
        }}
      />
    </nav>
  );
}
