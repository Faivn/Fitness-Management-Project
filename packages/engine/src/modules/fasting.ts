import type { FastingScheduleInput, FastingState } from '@mova/shared';
import type { AppContext } from '../context.js';
import { hhmm, must } from '../db/helpers.js';
import { conflict, unprocessable } from '../http/errors.js';
import { getProfile } from './profile.js';

/**
 * WF-14: optional module. The configured window and recorded fasts are kept
 * separate — a planned window is never treated as a completed fast. Status is
 * computed on the client from this state with the shared fastingStatus rule.
 */
export async function getFastingState(ctx: AppContext): Promise<FastingState> {
  const profile = await getProfile(ctx);
  const [schedule, active, recent] = await Promise.all([
    must(ctx.db.from('fasting_schedules').select('*').limit(1)),
    must(ctx.db.from('fasting_sessions').select('*').is('ended_at', null).limit(1)),
    must(ctx.db.from('fasting_sessions').select('*').not('ended_at', 'is', null).order('started_at', { ascending: false }).limit(10)),
  ]);
  const s = schedule[0];
  return {
    enabled: profile.fastingEnabled,
    schedule: s ? { label: s.label, fastStartTime: hhmm(s.fast_start_time) ?? '00:00', fastHours: Number(s.fast_hours) } : null,
    activeFast: active[0] ? { id: active[0].id, startedAt: active[0].started_at, plannedHours: Number(active[0].planned_hours) } : null,
    recentFasts: recent.map((r: any) => ({ id: r.id, startedAt: r.started_at, endedAt: r.ended_at, plannedHours: Number(r.planned_hours) })),
  };
}

export async function setFastingSchedule(ctx: AppContext, input: FastingScheduleInput) {
  const tz = (await getProfile(ctx)).timezone;
  await must(
    ctx.db
      .from('fasting_schedules')
      .upsert(
        { user_id: ctx.user.id, label: input.label ?? null, fast_start_time: input.fastStartTime, fast_hours: input.fastHours, timezone: tz },
        { onConflict: 'user_id' },
      )
      .select('user_id'),
  );
  return getFastingState(ctx);
}

export async function startFast(ctx: AppContext, input: { startedAt?: string; plannedHours: number; idempotencyKey: string }) {
  const dup = await must(ctx.db.from('fasting_sessions').select('id').eq('idempotency_key', input.idempotencyKey).limit(1));
  if (!dup[0]) {
    const active = await must(ctx.db.from('fasting_sessions').select('id').is('ended_at', null).limit(1));
    if (active[0]) throw conflict('A fast is already in progress.');
    const started = input.startedAt ? new Date(input.startedAt) : ctx.now();
    if (started > ctx.now()) throw unprocessable('A fast cannot start in the future.');
    await must(
      ctx.db
        .from('fasting_sessions')
        .insert({ user_id: ctx.user.id, started_at: started.toISOString(), planned_hours: input.plannedHours, idempotency_key: input.idempotencyKey })
        .select('id'),
    );
  }
  return getFastingState(ctx);
}

export async function endFast(ctx: AppContext, endedAt?: string) {
  const active = await must(ctx.db.from('fasting_sessions').select('*').is('ended_at', null).limit(1));
  if (!active[0]) return getFastingState(ctx);
  const end = endedAt ? new Date(endedAt) : ctx.now();
  if (end <= new Date(active[0].started_at)) throw unprocessable('The end time must be after the start time.');
  await must(ctx.db.from('fasting_sessions').update({ ended_at: end.toISOString() }).eq('id', active[0].id).select('id'));
  return getFastingState(ctx);
}
