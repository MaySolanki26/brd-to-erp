import { cn } from '../lib/cn';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'neutral';

export interface StatusBadgeProps {
  /** The display label. */
  label: string;
  /** Visual tone. When omitted, auto-detected from common status keywords. */
  tone?: StatusTone;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

const TONE_MAP: Record<StatusTone, string> = {
  success: 'badge-tone-success border',
  warning: 'badge-tone-warning border',
  danger: 'badge-tone-danger border',
  info: 'badge-tone-info border',
  brand: 'badge-tone-brand border',
  neutral: 'badge-tone-neutral border',
};

/** Auto-detect tone from common status keywords. */
function detectTone(label: string): StatusTone {
  const lower = label.toLowerCase();
  if (/complet|done|active|approved|paid|resolved/.test(lower)) return 'success';
  if (/pending|review|hold|draft|open/.test(lower)) return 'warning';
  if (/reject|cancel|fail|overdue|block|delete/.test(lower)) return 'danger';
  if (/progress|ongoing|running|started/.test(lower)) return 'info';
  return 'neutral';
}

export function StatusBadge({ label, tone, size = 'sm', className }: StatusBadgeProps) {
  const resolvedTone = tone ?? detectTone(label);

  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full font-medium',
        TONE_MAP[resolvedTone],
        size === 'xs' && 'px-1.5 py-0.5 text-xs',
        size === 'sm' && 'px-2.5 py-0.5 text-lg',
        size === 'md' && 'px-3 py-1 text-xl',
        className,
      )}
    >
      {label}
    </span>
  );
}
