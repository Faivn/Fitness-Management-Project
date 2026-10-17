import {
  calculatePersonalRecords,
  exerciseKey,
  normaliseExerciseName,
  summarisePeriod,
  todayIn,
  type ExerciseHistory,
  type PersonalRecord,
  type SessionForSummary,
  type SetLogForRecords,
} from '@mova/shared';
import type { AppContext } from '../context.js';
import { must } from '../db/helpers.js';
import { toSession } from '../db/mappers.js';
import { userTimezone } from './profile.js';

/**
 * Load every session relevant to a period (by original plan, current plan or
 * actual date) plus its schedule changes — the raw records behind History and
 * Monthly reviews.
 */
export async function loadPeriodRecords(ctx: AppContext, from: string, to: string) {
  const cols = '*';
  const [byOriginal, byPlanned, byActual] = await Promise.all([
    must(ctx.db.from('workout_sessions').select(cols).gte('original_planned_date', from).lte('original_planned_date', to)),
    must(ctx.db.from('workout_sessions').select(cols).gte('planned_date', from).lte('planned_date', to)),
    must(ctx.db.from('workout_sessions').select(cols).gte('actual_date', from).lte('actual_date', to)),
  ]);
  const byId = new Map<string, any>();
  for (const r of [...byOriginal, ...byPlanned, ...byActual]) byId.set(r.id, r);
  const rows = [...byId.values()];
  const ids = rows.map((r) => r.id);

  const [changes, logCounts] = ids.length
    ? await Promise.all([
        must(ctx.db.from('schedule_changes').select('session_id,change_type,created_at,old_date,new_date,reason').in('session_id', ids)),
        must(ctx.db.from('exercise_logs').select('session_id').in('session_id', ids)),
      ])
    : [[], []];
  const counts = new Map<string, number>();
  for (const l of logCounts) counts.set(l.session_id, (counts.get(l.session_id) ?? 0) + 1);

  const sessions: SessionForSummary[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    activityType: r.activity_type,
    source: r.source,
    status: r.status,
    originalPlannedDate: r.original_planned_date,
    plannedDate: r.planned_date,
    actualDate: r.actual_date,
    actualEndAt: r.actual_end_at,
    setLogCount: counts.get(r.id) ?? 0,
  }));
  return {
    rows,
    sessions,
    scheduleChanges: changes.map((c: any) => ({ sessionId: c.session_id, changeType: c.change_type, createdAt: c.created_at })),
    rawChanges: changes,
  };
}

/** History view: every activity in range with its outcome and move history. */
export async function getHistory(ctx: AppContext, from: string, to: string) {
  const tz = await userTimezone(ctx);
  const records = await loadPeriodRecords(ctx, from, to);
  const summary = summarisePeriod({
    periodStart: from,
    periodEnd: to,
    today: todayIn(tz, ctx.now()),
    sessions: records.sessions,
    scheduleChanges: records.scheduleChanges,
  });
  return { summary, sessions: records.rows.map(toSession) };
}

async function loadAllLogs(ctx: AppContext, nameFilter?: string): Promise<SetLogForRecords[]> {
  let q = ctx.db
    .from('exercise_logs')
    .select('id,session_id,exercise_id,exercise_name_snapshot,actual_reps,actual_weight,weight_unit,status')
    .limit(5000);
  if (nameFilter) q = q.eq('exercise_name_snapshot', nameFilter);
  const logs = await must(q);
  if (!logs.length) return [];
  const sessionIds = [...new Set(logs.map((l: any) => l.session_id))];
  const sessions = await must(ctx.db.from('workout_sessions').select('id,actual_date,status').in('id', sessionIds));
  const info = new Map<string, any>(sessions.map((s: any) => [s.id, s]));
  return logs
    .map((l: any): SetLogForRecords | null => {
      const s = info.get(l.session_id);
      return s?.actual_date
        ? {
            id: l.id,
            exerciseId: l.exercise_id,
            exerciseName: l.exercise_name_snapshot,
            actualReps: l.actual_reps,
            actualWeight: l.actual_weight === null ? null : Number(l.actual_weight),
            weightUnit: l.weight_unit,
            status: l.status,
            activityDate: s.actual_date,
          }
        : null;
    })
    .filter((x: SetLogForRecords | null): x is SetLogForRecords => x !== null);
}

/** WF-09: all personal records (method pr-v1, recalculated from source logs). */
export async function getPersonalRecords(ctx: AppContext): Promise<PersonalRecord[]> {
  return calculatePersonalRecords(await loadAllLogs(ctx));
}

/** Exercises the user has logged, most recent first. */
export async function listExercises(ctx: AppContext) {
  const logs = await loadAllLogs(ctx);
  const byKey = new Map<string, { exerciseKey: string; exerciseName: string; lastDate: string; sets: number }>();
  for (const l of logs) {
    const key = exerciseKey(l);
    const cur = byKey.get(key);
    if (!cur) byKey.set(key, { exerciseKey: key, exerciseName: l.exerciseName, lastDate: l.activityDate, sets: 1 });
    else {
      cur.sets++;
      if (l.activityDate > cur.lastDate) cur.lastDate = l.activityDate;
    }
  }
  return [...byKey.values()].sort((a, b) => b.lastDate.localeCompare(a.lastDate));
}

export async function getExerciseHistory(ctx: AppContext, name: string): Promise<ExerciseHistory> {
  const all = await loadAllLogs(ctx);
  const key = `name:${normaliseExerciseName(name)}`;
  const logs = all.filter((l) => exerciseKey(l) === key);
  const raw = logs.length
    ? await must(
        ctx.db
          .from('exercise_logs')
          .select('id,session_id,set_number,actual_reps,actual_weight,weight_unit,status')
          .in('id', logs.map((l) => l.id)),
      )
    : [];
  const dateOf = new Map(logs.map((l) => [l.id, l.activityDate]));
  const grouped = new Map<string, ExerciseHistory['entries'][number]>();
  for (const r of raw) {
    const entry: ExerciseHistory['entries'][number] = grouped.get(r.session_id) ?? { sessionId: r.session_id, date: dateOf.get(r.id) ?? '', sets: [] };
    entry.sets.push({
      id: r.id,
      setNumber: r.set_number,
      actualReps: r.actual_reps,
      actualWeight: r.actual_weight === null ? null : Number(r.actual_weight),
      weightUnit: r.weight_unit,
      status: r.status,
    });
    grouped.set(r.session_id, entry);
  }
  return {
    exerciseKey: key,
    exerciseName: logs[0]?.exerciseName ?? name,
    entries: [...grouped.values()]
      .map((e) => ({ ...e, sets: e.sets.sort((a, b) => a.setNumber - b.setNumber) }))
      .sort((a, b) => b.date.localeCompare(a.date)),
    records: calculatePersonalRecords(logs),
  };
}
