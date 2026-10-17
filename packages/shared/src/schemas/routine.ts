import { z } from 'zod';
import {
  activityType,
  idempotencyKey,
  localDate,
  localTime,
  requiredText,
  shortText,
  uuid,
  weightUnit,
} from './common.js';

/**
 * A planned exercise inside a routine session (WF-03 "Required proposal
 * content", WF-04). Targets only — actual performance lives in set logs.
 */
export const plannedExerciseSchema = z
  .object({
    name: requiredText(120),
    exerciseId: uuid.optional(),
    targetSets: z.number().int().min(1).max(20),
    repsMin: z.number().int().min(1).max(200).optional(),
    repsMax: z.number().int().min(1).max(200).optional(),
    targetWeight: z.number().positive().max(1000).optional(),
    weightUnit: weightUnit.optional(),
    restSeconds: z.number().int().min(0).max(900).optional(),
    instructions: shortText(500),
  })
  .refine((e) => e.repsMin === undefined || e.repsMax === undefined || e.repsMin <= e.repsMax, {
    message: 'Minimum reps cannot exceed maximum reps.',
    path: ['repsMax'],
  })
  .refine((e) => e.targetWeight === undefined || e.weightUnit !== undefined, {
    message: 'A target weight needs a unit.',
    path: ['weightUnit'],
  });
export type PlannedExercise = z.infer<typeof plannedExerciseSchema>;

/** One recurring training day in the weekly split. */
export const plannedSessionSchema = z
  .object({
    title: requiredText(80),
    focus: shortText(120),
    activityType: activityType.default('strength'),
    /** 0 = Sunday … 6 = Saturday. */
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: localTime.optional(),
    durationMinutes: z.number().int().min(5).max(480).optional(),
    exercises: z.array(plannedExerciseSchema).max(30).default([]),
  })
  .refine((s) => s.activityType !== 'strength' || s.exercises.length > 0, {
    message: 'A strength session needs at least one exercise.',
    path: ['exercises'],
  });
export type PlannedSession = z.infer<typeof plannedSessionSchema>;

/**
 * The routine definition stored in workout_routine_versions.plan_data.
 * Manual (WF-04) and AI (WF-03) routines share this exact shape.
 */
export const routinePlanSchema = z.object({
  title: requiredText(80),
  purpose: shortText(300),
  goalIds: z.array(uuid).max(10).default([]),
  sessions: z.array(plannedSessionSchema).min(1).max(14),
  progressionGuidance: shortText(600),
  assumptions: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
  warnings: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
});
export type RoutinePlan = z.infer<typeof routinePlanSchema>;

/** Applying a routine creates concrete sessions for a bounded period (ADR-006). */
export const scheduleWindowSchema = z.object({
  startDate: localDate,
  weeks: z.number().int().min(1).max(12).default(4),
});
export type ScheduleWindow = z.infer<typeof scheduleWindowSchema>;

export const createManualRoutineSchema = z.object({
  plan: routinePlanSchema,
  /** `draft` saves the template only; `active` also schedules sessions. */
  activate: z.boolean().default(false),
  schedule: scheduleWindowSchema.optional(),
  acceptConflicts: z.boolean().default(false),
  idempotencyKey,
});
export type CreateManualRoutineInput = z.infer<typeof createManualRoutineSchema>;

export const updateRoutineSchema = z.object({
  plan: routinePlanSchema,
  changeReason: shortText(300),
  /** Replace FUTURE scheduled sessions with the new version. Completed history is never touched. */
  rescheduleFuture: z.boolean().default(false),
  /** Activate a draft routine (creates its sessions). */
  activate: z.boolean().default(false),
  schedule: scheduleWindowSchema.optional(),
  acceptConflicts: z.boolean().default(false),
  idempotencyKey,
});
export type UpdateRoutineInput = z.infer<typeof updateRoutineSchema>;

export const generateRoutineProposalSchema = z.object({
  conversationId: uuid.optional(),
  request: requiredText(2000),
  mode: z.enum(['new', 'adjust', 'replace']).default('new'),
  targetRoutineId: uuid.optional(),
  goalIds: z.array(uuid).max(10).default([]),
  /** WF-15: ground a next-period plan in a saved monthly review. */
  monthlyReviewId: uuid.optional(),
});
export type GenerateRoutineProposalInput = z.infer<typeof generateRoutineProposalSchema>;

/** User edits a draft proposal directly; the server bumps its version. */
export const checkProposalConflictsSchema = z.object({ schedule: scheduleWindowSchema });

export const editRoutineProposalSchema = z.object({
  version: z.number().int().min(1),
  plan: routinePlanSchema,
});

/** Conversational refinement; unaffected manual edits must be preserved. */
export const reviseRoutineProposalSchema = z.object({
  version: z.number().int().min(1),
  instruction: requiredText(2000),
});

/** Approval is tied to the exact version the user reviewed (spec §9 rule 7). */
export const approveRoutineProposalSchema = z.object({
  version: z.number().int().min(1),
  schedule: scheduleWindowSchema,
  /** User acknowledged surfaced conflicts. Without this, conflicts block application. */
  acceptConflicts: z.boolean().default(false),
  idempotencyKey,
});
export type ApproveRoutineProposalInput = z.infer<typeof approveRoutineProposalSchema>;
