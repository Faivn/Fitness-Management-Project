/**
 * Table definitions for the browser database: column defaults, uniqueness and
 * the few database rules the engine relies on (what the Postgres schema and
 * triggers enforce on a server). Keep in step with supabase/migrations.
 */
export type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface TableDef {
  /** Primary key columns; generated `id` (uuid) when omitted. */
  pk?: string[];
  defaults?: Record<string, unknown>;
  /** Columns defaulting to the current time. */
  timestamps?: string[];
  /** Column bumped to the current time on every update. */
  touch?: string;
  /** Unique constraints. Rows with a null in any column are never in conflict (Postgres semantics). */
  unique?: string[][];
  /** Partial unique indexes. */
  uniqueWhere?: Array<{ cols: string[]; where: (r: Row) => boolean }>;
}

const ts = (...extra: string[]) => ['created_at', ...extra];

export const TABLES: Record<string, TableDef> = {
  profiles: {
    pk: ['id'],
    defaults: {
      timezone: 'UTC', unit_system: 'metric', weight_unit: 'kg', distance_unit: 'km', volume_unit: 'ml',
      onboarding_completed_at: null, equipment: [], training_notes: null, hydration_enabled: false,
      fasting_enabled: false, workout_reminders_enabled: false, workout_reminder_lead_minutes: 30,
    },
    timestamps: ts('updated_at'), touch: 'updated_at',
  },
  conversations: { defaults: { context_type: 'general', linked_entity_id: null }, timestamps: ts('updated_at'), touch: 'updated_at' },
  conversation_messages: { defaults: { metadata: null, client_message_id: null }, timestamps: ts(), unique: [['conversation_id', 'client_message_id']] },
  goal_proposals: { defaults: { status: 'draft', version: 1, conversation_id: null, approved_at: null }, timestamps: ts('updated_at'), touch: 'updated_at' },
  fitness_goals: {
    defaults: {
      description: null, status: 'active', priority: 'medium', target_value: null, target_unit: null, target_date: null,
      is_measurable: false, source: 'manual', goal_proposal_id: null, idempotency_key: null,
    },
    timestamps: ts('updated_at'), touch: 'updated_at', unique: [['user_id', 'idempotency_key']],
  },
  workout_routines: { defaults: { status: 'draft', current_version: 1 }, timestamps: ts('updated_at'), touch: 'updated_at' },
  workout_routine_versions: { defaults: { goal_snapshot: [], change_reason: null }, timestamps: ts(), unique: [['routine_id', 'version_number']] },
  routine_goals: { pk: ['routine_id', 'goal_id'] },
  routine_proposals: {
    defaults: {
      status: 'draft', version: 1, mode: 'new', target_routine_id: null, request_text: null, plan: null,
      clarifying_questions: [], applied_routine_id: null, approved_version: null, approved_at: null, applied_at: null, conversation_id: null,
    },
    timestamps: ts('updated_at'), touch: 'updated_at',
  },
  workout_sessions: {
    defaults: {
      routine_id: null, routine_version_id: null, session_index: null, activity_type: 'strength', status: 'scheduled',
      original_planned_date: null, planned_date: null, planned_time: null, planned_duration_minutes: null, planned_timezone: null,
      actual_start_at: null, actual_end_at: null, actual_date: null, actual_duration_seconds: null, actual_distance_value: null,
      actual_distance_unit: null, notes: null, idempotency_key: null,
    },
    timestamps: ts('updated_at'), touch: 'updated_at',
    unique: [['user_id', 'idempotency_key'], ['routine_version_id', 'session_index', 'original_planned_date']],
  },
  session_exercises: {
    defaults: { exercise_id: null, target_reps_min: null, target_reps_max: null, target_weight: null, weight_unit: null, rest_seconds: null, instructions: null },
    timestamps: ts(),
  },
  exercise_logs: {
    defaults: {
      session_exercise_id: null, exercise_id: null, actual_reps: null, actual_weight: null, weight_unit: null,
      status: 'completed', notes: null, corrected_at: null,
    },
    timestamps: ['recorded_at'], unique: [['user_id', 'client_id']],
  },
  exercise_log_corrections: { timestamps: ts() },
  schedule_changes: {
    defaults: { old_date: null, old_time: null, new_date: null, new_time: null, previous_status: null, reason: null, actor: 'user', idempotency_key: null },
    timestamps: ts(), unique: [['user_id', 'idempotency_key']],
  },
  meal_plan_proposals: {
    defaults: { status: 'draft', version: 1, request_text: null, plan: null, clarifying_questions: [], applied_meal_plan_id: null, approved_at: null, conversation_id: null },
    timestamps: ts('updated_at'), touch: 'updated_at',
  },
  meal_plans: {
    defaults: { proposal_id: null, goal_context: null, status: 'active', version: 1, slots: [], approved_at: null },
    timestamps: ts('updated_at'), touch: 'updated_at',
  },
  meal_plan_entries: { defaults: { sort_order: 0, description: null, ingredients: [], is_smoothie: false, notes: null } },
  shopping_list_items: {
    defaults: { quantity: null, unit: null, category: null, checked: false, source_meal_entry_ids: [], idempotency_key: null },
    timestamps: ts(), unique: [['user_id', 'idempotency_key']],
  },
  monthly_summaries: {
    defaults: { status: 'draft', observations: [], reflection: null, source_record_ids: [], version: 1 },
    timestamps: ts('updated_at'), touch: 'updated_at',
    uniqueWhere: [{ cols: ['user_id', 'period_start', 'period_end'], where: (r) => r.status === 'saved' }],
  },
  hydration_targets: { pk: ['user_id'], timestamps: ['updated_at'], touch: 'updated_at' },
  hydration_entries: { defaults: { idempotency_key: null }, timestamps: ['recorded_at'], unique: [['user_id', 'idempotency_key']] },
  fasting_schedules: { pk: ['user_id'], defaults: { label: null }, timestamps: ['updated_at'], touch: 'updated_at' },
  fasting_sessions: {
    defaults: { ended_at: null, idempotency_key: null },
    timestamps: ts(), unique: [['user_id', 'idempotency_key']],
    uniqueWhere: [{ cols: ['user_id'], where: (r) => r.ended_at === null || r.ended_at === undefined }],
  },
  reminders: {
    defaults: { linked_entity_id: null, channel: 'local', enabled: true, status: 'enabled' },
    timestamps: ts('updated_at'), touch: 'updated_at',
    unique: [['user_id', 'linked_entity_type', 'linked_entity_id', 'channel']],
  },
  idempotency_keys: { pk: ['user_id', 'key'], timestamps: ts() },
};
