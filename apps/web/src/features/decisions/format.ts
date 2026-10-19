import { formatDateLong, parseDateValue } from '@brd/ui';

/** "Fri, 16 Oct 2026 08:30 AM" for running text. */
export function formatDateTime(iso: string): string {
  const date = parseDateValue(iso);
  return date ? formatDateLong(date, true) : '';
}
