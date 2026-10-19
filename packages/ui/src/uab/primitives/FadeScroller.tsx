import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '../lib/format';

/**
 * Horizontal strip that takes only the leftover width, scrolls sideways (hidden scrollbar)
 * and softly fades into the background on the side where content is hidden.
 * Same behaviour as the view tabs line; used for the filter-chip line.
 */
export function FadeScroller({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const measure = () => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  };
  useLayoutEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  });
  return (
    <div
      className={cx(
        'uab-viewbar-scroll-wrap uab-fade-scroller',
        edges.left && 'uab-fade-left',
        edges.right && 'uab-fade-right',
        className,
      )}
      aria-label={label}
    >
      <div ref={ref} className="uab-viewbar-scroll" onScroll={measure}>
        {children}
      </div>
    </div>
  );
}
