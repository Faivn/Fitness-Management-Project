import type {
  Goal,
  MealPlanEntryDto,
  Profile,
  ScheduleChange,
  SessionExercise,
  SetLog,
  ShoppingListItemDto,
  WorkoutSession,
} from '@mova/shared';
import { hhmm, num } from './helpers.js';

/* eslint-disable @typescript-eslint/no-explicit-any -- rows are untyped DB records */
type Row = Record<string, any>;

export function toProfile(r: Row): Profile {
  return {
    id: r.id,
    timezone: r.timezone,
    unitSystem: r.unit_system,
    weightUnit: r.weight_unit,
    distanceUnit: r.distance_unit,
    volumeUnit: r.volume_unit,
    onboardingCompletedAt: r.onboarding_completed_at,
    equipment: r.equipment ?? [],
    trainingNotes: r.training_notes,
    hydrationEnabled: r.hydration_enabled,
    fastingEnabled: r.fasting_enabled,
    workoutRemindersEnabled: r.workout_reminders_enabled,
    workoutReminderLeadMinutes: r.workout_reminder_lead_minutes,
    updatedAt: r.updated_at,
  };
}

export function toGoal(r: Row): Goal {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    status: r.status,
    priority: r.priority,
    targetValue: num(r.target_value),
    targetUnit: r.target_unit,
    targetDate: r.target_date,
    isMeasurable: r.is_measurable,
    source: r.source,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function toSession(r: Row): WorkoutSession {
  return {
    id: r.id,
    title: r.title,
    activityType: r.activity_type,
    source: r.source,
    status: r.status,
    routineId: r.routine_id,
    routineVersionId: r.routine_version_id,
    originalPlannedDate: r.original_planned_date,
    plannedDate: r.planned_date,
    plannedTime: hhmm(r.planned_time),
    plannedDurationMinutes: r.planned_duration_minutes,
    plannedTimezone: r.planned_timezone,
    actualStartAt: r.actual_start_at,
    actualEndAt: r.actual_end_at,
    actualDate: r.actual_date,
    actualDurationSeconds: r.actual_duration_seconds,
    actualDistanceValue: num(r.actual_distance_value),
    actualDistanceUnit: r.actual_distance_unit,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function toSessionExercise(r: Row): SessionExercise {
  return {
    id: r.id,
    displayName: r.display_name,
    exerciseId: r.exercise_id,
    sortOrder: r.sort_order,
    targetSets: r.target_sets,
    targetRepsMin: r.target_reps_min,
    targetRepsMax: r.target_reps_max,
    targetWeight: num(r.target_weight),
    weightUnit: r.weight_unit,
    restSeconds: r.rest_seconds,
    instructions: r.instructions,
  };
}

export function toSetLog(r: Row): SetLog {
  return {
    id: r.id,
    clientId: r.client_id,
    sessionId: r.session_id,
    sessionExerciseId: r.session_exercise_id,
    exerciseName: r.exercise_name_snapshot,
    setNumber: r.set_number,
    actualReps: r.actual_reps,
    actualWeight: num(r.actual_weight),
    weightUnit: r.weight_unit,
    status: r.status,
    notes: r.notes,
    recordedAt: r.recorded_at,
    correctedAt: r.corrected_at,
  };
}

export function toScheduleChange(r: Row): ScheduleChange {
  return {
    id: r.id,
    sessionId: r.session_id,
    changeType: r.change_type,
    oldDate: r.old_date,
    oldTime: hhmm(r.old_time),
    newDate: r.new_date,
    newTime: hhmm(r.new_time),
    reason: r.reason,
    createdAt: r.created_at,
  };
}

export function toMealEntry(r: Row): MealPlanEntryDto {
  return {
    id: r.id,
    date: r.entry_date,
    slot: r.meal_slot,
    sortOrder: r.sort_order,
    mealName: r.meal_name,
    description: r.description,
    ingredients: r.ingredients ?? [],
    isSmoothie: r.is_smoothie,
    notes: r.notes,
  };
}

export function toShoppingItem(r: Row): ShoppingListItemDto {
  return {
    id: r.id,
    name: r.name,
    quantity: num(r.quantity),
    unit: r.unit,
    category: r.category,
    checked: r.checked,
  };
}
