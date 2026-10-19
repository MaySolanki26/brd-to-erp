import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '../uab/lib/format';
import { Button } from '../uab/primitives/Button';
import { Icon } from '../uab/primitives/Icon';
import { Menu } from '../uab/primitives/overlay';

export interface ViewTab {
  id: string;
  /** The tab label; a node lets a tab show a count. */
  name: ReactNode;
  /** Icon name from the template icon set. Defaults to a list icon. */
  icon?: string;
}

export interface ViewBarProps {
  views: ViewTab[];
  activeId: string;
  onSelect: (id: string) => void;
  /** Shows the "+" button right after the last view. */
  onAddView?: () => void;
  /** The current filters or columns differ from the saved view: shows the "Unsaved" menu. */
  unsaved?: boolean;
  onSaveView?: () => void;
  onSaveAsNew?: () => void;
  onReset?: () => void;
  /** Export and the primary action, at the right of the line. */
  actions?: ReactNode;
  /** Accessible name of the tab strip, e.g. "Customers views". */
  label?: string;
}

/**
 * Line 1 of a list page: view tabs and "+" at the left, Export and the primary action at the right,
 * with one thin line across the full width. The accent underline slides to the selected tab; views
 * beyond the free width scroll under the "+" and fade softly at the hidden edge.
 */
export function ViewBar({
  views,
  activeId,
  onSelect,
  onAddView,
  unsaved = false,
  onSaveView,
  onSaveAsNew,
  onReset,
  actions,
  label = 'Views',
}: ViewBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const [ink, setInk] = useState<{ left: number; width: number } | null>(null);
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const unsavedRef = useRef<HTMLButtonElement>(null);

  const measure = () => {
    const el = scrollRef.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((current) =>
      current.left === left && current.right === right ? current : { left, right },
    );
  };

  useLayoutEffect(() => {
    measure();
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [views.length]);

  // Keep the active view visible by scrolling only the tab strip (scrollIntoView would shift the page).
  useEffect(() => {
    const el = scrollRef.current;
    const tab = el?.querySelector<HTMLElement>(`[data-view-id="${activeId}"]`);
    if (!el || !tab) return;
    const left = tab.offsetLeft;
    const right = left + tab.offsetWidth;
    if (left < el.scrollLeft) el.scrollLeft = Math.max(0, left - 8);
    else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth + 8;
    measure();
  }, [activeId]);

  // One sliding underline glides from the old tab to the newly selected one.
  useLayoutEffect(() => {
    const place = () => {
      const tab = tabsRef.current?.querySelector<HTMLElement>(`[data-view-id="${activeId}"]`);
      setInk(tab ? { left: tab.offsetLeft, width: tab.offsetWidth } : null);
    };
    place();
    const el = tabsRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(place);
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeId, views.length, unsaved]);

  return (
    <div className="uab-view-toolbar uab-view-tabs-row">
      <div className="uab-viewbar" role="navigation" aria-label={label}>
        <div
          className={cx(
            'uab-viewbar-scroll-wrap',
            edges.left && 'uab-fade-left',
            edges.right && 'uab-fade-right',
          )}
        >
          <div ref={scrollRef} className="uab-viewbar-scroll" onScroll={measure}>
            <div ref={tabsRef} className="uab-viewbar-tabs" role="tablist" aria-label={label}>
              {ink && (
                <span
                  className="uab-view-tab-ink"
                  aria-hidden="true"
                  // The line follows the selected tab: position and width are measured.
                  style={{
                    transform: `translateX(${ink.left + 4}px)`,
                    width: Math.max(0, ink.width - 8),
                  }}
                />
              )}
              {views.map((view) => (
                <div
                  key={view.id}
                  className={cx('uab-view-tab', view.id === activeId && 'uab-is-active')}
                  data-view-id={view.id}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={view.id === activeId}
                    className="uab-view-tab-btn"
                    onClick={() => onSelect(view.id)}
                  >
                    <Icon name={view.icon ?? 'list'} size={14} />
                    <span>{view.name}</span>
                    {view.id === activeId && unsaved && (
                      <span className="uab-dirty-dot" aria-label="unsaved changes" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        {onAddView && (
          <button
            type="button"
            className="uab-view-add"
            aria-label="Add view"
            data-tooltip="Add view"
            onClick={onAddView}
          >
            <Icon name="plus" size={16} />
          </button>
        )}
        {unsaved && (
          <>
            <Button
              ref={unsavedRef}
              variant="ghost"
              iconRight="chevron-down"
              onClick={() => setUnsavedOpen(true)}
              aria-haspopup="menu"
              className="uab-viewbar-unsaved"
            >
              Unsaved
            </Button>
            <Menu
              open={unsavedOpen}
              onClose={() => setUnsavedOpen(false)}
              anchor={unsavedRef}
              label="Unsaved view changes"
              align="start"
              items={[
                ...(onSaveView
                  ? [{ id: 'save', label: 'Save', icon: 'check', onSelect: onSaveView }]
                  : []),
                ...(onSaveAsNew
                  ? [{ id: 'saveas', label: 'Save as new', icon: 'plus', onSelect: onSaveAsNew }]
                  : []),
                ...(onReset
                  ? [{ id: 'reset', label: 'Reset', icon: 'reset', onSelect: onReset }]
                  : []),
              ]}
            />
          </>
        )}
        <span className="uab-viewbar-spacer" />
        <span className="uab-viewbar-divider" aria-hidden="true" />
      </div>
      {actions && <div className="uab-view-tools uab-view-tools-primary">{actions}</div>}
    </div>
  );
}
