import {
  routinePlanSchema,
  type CreateManualRoutineInput,
  type Routine,
  type RoutineVersionSummary,
  type UpdateRoutineInput,
} from '@mova/shared';
import type { AppContext } from '../context.js';
import { todayIn } from '@mova/shared';
import { must, mustOne } from '../db/helpers.js';
import { userTimezone } from './profile.js';
import { fromDbError } from '../http/errors.js';
import { conflictError, planSchedule } from './scheduling.js';

async function toRoutine(ctx: AppContext, r: any): Promise<Routine> {
  const v = await mustOne(
    ctx.db
      .from('workout_routine_versions')
      .select('id,plan_data')
      .eq('routine_id', r.id)
      .eq('version_number', r.current_version)
      .maybeSingle(),
    'Routine version',
  );
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    source: r.source,
    currentVersion: r.current_version,
    currentVersionId: v.id,
    plan: routinePlanSchema.parse(v.plan_data),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listRoutines(ctx: AppContext): Promise<Routine[]> {
  const rows = await must(ctx.db.from('workout_routines').select('*').neq('status', 'archived').order('updated_at', { ascending: false }));
  return Promise.all(rows.map((r: any) => toRoutine(ctx, r)));
}

export async function getRoutine(ctx: AppContext, id: string): Promise<Routine & { versions: RoutineVersionSummary[] }> {
  const r = await mustOne(ctx.db.from('workout_routines').select('*').eq('id', id).maybeSingle(), 'Routine');
  const versions = await must(
    ctx.db
      .from('workout_routine_versions')
      .select('id,version_number,change_reason,created_at')
      .eq('routine_id', id)
      .order('version_number', { ascending: false }),
  );
  return {
    ...(await toRoutine(ctx, r)),
    versions: versions.map((v: any) => ({ id: v.id, versionNumber: v.version_number, changeReason: v.change_reason, createdAt: v.created_at })),
  };
}

/** WF-04: manual routines use exactly the same model and RPCs as AI ones. */
export async function createManualRoutine(ctx: AppContext, input: CreateManualRoutineInput) {
  let occurrences: unknown[] = [];
  let timezone = 'UTC';
  if (input.activate) {
    const s = await planSchedule(ctx, input.plan, input.schedule);
    if (s.conflicts.length && !input.acceptConflicts) throw conflictError(s.conflicts);
    occurrences = s.occurrences;
    timezone = s.timezone;
  }
  const { data, error } = await ctx.db.rpc('create_manual_routine', {
    p_plan: input.plan,
    p_activate: input.activate,
    p_occurrences: occurrences,
    p_timezone: timezone,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw fromDbError(error);
  const result = data as { routineId: string; sessionsCreated: number };
  return { routine: await getRoutine(ctx, result.routineId), sessionsCreated: result.sessionsCreated };
}

/**
 * Save a new version. Completed sessions keep the targets they were created
 * with; only FUTURE scheduled sessions are replaced, and only on request.
 */
export async function saveRoutineVersion(ctx: AppContext, id: string, input: UpdateRoutineInput) {
  const current = await mustOne(ctx.db.from('workout_routines').select('id,status').eq('id', id).maybeSingle(), 'Routine');
  const needsSessions = input.rescheduleFuture || (input.activate && current.status !== 'active');
  let occurrences: unknown[] = [];
  let timezone = await userTimezone(ctx);
  let today = todayIn(timezone, ctx.now());
  if (needsSessions) {
    const s = await planSchedule(ctx, input.plan, input.schedule, id);
    if (s.conflicts.length && !input.acceptConflicts) throw conflictError(s.conflicts);
    occurrences = s.occurrences;
    timezone = s.timezone;
    today = s.today;
  }
  const { data, error } = await ctx.db.rpc('save_routine_version', {
    p_routine_id: id,
    p_plan: input.plan,
    p_change_reason: input.changeReason ?? null,
    p_activate: input.activate,
    p_reschedule_future: input.rescheduleFuture,
    p_occurrences: occurrences,
    p_timezone: timezone,
    p_today: today,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw fromDbError(error);
  const result = data as { sessionsCreated: number; sessionsRetired: number };
  return { routine: await getRoutine(ctx, id), sessionsCreated: result.sessionsCreated, sessionsRetired: result.sessionsRetired };
}
