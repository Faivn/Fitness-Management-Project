import type { AppContext } from '../context.js';
import { must } from '../db/helpers.js';
import { toMealEntry } from '../db/mappers.js';
import { conflict } from '../http/errors.js';
import { listSessions } from './sessions.js';

/** WF-11: unified schedule from persisted records. */
export async function getSchedule(ctx: AppContext, from: string, to: string) {
  const [sessions, plans] = await Promise.all([
    listSessions(ctx, from, to),
    must(ctx.db.from('meal_plans').select('id').eq('status', 'active').lte('start_date', to).gte('end_date', from)),
  ]);
  const meals = plans.length
    ? await must(
        ctx.db
          .from('meal_plan_entries')
          .select('*')
          .in('meal_plan_id', plans.map((p: any) => p.id))
          .gte('entry_date', from)
          .lte('entry_date', to)
          .order('entry_date')
          .order('sort_order'),
      )
    : [];
  return { from, to, sessions, meals: meals.map(toMealEntry) };
}

function toReminder(r: any) {
  return {
    id: r.id,
    linkedEntityType: r.linked_entity_type,
    linkedEntityId: r.linked_entity_id,
    scheduledAt: r.scheduled_at,
    channel: r.channel,
    enabled: r.enabled,
    status: r.status,
  };
}

export async function listReminders(ctx: AppContext) {
  const rows = await must(ctx.db.from('reminders').select('*').order('scheduled_at'));
  return rows.map(toReminder);
}

/**
 * Upsert a reminder. The unique index prevents duplicate reminders for the
 * same event and channel; a moved session updates its existing reminder.
 * Delivery happens on-device; a reminder is never proof an activity happened.
 */
export async function saveReminder(
  ctx: AppContext,
  input: { linkedEntityType: string; linkedEntityId?: string; scheduledAt: string; channel: string; enabled: boolean },
) {
  let q = ctx.db
    .from('reminders')
    .select('id')
    .eq('linked_entity_type', input.linkedEntityType)
    .eq('channel', input.channel);
  q = input.linkedEntityId ? q.eq('linked_entity_id', input.linkedEntityId) : q.is('linked_entity_id', null);
  const existing = await must(q.limit(1));
  const values = {
    scheduled_at: input.scheduledAt,
    enabled: input.enabled,
    status: input.enabled ? 'scheduled' : 'disabled',
  };
  const rows = existing[0]
    ? await must(ctx.db.from('reminders').update(values).eq('id', existing[0].id).select('*'))
    : await must(
        ctx.db
          .from('reminders')
          .insert({
            user_id: ctx.user.id,
            linked_entity_type: input.linkedEntityType,
            linked_entity_id: input.linkedEntityId ?? null,
            channel: input.channel,
            ...values,
          })
          .select('*'),
      );
  if (!rows[0]) throw conflict('Could not save the reminder.');
  return toReminder(rows[0]);
}

export async function deleteReminder(ctx: AppContext, id: string) {
  await must(ctx.db.from('reminders').delete().eq('id', id).select('id'));
  return { id, deleted: true };
}
