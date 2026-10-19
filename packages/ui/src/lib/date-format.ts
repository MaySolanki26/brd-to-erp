const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses an ISO string or Date. A date-only string is read as a local day, not UTC midnight. */
export function parseDateValue(value: string | Date): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const dateOnly = DATE_ONLY.exec(value);
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** True when the value carries a time of day (a Date object or a string beyond YYYY-MM-DD). */
export function hasTimeOfDay(value: string | Date): boolean {
  return value instanceof Date || !DATE_ONLY.test(value);
}

/** "16 Oct, 2026" — the only date format shown in tables and details. */
export function formatDateShort(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]}, ${date.getFullYear()}`;
}

/** "Fri, 16 Oct 2026" plus " 08:30 AM" when the value has a time. */
export function formatDateLong(date: Date, withTime: boolean): string {
  const day = `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  if (!withTime) return day;
  const hours = date.getHours();
  const hour12 = String(hours % 12 === 0 ? 12 : hours % 12).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day} ${hour12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
}
