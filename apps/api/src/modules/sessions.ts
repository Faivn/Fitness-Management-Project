import {
  assertTransition,
  canReschedule,
  exerciseKey,
  InvalidTransitionError,
  localDateOf,
  todayIn,
  zonedToUtc,
  type FinishSessionInput,
  type LogActivityInput,
  type RescheduleSessionInput,
  type ScheduleActivityInput,
  type SessionStatus,
  type SetLogInput,
  type WorkoutSession,
  type WorkoutSessionDetail,
} from '@mova/shared';
import type { AppContext } from '../context.js';
import { must, mustOne } from '../db/helpers.js';
import { toScheduleChange, toSession, toSessionExercise, toSetLog } from '../db/mappers.js';
import { ApiError, conflict, fromDbError, unprocessable } from '../http/errors.js';
import { userTimezone } from './profile.js';
import { conflictError, existingSlots } from './scheduling.js';
import { detectConflicts } from '@mova/shared';

async function getSessionRow(ctx: AppContext, id: string) {
  return mustOne(ctx.db.from('workout_sessions').select('*').eq('id', id).maybeSingle(), 'Session');
}

function transitionOrThrow(from: SessionStatus, to: SessionStatus) {
  try {
    assertTransition(from, to);
  } catch (e) {
    if (e instanceof InvalidTransitionError) throw unprocessable(e.message);
    throw e;
  }
}

/** Planned sessions in range, plus unplanned activity that happened in range. */
export async function listSessions(ctx: AppContext, from: string, to: string): Promise<WorkoutSession[]> {
  const [planned, unplanned] = await Promise.all([
    must(ctx.db.from('workout_sessions').select('*').gte('planned_date', from).lte('planned_date', to).order('planned_date').order('planned_time')),
    must(ctx.db.from('workout_sessions').select('*').is('planned_date', null).gte('actual_date', from).lte('actual_date', to).order('actual_date')),
  ]);
  return [...planned, ...unplanned].map(toSession);
}

export async function getSessionDetail(ctx: AppContext, id: string): Promise<WorkoutSessionDetail> {
  const row = await getSessionRow(ctx, id);
  const [exercises, logs, changes] = await Promise.all([
    must(ctx.db.from('session_exercises').select('*').eq('session_id', id).order('sort_order')),
    must(ctx.db.from('exercise_logs').select('*').eq('session_id', id).order('set_number')),
    must(ctx.db.from('schedule_changes').select('*').eq('session_id', id).order('created_at')),
  ]);

  // WF-06/09: previous performance per exercise, read-only. Exact names only —
  // differently named exercises are never assumed to be the same.
  const names = [...new Set([...exercises.map((e: any) => e.display_name), ...logs.map((l: any) => l.exercise_name_snapshot)])];
  const previousPerformance: WorkoutSessionDetail['previousPerformance'] = {};
  if (names.length) {
    const prior = await must(
      ctx.db
        .from('exercise_logs')
        .select('session_id,exercise_id,exercise_name_snapshot,set_number,actual_reps,actual_weight,weight_unit,status')
        .in('exercise_name_snapshot', names)
        .neq('session_id', id)
        .eq('status', 'completed')
        .limit(1000),
    );
    const sessionIds = [...new Set(prior.map((p: any) => p.session_id))];
    const dates = sessionIds.length
      ? await must(ctx.db.from('workout_sessions').select('id,actual_date').in('id', sessionIds).not('actual_date', 'is', null))
      : [];
    const dateOf = new Map<string, string>(dates.map((d: any) => [d.id, d.actual_date as string]));
    const cutoff = row.actual_date ?? row.planned_date ?? '9999-12-31';
    const latest = new Map<string, { date: string; sessionId: string }>();
    for (const p of prior) {
      const d = dateOf.get(p.session_id);
      if (!d || d > cutoff) continue;
      const key = exerciseKey({ exerciseId: null, exerciseName: p.exercise_name_snapshot });
      const cur = latest.get(key);
      if (!cur || d > cur.date) latest.set(key, { date: d, sessionId: p.session_id });
    }
    for (const [key, { date, sessionId }] of latest) {
      previousPerformance[key] = {
        date,
        sets: prior
          .filter((p: any) => p.session_id === sessionId && exerciseKey({ exerciseId: null, exerciseName: p.exercise_name_snapshot }) === key)
          .sort((a: any, b: any) => a.set_number - b.set_number)
          .map((p: any) => ({
            setNumber: p.set_number,
            actualReps: p.actual_reps,
            actualWeight: p.actual_weight === null ? null : Number(p.actual_weight),
            weightUnit: p.weight_unit,
          })),
      };
    }
  }

  return {
    ...toSession(row),
    exercises: exercises.map(toSessionExercise),
    setLogs: logs.map(toSetLog),
    scheduleChanges: changes.map(toScheduleChange),
    previousPerformance,
  };
}

/** WF-06: opening a session never completes it; starting records actual start. */
export async function startSession(ctx: AppContext, id: string, startedAt?: string) {
  const s = await getSessionRow(ctx, id);
  if (s.status === 'in_progress') return toSession(s);
  transitionOrThrow(s.status, 'in_progress');
  const rows = await must(
    ctx.db
      .from('workout_sessions')
      .update({ status: 'in_progress', actual_start_at: s.actual_start_at ?? startedAt ?? ctx.now().toISOString() })
      .eq('id', id)
      .eq('status', s.status)
      .select('*'),
  );
  if (!rows[0]) throw conflict('This session changed in the meantime. Reload and try again.');
  return toSession(rows[0]);
}

function logRow(ctx: AppContext, sessionId: string, l: SetLogInput) {
  return {
    user_id: ctx.user.id,
    session_id: sessionId,
    session_exercise_id: l.sessionExerciseId ?? null,
    exercise_name_snapshot: l.exerciseName,
    set_number: l.setNumber,
    actual_reps: l.actualReps ?? null,
    actual_weight: l.actualWeight ?? null,
    weight_unit: l.weightUnit ?? null,
    status: l.status,
    notes: l.notes ?? null,
    client_id: l.clientId,
  };
}

/**
 * Save set logs as they are entered, so they survive navigation and app
 * restarts. Keyed by clientId: retries update the same row, never duplicate.
 * Completed sessions are changed only through the audited correction path.
 */
export async function upsertSetLogs(ctx: AppContext, id: string, logs: SetLogInput[]) {
  const s = await getSessionRow(ctx, id);
  if (s.status !== 'in_progress' && s.status !== 'incomplete') {
    throw unprocessable(
      s.status === 'completed'
        ? 'This workout is already completed. Use "Correct" on a set to change it.'
        : 'Start the session before logging sets.',
    );
  }
  const clientIds = logs.map((l) => l.clientId);
  const existing = await must(ctx.db.from('exercise_logs').select('id,client_id,session_id').in('client_id', clientIds));
  if (existing.some((e: any) => e.session_id !== id)) throw conflict('Some sets belong to another session.');
  const rows = await must(
    ctx.db
      .from('exercise_logs')
      .upsert(logs.map((l) => logRow(ctx, id, l)), { onConflict: 'user_id,client_id' })
      .select('*'),
  );
  return rows.map(toSetLog);
}

export async function correctSetLog(
  ctx: AppContext,
  logId: string,
  input: { actualReps?: number | null; actualWeight?: number | null; weightUnit?: 'kg' | 'lb' | null; status?: 'completed' | 'skipped'; correctionReason?: string },
) {
  const current = await mustOne(ctx.db.from('exercise_logs').select('*').eq('id', logId).maybeSingle(), 'Set');
  const reps = input.actualReps === undefined ? current.actual_reps : input.actualReps;
  const weight = input.actualWeight === undefined ? current.actual_weight : input.actualWeight;
  const unit = input.weightUnit === undefined ? current.weight_unit : input.weightUnit;
  if (weight !== null && !unit) throw new ApiError(400, 'validation_failed', 'A weight needs a unit.');
  const { error } = await ctx.db.rpc('correct_exercise_log', {
    p_log_id: logId,
    p_actual_reps: reps,
    p_actual_weight: weight,
    p_weight_unit: unit,
    p_status: input.status ?? null,
    p_reason: input.correctionReason ?? null,
  });
  if (error) throw fromDbError(error);
  return toSetLog(await mustOne(ctx.db.from('exercise_logs').select('*').eq('id', logId).maybeSingle(), 'Set'));
}

/** Record completion with evidence: actual end time and actual local date. */
export async function finishSession(ctx: AppContext, id: string, input: FinishSessionInput) {
  const s = await getSessionRow(ctx, id);
  if (s.status === input.outcome) return toSession(s); // idempotent retry
  if (input.outcome === 'incomplete') transitionOrThrow(s.status, 'incomplete');
  else if (!['in_progress', 'incomplete', 'scheduled', 'missed'].includes(s.status)) transitionOrThrow(s.status, 'completed');

  const tz = await userTimezone(ctx);
  const end = input.endedAt ? new Date(input.endedAt) : ctx.now();
  const start = s.actual_start_at ? new Date(s.actual_start_at) : null;
  const patch: Record<string, unknown> = {
    status: input.outcome,
    actual_end_at: end.toISOString(),
    actual_date: localDateOf(end, tz),
    notes: input.notes ?? s.notes,
    actual_duration_seconds:
      input.durationSeconds ?? (start ? Math.max(1, Math.round((end.getTime() - start.getTime()) / 1000)) : null),
    actual_distance_value: input.distanceValue ?? s.actual_distance_value,
    actual_distance_unit: input.distanceUnit ?? s.actual_distance_unit,
  };
  const rows = await must(ctx.db.from('workout_sessions').update(patch).eq('id', id).eq('status', s.status).select('*'));
  if (!rows[0]) throw conflict('This session changed in the meantime. Reload and try again.');
  return toSession(rows[0]);
}

/** WF-07: conflict check against the proposed new slot, then an atomic, logged move. */
export async function rescheduleSession(ctx: AppContext, id: string, input: RescheduleSessionInput) {
  const s = await getSessionRow(ctx, id);
  if (!canReschedule(s.status)) throw unprocessable(`A ${s.status.replace('_', ' ')} session cannot be moved.`);
  const tz = await userTimezone(ctx);
  if (input.newDate < todayIn(tz, ctx.now())) throw new ApiError(400, 'validation_failed', 'Pick today or a later date.');

  const existing = await existingSlots(ctx, input.newDate, input.newDate, { excludeSessionId: id });
  const conflicts = detectConflicts(
    [{ id, title: s.title, plannedDate: input.newDate, plannedTime: input.newTime ?? null, durationMinutes: s.planned_duration_minutes }],
    existing,
  );
  if (conflicts.length && !input.acceptConflicts) throw conflictError(conflicts);

  const { error } = await ctx.db.rpc('reschedule_session', {
    p_session_id: id,
    p_new_date: input.newDate,
    p_new_time: input.newTime ?? null,
    p_reason: input.reason ?? null,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw fromDbError(error);
  return getSessionDetail(ctx, id);
}

export async function setSessionOutcome(ctx: AppContext, id: string, outcome: 'missed' | 'cancelled', reason: string | undefined, key: string) {
  const { error } = await ctx.db.rpc('set_session_outcome', {
    p_session_id: id,
    p_outcome: outcome,
    p_reason: reason ?? null,
    p_idempotency_key: key,
  });
  if (error) throw fromDbError(error);
  return getSessionDetail(ctx, id);
}

/** WF-12: schedule a run or other activity directly. */
export async function scheduleActivity(ctx: AppContext, input: ScheduleActivityInput) {
  const existingKey = await must(ctx.db.from('workout_sessions').select('*').eq('idempotency_key', input.idempotencyKey).limit(1));
  if (existingKey[0]) return toSession(existingKey[0]);
  const tz = await userTimezone(ctx);
  if (input.plannedDate < todayIn(tz, ctx.now())) throw new ApiError(400, 'validation_failed', 'Pick today or a later date. Use "Log activity" for past activities.');
  const existing = await existingSlots(ctx, input.plannedDate, input.plannedDate);
  const conflicts = detectConflicts(
    [{ title: input.title, plannedDate: input.plannedDate, plannedTime: input.plannedTime ?? null, durationMinutes: input.durationMinutes ?? null }],
    existing,
  );
  if (conflicts.length && !input.acceptConflicts) throw conflictError(conflicts);
  const row = await mustOne(
    ctx.db
      .from('workout_sessions')
      .insert({
        user_id: ctx.user.id,
        title: input.title,
        activity_type: input.activityType,
        source: 'manual',
        status: 'scheduled',
        original_planned_date: input.plannedDate,
        planned_date: input.plannedDate,
        planned_time: input.plannedTime ?? null,
        planned_duration_minutes: input.durationMinutes ?? null,
        planned_timezone: tz,
        notes: input.notes ?? null,
        idempotency_key: input.idempotencyKey,
      })
      .select('*')
      .maybeSingle(),
    'Session',
  );
  return toSession(row);
}

/**
 * WF-08 / WF-12: log an unscheduled or past activity. It never invents an
 * original schedule; if a matching planned session exists the user is asked to
 * link it (or confirm it is separate) instead of silently duplicating.
 */
export async function logActivity(ctx: AppContext, input: LogActivityInput) {
  const already = await must(ctx.db.from('workout_sessions').select('*').eq('idempotency_key', input.idempotencyKey).limit(1));
  if (already[0]) return { session: toSession(already[0]), linked: already[0].planned_date !== null };

  const tz = await userTimezone(ctx);
  const today = todayIn(tz, ctx.now());
  if (input.activityDate > today) throw new ApiError(400, 'validation_failed', 'An activity that already happened cannot be in the future. Schedule it instead.');

  const start = input.startTime ? zonedToUtc(input.activityDate, input.startTime, tz) : null;
  const end = start && input.durationSeconds ? new Date(start.getTime() + input.durationSeconds * 1000) : null;
  const actual = {
    actual_date: input.activityDate,
    actual_start_at: start?.toISOString() ?? null,
    actual_end_at: end?.toISOString() ?? null,
    actual_duration_seconds: input.durationSeconds ?? null,
    actual_distance_value: input.distanceValue ?? null,
    actual_distance_unit: input.distanceUnit ?? null,
  };

  if (input.plannedSessionId) {
    const planned = await getSessionRow(ctx, input.plannedSessionId);
    if (!['scheduled', 'missed', 'incomplete', 'in_progress'].includes(planned.status)) {
      throw unprocessable(`That planned session is already ${planned.status}.`);
    }
    const rows = await must(
      ctx.db
        .from('workout_sessions')
        .update({ ...actual, status: 'completed', notes: input.notes ?? planned.notes })
        .eq('id', planned.id)
        .eq('status', planned.status)
        .select('*'),
    );
    if (!rows[0]) throw conflict('That session changed in the meantime. Reload and try again.');
    if (input.sets.length) await insertLogs(ctx, planned.id, input.sets);
    return { session: toSession(rows[0]), linked: true };
  }

  if (!input.confirmSeparate) {
    const candidates = await must(
      ctx.db
        .from('workout_sessions')
        .select('*')
        .eq('planned_date', input.activityDate)
        .eq('activity_type', input.activityType)
        .in('status', ['scheduled', 'missed', 'in_progress', 'incomplete']),
    );
    if (candidates.length) {
      throw new ApiError(409, 'possible_duplicate', 'You had a matching session planned that day. Link this activity to it, or confirm it was separate.', {
        candidates: candidates.map(toSession),
      });
    }
  }

  const row = await mustOne(
    ctx.db
      .from('workout_sessions')
      .insert({
        user_id: ctx.user.id,
        title: input.title ?? defaultTitle(input.activityType),
        activity_type: input.activityType,
        source: input.activityDate < today ? 'historical_entry' : 'spontaneous',
        status: 'completed',
        ...actual,
        notes: input.notes ?? null,
        idempotency_key: input.idempotencyKey,
      })
      .select('*')
      .maybeSingle(),
    'Activity',
  );
  if (input.sets.length) await insertLogs(ctx, row.id, input.sets);
  return { session: toSession(row), linked: false };
}

async function insertLogs(ctx: AppContext, sessionId: string, sets: SetLogInput[]) {
  await must(
    ctx.db
      .from('exercise_logs')
      .upsert(sets.map((l) => logRow(ctx, sessionId, l)), { onConflict: 'user_id,client_id' })
      .select('id'),
  );
}

function defaultTitle(type: string): string {
  const map: Record<string, string> = {
    strength: 'Strength workout',
    running: 'Run',
    walking: 'Walk',
    cycling: 'Ride',
    swimming: 'Swim',
    mobility: 'Mobility',
    other: 'Activity',
  };
  return map[type] ?? 'Activity';
}
