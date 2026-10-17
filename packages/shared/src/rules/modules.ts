import type { VolumeUnit } from '../enums.js';
import { addDays, localDateOf, zonedToUtc } from './dates.js';
import { toMl } from './units.js';

/** WF-13: total intake for one local date. Units are converted explicitly. */
export function hydrationTotalMl(
  entries: Array<{ quantity: number; unit: VolumeUnit; localDate: string }>,
  localDate: string,
): number {
  return entries
    .filter((e) => e.localDate === localDate)
    .reduce((sum, e) => sum + toMl(e.quantity, e.unit), 0);
}

export interface HydrationProgress {
  totalMl: number;
  targetMl: number;
  remainingMl: number;
  fraction: number;
}

export function hydrationProgress(totalMl: number, target: number, unit: VolumeUnit): HydrationProgress {
  const targetMl = toMl(target, unit);
  return {
    totalMl,
    targetMl,
    remainingMl: Math.max(0, targetMl - totalMl),
    fraction: targetMl > 0 ? Math.min(1, totalMl / targetMl) : 0,
  };
}

/**
 * WF-14 fasting status (ADR-008). A manually started fast takes precedence;
 * otherwise the status is derived from the saved daily schedule and local
 * time. A planned window is never treated as a completed fast.
 */
export interface FastingSchedule {
  fastStartTime: string;
  fastHours: number;
}

export interface ActiveFast {
  startedAt: string;
  plannedHours: number;
}

export type FastingStatus =
  | { state: 'fasting'; basis: 'manual' | 'schedule'; startedAt: string; endsAt: string; fraction: number }
  | { state: 'not_fasting'; nextFastStartsAt: string | null };

export function fastingStatus(
  schedule: FastingSchedule | null,
  active: ActiveFast | null,
  now: Date,
  timeZone: string,
): FastingStatus {
  if (active) {
    const start = new Date(active.startedAt);
    const end = new Date(start.getTime() + active.plannedHours * 3_600_000);
    const fraction = Math.min(1, Math.max(0, (now.getTime() - start.getTime()) / (end.getTime() - start.getTime())));
    return { state: 'fasting', basis: 'manual', startedAt: start.toISOString(), endsAt: end.toISOString(), fraction };
  }
  if (!schedule) return { state: 'not_fasting', nextFastStartsAt: null };

  const today = localDateOf(now, timeZone);
  // Check yesterday's and today's windows (a window can cross midnight).
  for (const date of [addDays(today, -1), today]) {
    const start = zonedToUtc(date, schedule.fastStartTime, timeZone);
    const end = new Date(start.getTime() + schedule.fastHours * 3_600_000);
    if (now >= start && now < end) {
      const fraction = (now.getTime() - start.getTime()) / (end.getTime() - start.getTime());
      return { state: 'fasting', basis: 'schedule', startedAt: start.toISOString(), endsAt: end.toISOString(), fraction };
    }
  }
  const todayStart = zonedToUtc(today, schedule.fastStartTime, timeZone);
  const next = todayStart > now ? todayStart : zonedToUtc(addDays(today, 1), schedule.fastStartTime, timeZone);
  return { state: 'not_fasting', nextFastStartsAt: next.toISOString() };
}
