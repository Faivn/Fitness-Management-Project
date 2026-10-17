import { z } from 'zod';
import { REMINDER_CHANNELS, UNIT_SYSTEMS } from '../enums.js';
import {
  idempotencyKey,
  isoDateTime,
  localDate,
  localTime,
  requiredText,
  shortText,
  timeZone,
  uuid,
  volumeUnit,
  weightUnit,
  distanceUnit,
} from './common.js';

/** WF-16 basic preferences. All fields optional — no complete profile required. */
export const preferencesSchema = z.object({
  timezone: timeZone.optional(),
  unitSystem: z.enum(UNIT_SYSTEMS).optional(),
  weightUnit: weightUnit.optional(),
  distanceUnit: distanceUnit.optional(),
  volumeUnit: volumeUnit.optional(),
  equipment: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  trainingNotes: z.string().trim().max(1000).nullable().optional(),
  hydrationEnabled: z.boolean().optional(),
  fastingEnabled: z.boolean().optional(),
  workoutRemindersEnabled: z.boolean().optional(),
  workoutReminderLeadMinutes: z.number().int().min(0).max(1440).optional(),
});
export type PreferencesInput = z.infer<typeof preferencesSchema>;

export const completeOnboardingSchema = z.object({
  timezone: timeZone,
});

/** WF-13 hydration. */
export const hydrationTargetSchema = z.object({
  dailyTarget: z.number().positive().max(10_000),
  unit: volumeUnit,
});

export const hydrationEntrySchema = z.object({
  quantity: z.number().positive().max(5_000),
  unit: volumeUnit,
  recordedAt: isoDateTime.optional(),
  idempotencyKey,
});
export type HydrationEntryInput = z.infer<typeof hydrationEntrySchema>;

/** WF-14 fasting schedule: daily eating window start + fasting length. */
export const fastingScheduleSchema = z.object({
  label: shortText(40),
  fastStartTime: localTime,
  fastHours: z.number().min(1).max(72),
});
export type FastingScheduleInput = z.infer<typeof fastingScheduleSchema>;

export const startFastSchema = z.object({
  startedAt: isoDateTime.optional(),
  plannedHours: z.number().min(1).max(72),
  idempotencyKey,
});

export const endFastSchema = z.object({
  endedAt: isoDateTime.optional(),
});

/** WF-11 reminders. */
export const reminderSchema = z.object({
  linkedEntityType: z.enum(['workout_session', 'hydration', 'fasting']),
  linkedEntityId: uuid.optional(),
  scheduledAt: isoDateTime,
  channel: z.enum(REMINDER_CHANNELS).default('local'),
  enabled: z.boolean().default(true),
});

/** WF-15 monthly review. */
export const generateMonthlyReviewSchema = z
  .object({
    periodStart: localDate,
    periodEnd: localDate,
    reflection: shortText(2000),
  })
  .refine((r) => r.periodStart <= r.periodEnd, { message: 'Period start must be before its end.', path: ['periodEnd'] });

export const saveMonthlyReviewSchema = z.object({
  draftId: uuid,
  summaryText: requiredText(8000),
  reflection: shortText(2000),
  idempotencyKey,
});
