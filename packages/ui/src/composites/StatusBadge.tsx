import { cx } from '../uab/lib/format';
import { StatusChip } from '../uab/primitives/feedback';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'neutral';

export interface StatusBadgeProps {
  /** The display label. */
  label: string;
  /** Visual tone. When omitted, auto-detected from common status keywords. */
  tone?: StatusTone;
  /** Kept for compatibility: tables show a dot and text, panels show the tinted chip (both are the template chip). */
  variant?: 'dot' | 'pill';
  className?: string;
}

/** Auto-detect tone from common status keywords. */
function detectTone(label: string): StatusTone {
  const lower = label.toLowerCase();
  if (/complet|done|active|approved|paid|resolved/.test(lower)) return 'success';
  if (/pending|review|hold|draft|open/.test(lower)) return 'warning';
  if (/reject|cancel|fail|overdue|block|delete/.test(lower)) return 'danger';
  if (/progress|ongoing|running|started/.test(lower)) return 'info';
  return 'neutral';
}

const TEMPLATE_TONE = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
  brand: 'accent',
  neutral: 'neutral',
} as const;

/** The template status chip: a dot and text. In tables the tint is removed by the grid, so only the dot and coloured text remain. */
export function StatusBadge({ label, tone, className }: StatusBadgeProps) {
  return (
    <StatusChip
      label={label}
      tone={TEMPLATE_TONE[tone ?? detectTone(label)]}
      className={cx(className)}
    />
  );
}
