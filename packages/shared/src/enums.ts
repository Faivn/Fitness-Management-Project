/**
 * Domain enumerations. Values mirror the Postgres check constraints in
 * supabase/migrations so the client, API and database agree on every state.
 */

export const WEIGHT_UNITS = ['kg', 'lb'] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

export const DISTANCE_UNITS = ['km', 'mi'] as const;
export type DistanceUnit = (typeof DISTANCE_UNITS)[number];

export const VOLUME_UNITS = ['ml', 'l', 'fl_oz'] as const;
export type VolumeUnit = (typeof VOLUME_UNITS)[number];

export const UNIT_SYSTEMS = ['metric', 'imperial'] as const;
export type UnitSystem = (typeof UNIT_SYSTEMS)[number];

/** WF-12: running is first-class; other activities need not have sets/reps. */
export const ACTIVITY_TYPES = [
  'strength',
  'running',
  'walking',
  'cycling',
  'swimming',
  'mobility',
  'other',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/**
 * WF-06 / WF-07 session lifecycle. "Rescheduled" is not a status: a moved
 * session stays `scheduled` on its new date and its move is recorded in
 * schedule_changes, so the original plan is never overwritten.
 */
export const SESSION_STATUSES = [
  'scheduled',
  'in_progress',
  'completed',
  'incomplete',
  'missed',
  'cancelled',
] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

/** Where a session or activity came from. */
export const RECORD_SOURCES = ['manual', 'ai', 'spontaneous', 'historical_entry'] as const;
export type RecordSource = (typeof RECORD_SOURCES)[number];

export const SET_LOG_STATUSES = ['completed', 'skipped'] as const;
export type SetLogStatus = (typeof SET_LOG_STATUSES)[number];

export const SCHEDULE_CHANGE_TYPES = [
  'rescheduled',
  'marked_missed',
  'cancelled',
  'restored',
] as const;
export type ScheduleChangeType = (typeof SCHEDULE_CHANGE_TYPES)[number];

export const GOAL_STATUSES = ['proposed', 'active', 'achieved', 'archived', 'rejected'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const GOAL_PRIORITIES = ['high', 'medium', 'low'] as const;
export type GoalPriority = (typeof GOAL_PRIORITIES)[number];

/** WF-02 / WF-03 / WF-10 proposal lifecycle (backend-owned). */
export const PROPOSAL_STATUSES = [
  'draft',
  'approved',
  'applied',
  'rejected',
  'cancelled',
  'superseded',
  'application_failed',
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const ROUTINE_STATUSES = ['draft', 'active', 'archived'] as const;
export type RoutineStatus = (typeof ROUTINE_STATUSES)[number];

export const MEAL_PLAN_STATUSES = ['draft', 'active', 'archived', 'rejected'] as const;
export type MealPlanStatus = (typeof MEAL_PLAN_STATUSES)[number];

export const CONVERSATION_CONTEXTS = ['general', 'workout', 'meal_plan', 'monthly_review'] as const;
export type ConversationContext = (typeof CONVERSATION_CONTEXTS)[number];

export const REMINDER_CHANNELS = ['push', 'local'] as const;
export type ReminderChannel = (typeof REMINDER_CHANNELS)[number];

export const REMINDER_STATUSES = ['disabled', 'enabled', 'scheduled', 'delivered', 'delivery_failed'] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

export const OPTIONAL_MODULES = ['hydration', 'fasting'] as const;
export type OptionalModule = (typeof OPTIONAL_MODULES)[number];
