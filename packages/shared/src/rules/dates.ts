/**
 * Timezone policy (spec §9 rule 14, decision recorded in
 * docs/ARCHITECTURE_DECISIONS.md):
 *
 * - Every scheduled item stores the user's intended LOCAL date (`YYYY-MM-DD`)
 *   and, optionally, a local time (`HH:MM`) plus the IANA timezone it was
 *   planned in. The UTC instant is derived from those, never the reverse.
 * - "Today" is always computed in the user's preferred timezone.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isLocalDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function isLocalTime(value: string): boolean {
  return TIME_RE.test(value);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, number> = {};
  for (const p of fmt.formatToParts(instant)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  return {
    year: parts.year ?? 0,
    month: parts.month ?? 0,
    day: parts.day ?? 0,
    hour: parts.hour ?? 0,
    minute: parts.minute ?? 0,
    second: parts.second ?? 0,
  };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** The local calendar date of an instant in a timezone. */
export function localDateOf(instant: Date, timeZone: string): string {
  const p = zonedParts(instant, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** The local wall-clock time (HH:MM) of an instant in a timezone. */
export function localTimeOf(instant: Date, timeZone: string): string {
  const p = zonedParts(instant, timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function todayIn(timeZone: string, now: Date = new Date()): string {
  return localDateOf(now, timeZone);
}

/**
 * Convert a local date + time in `timeZone` to a UTC instant. Handles DST by
 * iterating on the zone offset. Non-existent local times (spring-forward gap)
 * resolve to the instant just after the gap.
 */
export function zonedToUtc(localDate: string, localTime: string, timeZone: string): Date {
  if (!isLocalDate(localDate)) throw new Error(`Invalid local date: ${localDate}`);
  if (!isLocalTime(localTime)) throw new Error(`Invalid local time: ${localTime}`);
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  const [hh, mm] = localTime.split(':').map(Number) as [number, number];
  const wallAsUtc = Date.UTC(y, m - 1, d, hh, mm, 0);

  let guess = wallAsUtc;
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(new Date(guess), timeZone);
    const seenAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const diff = seenAsUtc - wallAsUtc;
    if (diff === 0) break;
    guess -= diff;
  }
  return new Date(guess);
}

/** Add whole days to a local date string (calendar arithmetic, no timezone). */
export function addDays(localDate: string, days: number): string {
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday, for a local date string. */
export function dayOfWeek(localDate: string): number {
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function compareLocalDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Inclusive list of local dates between start and end. */
export function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  for (let cur = start; cur <= end; cur = addDays(cur, 1)) out.push(cur);
  return out;
}

/** Minutes since midnight for an HH:MM string. */
export function minutesOfDay(time: string): number {
  const [h, m] = time.split(':').map(Number) as [number, number];
  return h * 60 + m;
}
