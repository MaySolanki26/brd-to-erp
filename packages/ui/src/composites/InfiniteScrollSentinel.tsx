import { useEffect, useRef } from 'react';

interface InfiniteScrollSentinelProps {
  enabled: boolean;
  onLoadMore: () => void;
  root?: Element | null;
  rootMargin?: string;
}

export function InfiniteScrollSentinel({
  enabled,
  onLoadMore,
  root,
  rootMargin = '200px',
}: InfiniteScrollSentinelProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled || !ref.current) return;
    const target = ref.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) onLoadMore();
      },
      { root: root ?? null, rootMargin, threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [enabled, onLoadMore, root, rootMargin]);

  return <div ref={ref} aria-hidden className="h-px w-full" />;
}
