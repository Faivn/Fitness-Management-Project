import { hydrationTotalMl, localDateOf, todayIn, type HydrationDay, type HydrationEntryInput, type VolumeUnit } from '@mova/shared';
import type { AppContext } from '../context.js';
import { must, mustOne } from '../db/helpers.js';
import { getProfile } from './profile.js';

/** WF-13: optional module. Disabling it hides the module; records are kept. */
export async function getHydrationDay(ctx: AppContext, date?: string): Promise<HydrationDay> {
  const profile = await getProfile(ctx);
  const day = date ?? todayIn(profile.timezone, ctx.now());
  const [target, entries] = await Promise.all([
    must(ctx.db.from('hydration_targets').select('*').limit(1)),
    must(ctx.db.from('hydration_entries').select('*').eq('local_date', day).order('recorded_at')),
  ]);
  const list: Array<{ id: string; quantity: number; unit: VolumeUnit; recordedAt: string; localDate: string }> = entries.map((e: any) => ({
    id: e.id,
    quantity: Number(e.quantity),
    unit: e.unit as VolumeUnit,
    recordedAt: e.recorded_at,
    localDate: e.local_date as string,
  }));
  return {
    enabled: profile.hydrationEnabled,
    localDate: day,
    target: target[0] ? { dailyTarget: Number(target[0].daily_target), unit: target[0].unit } : null,
    totalMl: hydrationTotalMl(list, day),
    entries: list.map(({ localDate: _d, ...rest }) => rest),
  };
}

export async function setHydrationTarget(ctx: AppContext, dailyTarget: number, unit: VolumeUnit) {
  await must(
    ctx.db
      .from('hydration_targets')
      .upsert({ user_id: ctx.user.id, daily_target: dailyTarget, unit }, { onConflict: 'user_id' })
      .select('user_id'),
  );
  return getHydrationDay(ctx);
}

export async function addHydrationEntry(ctx: AppContext, input: HydrationEntryInput) {
  const existing = await must(ctx.db.from('hydration_entries').select('id').eq('idempotency_key', input.idempotencyKey).limit(1));
  if (!existing[0]) {
    const tz = (await getProfile(ctx)).timezone;
    const at = input.recordedAt ? new Date(input.recordedAt) : ctx.now();
    await mustOne(
      ctx.db
        .from('hydration_entries')
        .insert({
          user_id: ctx.user.id,
          quantity: input.quantity,
          unit: input.unit,
          recorded_at: at.toISOString(),
          local_date: localDateOf(at, tz),
          idempotency_key: input.idempotencyKey,
        })
        .select('id')
        .maybeSingle(),
      'Entry',
    );
  }
  return getHydrationDay(ctx);
}

/** Explicit user deletion of a mistaken entry (WF-13 state model). */
export async function deleteHydrationEntry(ctx: AppContext, id: string) {
  await must(ctx.db.from('hydration_entries').delete().eq('id', id).select('id'));
  return getHydrationDay(ctx);
}
