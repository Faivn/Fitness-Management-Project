import { z } from 'zod';
import { SET_LOG_STATUSES } from '../enums.js';
import {
  activityType,
  distanceUnit,
  idempotencyKey,
  isoDateTime,
  localDate,
  localTime,
  requiredText,
  shortText,
  uuid,
  weightUnit,
} from './common.js';

/** WF-07: move a session. A reason is optional. */
export const rescheduleSessionSchema = z.object({
  newDate: localDate,
  newTime: localTime.optional(),
  reason: shortText(300),
  acceptConflicts: z.boolean().default(false),
  idempotencyKey,
});
export type RescheduleSessionInput = z.infer<typeof rescheduleSessionSchema>;

export const markMissedSchema = z.object({
  reason: shortText(300),
  idempotencyKey,
});

export const cancelSessionSchema = z.object({
  reason: shortText(300),
  idempotencyKey,
});

export const startSessionSchema = z.object({
  startedAt: isoDateTime.optional(),
});

/**
 * WF-06 set log. Unknown values stay unknown (spec §9 rule 11): reps and
 * weight are optional, never defaulted to zero.
 */
export const setLogInputSchema = z
  .object({
    clientId: z.string().min(8).max(100),
    sessionExerciseId: uuid.optional(),
    exerciseName: requiredText(120),
    setNumber: z.number().int().min(1).max(50),
    actualReps: z.number().int().min(0).max(500).optional(),
    actualWeight: z.number().min(0).max(1000).optional(),
    weightUnit: weightUnit.optional(),
    status: z.enum(SET_LOG_STATUSES).default('completed'),
    notes: shortText(300),
  })
  .refine((s) => s.actualWeight === undefined || s.weightUnit !== undefined, {
    message: 'A weight needs a unit.',
    path: ['weightUnit'],
  });
export type SetLogInput = z.infer<typeof setLogInputSchema>;

/** Upsert a batch of set logs; each is keyed by clientId so retries never duplicate. */
export const upsertSetLogsSchema = z.object({
  logs: z.array(setLogInputSchema).min(1).max(200),
});

/** Explicit, auditable correction of an existing set log (WF-06). */
export const correctSetLogSchema = z.object({
  actualReps: z.number().int().min(0).max(500).nullable().optional(),
  actualWeight: z.number().min(0).max(1000).nullable().optional(),
  weightUnit: weightUnit.nullable().optional(),
  status: z.enum(SET_LOG_STATUSES).optional(),
  correctionReason: shortText(300),
});

export const finishSessionSchema = z
  .object({
    outcome: z.enum(['completed', 'incomplete']),
    endedAt: isoDateTime.optional(),
    notes: shortText(1000),
    /** WF-12 runs/other activities: only what the user knows. */
    durationSeconds: z.number().int().min(1).max(86_400).optional(),
    distanceValue: z.number().positive().max(1000).optional(),
    distanceUnit: distanceUnit.optional(),
    idempotencyKey,
  })
  .refine((a) => a.distanceValue === undefined || a.distanceUnit !== undefined, {
    message: 'A distance needs a unit.',
    path: ['distanceUnit'],
  });
export type FinishSessionInput = z.infer<typeof finishSessionSchema>;

/**
 * WF-08 / WF-12: record an unscheduled or past activity. Distance, duration
 * and exercise details are optional; the activity date is distinct from the
 * entry date.
 */
export const logActivitySchema = z
  .object({
    activityType,
    title: shortText(80),
    activityDate: localDate,
    startTime: localTime.optional(),
    durationSeconds: z.number().int().min(1).max(86_400).optional(),
    distanceValue: z.number().positive().max(1000).optional(),
    distanceUnit: distanceUnit.optional(),
    notes: shortText(1000),
    /** Link to an existing scheduled session instead of creating a duplicate. */
    plannedSessionId: uuid.optional(),
    sets: z.array(setLogInputSchema).max(200).default([]),
    /** User confirmed this is separate from a matching planned session (WF-08 duplicates). */
    confirmSeparate: z.boolean().default(false),
    idempotencyKey,
  })
  .refine((a) => a.distanceValue === undefined || a.distanceUnit !== undefined, {
    message: 'A distance needs a unit.',
    path: ['distanceUnit'],
  });
export type LogActivityInput = z.infer<typeof logActivitySchema>;

/** WF-12: schedule a run or other non-strength activity directly. */
export const scheduleActivitySchema = z.object({
  activityType,
  title: requiredText(80),
  plannedDate: localDate,
  plannedTime: localTime.optional(),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  notes: shortText(500),
  acceptConflicts: z.boolean().default(false),
  idempotencyKey,
});
export type ScheduleActivityInput = z.infer<typeof scheduleActivitySchema>;

export const listSessionsQuerySchema = z.object({
  from: localDate,
  to: localDate,
});
