import { addDays, todayIn, type OverviewDay } from '@mova/shared';
import type { AppContext } from '../context.js';
import { must } from '../db/helpers.js';
import { toMealEntry, toSession } from '../db/mappers.js';
import { getFastingState } from './fasting.js';
import { getHydrationDay } from './hydration.js';
import { getProfile } from './profile.js';

/**
 * WF-05 daily overview, built only from persisted records. Planned meals are
 * shown as a timetable — never as meals eaten — and there are no calorie totals.
 */
export async function getOverview(ctx: AppContext, date?: string): Promise<OverviewDay> {
  const profile = await getProfile(ctx);
  const today = todayIn(profile.timezone, ctx.now());
  const day = date ?? today;

  const [planned, unplanned, overdue, activeRoutines, plans] = await Promise.all([
    must(ctx.db.from('workout_sessions').select('*').eq('planned_date', day).order('planned_time')),
    must(ctx.db.from('workout_sessions').select('*').is('planned_date', null).eq('actual_date', day)),
    // Past-due sessions never disappear automatically (WF-05 business rules).
    must(
      ctx.db
        .from('workout_sessions')
        .select('*')
        .lt('planned_date', today)
        .gte('planned_date', addDays(today, -14))
        .in('status', ['scheduled', 'in_progress'])
        .order('planned_date'),
    ),
    must(ctx.db.from('workout_routines').select('id').eq('status', 'active').limit(1)),
    must(ctx.db.from('meal_plans').select('id').eq('status', 'active').lte('start_date', day).gte('end_date', day).limit(1)),
  ]);

  const mealPlanId: string | null = plans[0]?.id ?? null;
  const meals = mealPlanId
    ? await must(ctx.db.from('meal_plan_entries').select('*').eq('meal_plan_id', mealPlanId).eq('entry_date', day).order('sort_order'))
    : [];

  const sessions = [...planned, ...unplanned].map(toSession);
  return {
    localDate: day,
    timezone: profile.timezone,
    sessions,
    needsAttention: day === today ? overdue.map(toSession) : [],
    // A rest day is a valid planned day: an active plan with nothing scheduled today.
    isRestDay: activeRoutines.length > 0 && planned.filter((s: any) => s.status !== 'cancelled').length === 0,
    hasActiveRoutine: activeRoutines.length > 0,
    meals: meals.map(toMealEntry),
    mealPlanId,
    // Disabled modules return null so the overview shows no empty panels.
    hydration: profile.hydrationEnabled ? await getHydrationDay(ctx, day) : null,
    fasting: profile.fastingEnabled ? await getFastingState(ctx) : null,
  };
}
