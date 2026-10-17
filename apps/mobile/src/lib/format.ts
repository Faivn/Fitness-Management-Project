import { formatDuration } from '@mova/shared';

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Fri 16 Oct" from a local date string — no timezone conversion. */
export function formatDate(localDate: string | null | undefined, withYear = false): string {
  if (!localDate) return 'No date';
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAY_SHORT[dow]} ${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ''}`;
}

/** "12 Oct": day and month only, for ranges whose days are shown elsewhere. */
export function formatDayMonth(localDate: string): string {
  const [, m, d] = localDate.split('-').map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]}`;
}

export function formatMonth(localDate: string): string {
  const [y, m] = localDate.split('-').map(Number) as [number, number];
  return `${MONTHS[m - 1]} ${y}`;
}

export function formatTimeRange(time: string | null, minutes: number | null): string | null {
  if (!time) return minutes ? `${minutes} min` : null;
  return minutes ? `${time} · ${minutes} min` : time;
}

export function formatSeconds(s: number | null | undefined): string | null {
  return s ? formatDuration(s) : null;
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export const ACTIVITY_LABELS: Record<string, string> = {
  strength: 'Strength',
  running: 'Run',
  walking: 'Walk',
  cycling: 'Ride',
  swimming: 'Swim',
  mobility: 'Mobility',
  other: 'Other',
};

export function monthBounds(localDate: string): { start: string; end: string } {
  const [y, m] = localDate.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, '0')}` };
}
