import {
  addDays,
  describeConflict,
  detectConflicts,
  generateOccurrences,
  todayIn,
  type PlannedOccurrence,
  type RoutinePlan,
  type ScheduleConflict,
  type ScheduleSlot,
  type ScheduleWindow,
} from '@mova/shared';
import type { AppContext } from '../context.js';
import { hhmm, must } from '../db/helpers.js';
import { ApiError } from '../http/errors.js';
import { userTimezone } from './profile.js';

/** Existing scheduled (not finished) sessions in a date range, as conflict slots. */
export async function existingSlots(
  ctx: AppContext,
  from: string,
  to: string,
  opts: { excludeRoutineId?: string; excludeSessionId?: string } = {},
): Promise<ScheduleSlot[]> {
  let q = ctx.db
    .from('workout_sessions')
    .select('id,title,planned_date,planned_time,planned_duration_minutes,routine_id,status')
    .gte('planned_date', from)
    .lte('planned_date', to)
    .in('status', ['scheduled', 'in_progress']);
  if (opts.excludeSessionId) q = q.neq('id', opts.excludeSessionId);
  const rows = await must(q);
  return rows
    .filter((r: any) => !opts.excludeRoutineId || r.routine_id !== opts.excludeRoutineId)
    .map((r: any) => ({
      id: r.id,
      title: r.title,
      plannedDate: r.planned_date,
      plannedTime: hhmm(r.planned_time),
      durationMinutes: r.planned_duration_minutes,
    }));
}

export interface PlannedSchedule {
  timezone: string;
  today: string;
  window: ScheduleWindow;
  occurrences: PlannedOccurrence[];
  conflicts: ScheduleConflict[];
}

/**
 * Compute the sessions a routine would create and the conflicts they cause.
 * When the routine replaces an existing one, that routine's future sessions
 * (which will be retired) are not counted as conflicts.
 */
export async function planSchedule(
  ctx: AppContext,
  plan: RoutinePlan,
  window: ScheduleWindow | undefined,
  replacingRoutineId?: string,
): Promise<PlannedSchedule> {
  const timezone = await userTimezone(ctx);
  const today = todayIn(timezone, ctx.now());
  const w: ScheduleWindow = window ?? { startDate: today, weeks: 4 };
  if (w.startDate < today) {
    throw new ApiError(400, 'validation_failed', 'Schedules can only start today or later.', [{ path: 'schedule.startDate', message: 'Must be today or later.' }]);
  }
  const occurrences = generateOccurrences(plan, w);
  const end = addDays(w.startDate, w.weeks * 7 - 1);
  const existing = await existingSlots(ctx, w.startDate, end, { excludeRoutineId: replacingRoutineId });
  const conflicts = detectConflicts(
    occurrences.map((o) => ({ title: o.title, plannedDate: o.plannedDate, plannedTime: o.plannedTime, durationMinutes: o.durationMinutes })),
    existing,
  );
  return { timezone, today, window: w, occurrences, conflicts };
}

export function conflictError(conflicts: ScheduleConflict[]): ApiError {
  return new ApiError(409, 'schedule_conflict', 'Some planned times clash with your existing schedule. Review them, then confirm to continue.', {
    conflicts,
    messages: conflicts.map(describeConflict),
  });
}
