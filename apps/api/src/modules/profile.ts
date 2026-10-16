import type { Profile, PreferencesInput } from '@mova/shared';
import type { AppContext } from '../context.js';
import { mustOne } from '../db/helpers.js';
import { ApiError, fromDbError } from '../http/errors.js';
import { toProfile } from '../db/mappers.js';

export async function getProfile(ctx: AppContext): Promise<Profile> {
  const row = await mustOne(ctx.db.from('profiles').select('*').eq('id', ctx.user.id).maybeSingle(), 'Profile');
  return toProfile(row);
}

/** WF-01: entering the workspace records completion; no fitness questionnaire. */
export async function completeOnboarding(ctx: AppContext, timezone: string): Promise<Profile> {
  const current = await getProfile(ctx);
  if (current.onboardingCompletedAt) return current;
  const row = await mustOne(
    ctx.db
      .from('profiles')
      .update({ onboarding_completed_at: ctx.now().toISOString(), timezone })
      .eq('id', ctx.user.id)
      .select('*')
      .maybeSingle(),
    'Profile',
  );
  return toProfile(row);
}

/**
 * WF-16: preference changes affect future behaviour only. Disabling a module
 * flips a flag — its history is never deleted.
 */
export async function updatePreferences(ctx: AppContext, input: PreferencesInput): Promise<Profile> {
  const patch: Record<string, unknown> = {};
  if (input.timezone !== undefined) patch.timezone = input.timezone;
  if (input.unitSystem !== undefined) patch.unit_system = input.unitSystem;
  if (input.weightUnit !== undefined) patch.weight_unit = input.weightUnit;
  if (input.distanceUnit !== undefined) patch.distance_unit = input.distanceUnit;
  if (input.volumeUnit !== undefined) patch.volume_unit = input.volumeUnit;
  if (input.equipment !== undefined) patch.equipment = input.equipment;
  if (input.trainingNotes !== undefined) patch.training_notes = input.trainingNotes;
  if (input.hydrationEnabled !== undefined) patch.hydration_enabled = input.hydrationEnabled;
  if (input.fastingEnabled !== undefined) patch.fasting_enabled = input.fastingEnabled;
  if (input.workoutRemindersEnabled !== undefined) patch.workout_reminders_enabled = input.workoutRemindersEnabled;
  if (input.workoutReminderLeadMinutes !== undefined) patch.workout_reminder_lead_minutes = input.workoutReminderLeadMinutes;
  if (Object.keys(patch).length === 0) return getProfile(ctx);

  const row = await mustOne(
    ctx.db.from('profiles').update(patch).eq('id', ctx.user.id).select('*').maybeSingle(),
    'Profile',
  );
  return toProfile(row);
}

export async function userTimezone(ctx: AppContext): Promise<string> {
  return (await getProfile(ctx)).timezone;
}

/** A guest erases their own demo workspace (database refuses registered accounts). */
export async function deleteGuestWorkspace(ctx: AppContext): Promise<{ deleted: true }> {
  const { error } = await ctx.db.rpc('delete_guest_account', {});
  if (error) {
    if (/not_a_guest/.test(error.message ?? '')) throw new ApiError(403, 'not_a_guest', 'Only demo sessions can be erased this way.');
    throw fromDbError(error);
  }
  return { deleted: true };
}
