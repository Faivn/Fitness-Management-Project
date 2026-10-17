import type { ActivityType } from '../enums.js';
import type { RoutinePlan, ScheduleWindow } from '../schemas/routine.js';
import { addDays, dayOfWeek, minutesOfDay } from './dates.js';

/** A concrete planned occurrence generated from a routine version. */
export interface PlannedOccurrence {
  /** Index of the session in routinePlan.sessions. */
  sessionIndex: number;
  title: string;
  activityType: ActivityType;
  plannedDate: string;
  plannedTime: string | null;
  durationMinutes: number | null;
}

/**
 * ADR-006: activating a routine creates concrete session instances for a
 * bounded window (default 4 weeks) instead of an open-ended recurrence.
 * Deterministic so retries produce the same rows.
 */
export function generateOccurrences(plan: RoutinePlan, window: ScheduleWindow): PlannedOccurrence[] {
  const totalDays = window.weeks * 7;
  const out: PlannedOccurrence[] = [];
  for (let offset = 0; offset < totalDays; offset++) {
    const date = addDays(window.startDate, offset);
    const dow = dayOfWeek(date);
    plan.sessions.forEach((s, sessionIndex) => {
      if (s.dayOfWeek !== dow) return;
      out.push({
        sessionIndex,
        title: s.title,
        activityType: s.activityType,
        plannedDate: date,
        plannedTime: s.startTime ?? null,
        durationMinutes: s.durationMinutes ?? null,
      });
    });
  }
  return out.sort((a, b) =>
    a.plannedDate === b.plannedDate
      ? (a.plannedTime ?? '').localeCompare(b.plannedTime ?? '')
      : a.plannedDate.localeCompare(b.plannedDate),
  );
}

/** Minimal shape needed to check a slot against existing plans. */
export interface ScheduleSlot {
  id?: string;
  title: string;
  plannedDate: string;
  plannedTime: string | null;
  durationMinutes: number | null;
}

export type ConflictKind = 'overlap' | 'same_day';

export interface ScheduleConflict {
  proposed: ScheduleSlot;
  existing: ScheduleSlot;
  kind: ConflictKind;
}

const DEFAULT_DURATION_MIN = 60;

function interval(slot: ScheduleSlot): [number, number] | null {
  if (!slot.plannedTime) return null;
  const start = minutesOfDay(slot.plannedTime);
  return [start, start + (slot.durationMinutes ?? DEFAULT_DURATION_MIN)];
}

/**
 * WF-03 / WF-07 / WF-11 conflict detection. Overlapping timed slots are
 * `overlap`; same-day slots where either side has no time are `same_day`
 * (surfaced for review, not silently ignored).
 */
export function detectConflicts(proposed: ScheduleSlot[], existing: ScheduleSlot[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  for (const p of proposed) {
    for (const e of existing) {
      if (p.id && e.id && p.id === e.id) continue;
      if (p.plannedDate !== e.plannedDate) continue;
      const a = interval(p);
      const b = interval(e);
      if (a && b) {
        if (a[0] < b[1] && b[0] < a[1]) conflicts.push({ proposed: p, existing: e, kind: 'overlap' });
      } else {
        conflicts.push({ proposed: p, existing: e, kind: 'same_day' });
      }
    }
  }
  return conflicts;
}

export function describeConflict(c: ScheduleConflict): string {
  const when = c.existing.plannedTime ? ` at ${c.existing.plannedTime}` : '';
  return c.kind === 'overlap'
    ? `"${c.proposed.title}" overlaps "${c.existing.title}"${when} on ${c.existing.plannedDate}.`
    : `"${c.proposed.title}" is on the same day as "${c.existing.title}"${when} (${c.existing.plannedDate}).`;
}
