import { addDays, todayIn } from '@mova/shared';
import type { AppContext } from '../context.js';
import { must } from '../db/helpers.js';
import { getProfile } from './profile.js';

/**
 * `get_fitness_context` (spec §7.3): retrieves ONLY the user-owned records the
 * model needs, from persisted data — not from old conversation text — and
 * minimises what is sent to the provider (§10 privacy). No email, no ids of
 * other users, no free-text notes beyond the user's own training notes.
 */
export interface FitnessContext {
  today: string;
  timezone: string;
  units: { weight: string; distance: string };
  equipment: string[];
  trainingNotes: string | null;
  activeGoals: Array<{ id: string; title: string; priority: string; target: string | null }>;
  activeRoutines: Array<{ id: string; title: string; version: number; sessions: Array<{ title: string; dayOfWeek: number; activityType: string }> }>;
  recentActivity: Array<{ date: string; title: string; activityType: string; outcome: string; moved: boolean }>;
}

export async function getFitnessContext(ctx: AppContext): Promise<FitnessContext> {
  const profile = await getProfile(ctx);
  const today = todayIn(profile.timezone, ctx.now());
  const since = addDays(today, -21);

  const cols = 'id,title,activity_type,status,planned_date,original_planned_date,actual_date';
  const [goals, routines, planned, unplanned] = await Promise.all([
    must(ctx.db.from('fitness_goals').select('id,title,priority,target_value,target_unit,target_date').eq('status', 'active').limit(10)),
    must(ctx.db.from('workout_routines').select('id,title,current_version').eq('status', 'active').limit(3)),
    must(
      ctx.db
        .from('workout_sessions')
        .select(cols)
        .gte('planned_date', since)
        .lte('planned_date', today)
        .order('planned_date', { ascending: false })
        .limit(30),
    ),
    must(
      ctx.db
        .from('workout_sessions')
        .select(cols)
        .is('planned_date', null)
        .gte('actual_date', since)
        .order('actual_date', { ascending: false })
        .limit(15),
    ),
  ]);
  const sessions = [...planned, ...unplanned];

  const versions = routines.length
    ? await must(
        ctx.db
          .from('workout_routine_versions')
          .select('routine_id,version_number,plan_data')
          .in('routine_id', routines.map((r: any) => r.id)),
      )
    : [];

  return {
    today,
    timezone: profile.timezone,
    units: { weight: profile.weightUnit, distance: profile.distanceUnit },
    equipment: profile.equipment,
    trainingNotes: profile.trainingNotes,
    activeGoals: goals.map((g: any) => ({
      id: g.id,
      title: g.title,
      priority: g.priority,
      target: g.target_value ? `${g.target_value}${g.target_unit ? ` ${g.target_unit}` : ''}${g.target_date ? ` by ${g.target_date}` : ''}` : null,
    })),
    activeRoutines: routines.map((r: any) => {
      const v = versions.find((x: any) => x.routine_id === r.id && x.version_number === r.current_version) as any;
      return {
        id: r.id,
        title: r.title,
        version: r.current_version,
        sessions: (v?.plan_data?.sessions ?? []).map((s: any) => ({ title: s.title, dayOfWeek: s.dayOfWeek, activityType: s.activityType })),
      };
    }),
    recentActivity: sessions.map((s: any) => ({
      date: s.actual_date ?? s.planned_date,
      title: s.title,
      activityType: s.activity_type,
      outcome: s.status,
      moved: s.original_planned_date !== null && s.original_planned_date !== s.planned_date,
    })),
  };
}
