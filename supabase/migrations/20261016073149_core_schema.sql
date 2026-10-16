-- Mova core schema (PRODUCT_SPECIFICATION.md §6).
--
-- Principles enforced here:
--   * Every private row has user_id = auth.users.id and RLS scoped to auth.uid().
--   * Planned and actual activity are separate columns; the original planned
--     date of a session is immutable (trigger below).
--   * History tables (schedule_changes, routine versions, log corrections) are
--     insert-only for users: no UPDATE/DELETE policies exist on them.
--   * No calorie / macronutrient / meal-consumption columns (spec §3.2).

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profile & preferences (WF-01, WF-16)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  timezone text not null default 'UTC',
  unit_system text not null default 'metric' check (unit_system in ('metric', 'imperial')),
  weight_unit text not null default 'kg' check (weight_unit in ('kg', 'lb')),
  distance_unit text not null default 'km' check (distance_unit in ('km', 'mi')),
  volume_unit text not null default 'ml' check (volume_unit in ('ml', 'l', 'fl_oz')),
  onboarding_completed_at timestamptz,
  equipment text[] not null default '{}',
  training_notes text check (char_length(training_notes) <= 1000),
  hydration_enabled boolean not null default false,
  fasting_enabled boolean not null default false,
  workout_reminders_enabled boolean not null default false,
  workout_reminder_lead_minutes integer not null default 30 check (workout_reminder_lead_minutes between 0 and 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile row for every new auth user (sign-in stays separate from
-- fitness profiling: only defaults are written).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Goals & AI conversation (WF-02)
-- ---------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  context_type text not null default 'general'
    check (context_type in ('general', 'workout', 'meal_plan', 'monthly_review')),
  linked_entity_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_user_idx on public.conversations (user_id, updated_at desc);
create trigger conversations_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 8000),
  metadata jsonb,
  client_message_id text,
  created_at timestamptz not null default now(),
  unique (conversation_id, client_message_id)
);
create index conversation_messages_conv_idx on public.conversation_messages (conversation_id, created_at);

create table public.goal_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'applied', 'rejected', 'cancelled', 'superseded', 'application_failed')),
  version integer not null default 1 check (version >= 1),
  goals jsonb not null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger goal_proposals_updated_at before update on public.goal_proposals
  for each row execute function public.set_updated_at();

create table public.fitness_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text,
  status text not null default 'active'
    check (status in ('proposed', 'active', 'achieved', 'archived', 'rejected')),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  target_value numeric,
  target_unit text,
  target_date date,
  is_measurable boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'ai')),
  goal_proposal_id uuid references public.goal_proposals (id) on delete set null,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index fitness_goals_user_idx on public.fitness_goals (user_id, status);
create trigger fitness_goals_updated_at before update on public.fitness_goals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Routines (WF-03, WF-04)
-- ---------------------------------------------------------------------------

create table public.workout_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  current_version integer not null default 1,
  source text not null check (source in ('manual', 'ai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workout_routines_user_idx on public.workout_routines (user_id, status);
create trigger workout_routines_updated_at before update on public.workout_routines
  for each row execute function public.set_updated_at();

-- Immutable snapshot of a routine definition at a point in time.
create table public.workout_routine_versions (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.workout_routines (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  goal_snapshot jsonb not null default '[]',
  plan_data jsonb not null,
  change_reason text,
  created_at timestamptz not null default now(),
  unique (routine_id, version_number)
);

create table public.routine_goals (
  routine_id uuid not null references public.workout_routines (id) on delete cascade,
  goal_id uuid not null references public.fitness_goals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (routine_id, goal_id)
);

create table public.routine_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'applied', 'rejected', 'cancelled', 'superseded', 'application_failed')),
  version integer not null default 1 check (version >= 1),
  mode text not null default 'new' check (mode in ('new', 'adjust', 'replace')),
  target_routine_id uuid references public.workout_routines (id) on delete set null,
  request_text text,
  plan jsonb,
  clarifying_questions jsonb not null default '[]',
  applied_routine_id uuid references public.workout_routines (id) on delete set null,
  approved_version integer,
  approved_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index routine_proposals_user_idx on public.routine_proposals (user_id, created_at desc);
create trigger routine_proposals_updated_at before update on public.routine_proposals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Sessions, exercises, logs, schedule history (WF-05 … WF-09, WF-12)
-- ---------------------------------------------------------------------------

-- One row per planned OR actual activity. Unplanned (spontaneous / historical)
-- activity has NULL planned dates — no fictional original schedule (WF-08).
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  routine_id uuid references public.workout_routines (id) on delete set null,
  routine_version_id uuid references public.workout_routine_versions (id) on delete set null,
  session_index integer,
  title text not null check (char_length(title) between 1 and 80),
  activity_type text not null default 'strength'
    check (activity_type in ('strength', 'running', 'walking', 'cycling', 'swimming', 'mobility', 'other')),
  source text not null check (source in ('manual', 'ai', 'spontaneous', 'historical_entry')),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'completed', 'incomplete', 'missed', 'cancelled')),
  original_planned_date date,
  planned_date date,
  planned_time time,
  planned_duration_minutes integer check (planned_duration_minutes between 1 and 1440),
  planned_timezone text,
  actual_start_at timestamptz,
  actual_end_at timestamptz,
  actual_date date,
  actual_duration_seconds integer check (actual_duration_seconds > 0),
  actual_distance_value numeric check (actual_distance_value > 0),
  actual_distance_unit text check (actual_distance_unit in ('km', 'mi')),
  notes text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Planned and unplanned rows are structurally distinct.
  constraint planned_dates_consistent check ((original_planned_date is null) = (planned_date is null)),
  constraint unplanned_is_actual check (
    planned_date is not null or source in ('spontaneous', 'historical_entry')
  ),
  -- Completion needs evidence: the local date it actually happened (time may be unknown).
  constraint completed_has_evidence check (status <> 'completed' or actual_date is not null),
  constraint distance_has_unit check (actual_distance_value is null or actual_distance_unit is not null),
  unique (user_id, idempotency_key),
  -- Idempotent routine application: one occurrence per version/session/day.
  unique (routine_version_id, session_index, original_planned_date)
);
create index workout_sessions_planned_idx on public.workout_sessions (user_id, planned_date);
create index workout_sessions_actual_idx on public.workout_sessions (user_id, actual_date);
create index workout_sessions_original_idx on public.workout_sessions (user_id, original_planned_date);
create index workout_sessions_routine_idx on public.workout_sessions (routine_id, status);
create trigger workout_sessions_updated_at before update on public.workout_sessions
  for each row execute function public.set_updated_at();

-- The original planned date is history: it can never change once set.
create or replace function public.protect_original_planned_date()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.original_planned_date is distinct from new.original_planned_date then
    raise exception 'original_planned_date is immutable' using errcode = 'check_violation';
  end if;
  if old.status = 'completed' and new.status <> 'completed' then
    raise exception 'a completed session cannot change status' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger workout_sessions_protect_history before update on public.workout_sessions
  for each row execute function public.protect_original_planned_date();

-- Targets copied from the routine version when the session was created.
-- Later routine edits never rewrite these for existing sessions.
create table public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid,
  display_name text not null,
  sort_order integer not null,
  target_sets integer not null check (target_sets between 1 and 20),
  target_reps_min integer,
  target_reps_max integer,
  target_weight numeric,
  weight_unit text check (weight_unit in ('kg', 'lb')),
  rest_seconds integer,
  instructions text,
  created_at timestamptz not null default now()
);
create index session_exercises_session_idx on public.session_exercises (session_id, sort_order);

-- Actual performance. Unknown reps/weight remain NULL.
create table public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  session_exercise_id uuid references public.session_exercises (id) on delete set null,
  exercise_id uuid,
  exercise_name_snapshot text not null,
  set_number integer not null check (set_number between 1 and 50),
  actual_reps integer check (actual_reps between 0 and 500),
  actual_weight numeric check (actual_weight >= 0),
  weight_unit text check (weight_unit in ('kg', 'lb')),
  status text not null default 'completed' check (status in ('completed', 'skipped')),
  notes text,
  client_id text not null,
  recorded_at timestamptz not null default now(),
  corrected_at timestamptz,
  unique (user_id, client_id),
  constraint weight_has_unit check (actual_weight is null or weight_unit is not null)
);
create index exercise_logs_session_idx on public.exercise_logs (session_id, set_number);
create index exercise_logs_name_idx on public.exercise_logs (user_id, lower(exercise_name_snapshot));

-- Auditable corrections to set logs (WF-06: explicit, auditable edit).
create table public.exercise_log_corrections (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.exercise_logs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  previous_values jsonb not null,
  new_values jsonb not null,
  reason text,
  created_at timestamptz not null default now()
);

create table public.schedule_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  change_type text not null check (change_type in ('rescheduled', 'marked_missed', 'cancelled', 'restored')),
  old_date date,
  old_time time,
  new_date date,
  new_time time,
  previous_status text,
  reason text check (char_length(reason) <= 300),
  actor text not null default 'user' check (actor in ('user', 'system')),
  idempotency_key text,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index schedule_changes_session_idx on public.schedule_changes (session_id, created_at);
create index schedule_changes_user_idx on public.schedule_changes (user_id, created_at);

-- ---------------------------------------------------------------------------
-- Meal planning (WF-10) — planning only, no consumption or calorie data
-- ---------------------------------------------------------------------------

create table public.meal_plan_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'applied', 'rejected', 'cancelled', 'superseded', 'application_failed')),
  version integer not null default 1,
  request_text text,
  plan jsonb,
  clarifying_questions jsonb not null default '[]',
  applied_meal_plan_id uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger meal_plan_proposals_updated_at before update on public.meal_plan_proposals
  for each row execute function public.set_updated_at();

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  proposal_id uuid references public.meal_plan_proposals (id) on delete set null,
  title text not null,
  goal_context text,
  start_date date not null,
  end_date date not null,
  status text not null default 'active' check (status in ('draft', 'active', 'archived', 'rejected')),
  version integer not null default 1,
  source text not null check (source in ('manual', 'ai')),
  slots text[] not null default '{}',
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date <= end_date)
);
create index meal_plans_user_idx on public.meal_plans (user_id, status, start_date);
create trigger meal_plans_updated_at before update on public.meal_plans
  for each row execute function public.set_updated_at();

alter table public.meal_plan_proposals
  add constraint meal_plan_proposals_applied_fk
  foreign key (applied_meal_plan_id) references public.meal_plans (id) on delete set null;

create table public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null,
  meal_slot text not null,
  sort_order integer not null default 0,
  meal_name text not null,
  description text,
  ingredients jsonb not null default '[]',
  is_smoothie boolean not null default false,
  notes text
);
create index meal_plan_entries_plan_idx on public.meal_plan_entries (meal_plan_id, entry_date, sort_order);
create index meal_plan_entries_user_date_idx on public.meal_plan_entries (user_id, entry_date);

-- Checking an item off is shopping state, NOT meal-consumption logging.
create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  quantity numeric check (quantity > 0),
  unit text,
  category text,
  checked boolean not null default false,
  source_meal_entry_ids uuid[] not null default '{}',
  idempotency_key text,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index shopping_list_items_plan_idx on public.shopping_list_items (meal_plan_id);

-- ---------------------------------------------------------------------------
-- Monthly review (WF-15)
-- ---------------------------------------------------------------------------

create table public.monthly_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'saved')),
  period_start date not null,
  period_end date not null,
  summary_text text not null,
  observations jsonb not null default '[]',
  reflection text,
  stats jsonb not null,
  source_record_ids uuid[] not null default '{}',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_start <= period_end)
);
-- At most one saved summary per period; regenerating creates a new version, not a duplicate.
create unique index monthly_summaries_saved_period_idx
  on public.monthly_summaries (user_id, period_start, period_end) where status = 'saved';
create trigger monthly_summaries_updated_at before update on public.monthly_summaries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Optional modules (WF-13, WF-14) and reminders (WF-11)
-- ---------------------------------------------------------------------------

create table public.hydration_targets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  daily_target numeric not null check (daily_target > 0),
  unit text not null check (unit in ('ml', 'l', 'fl_oz')),
  updated_at timestamptz not null default now()
);
create trigger hydration_targets_updated_at before update on public.hydration_targets
  for each row execute function public.set_updated_at();

create table public.hydration_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  quantity numeric not null check (quantity > 0),
  unit text not null check (unit in ('ml', 'l', 'fl_oz')),
  recorded_at timestamptz not null default now(),
  local_date date not null,
  idempotency_key text,
  unique (user_id, idempotency_key)
);
create index hydration_entries_user_date_idx on public.hydration_entries (user_id, local_date);

create table public.fasting_schedules (
  user_id uuid primary key references auth.users (id) on delete cascade,
  label text,
  fast_start_time time not null,
  fast_hours numeric not null check (fast_hours between 1 and 72),
  timezone text not null,
  updated_at timestamptz not null default now()
);
create trigger fasting_schedules_updated_at before update on public.fasting_schedules
  for each row execute function public.set_updated_at();

-- Recorded fasts are separate from the configured window: a planned window
-- is never proof that a fast happened.
create table public.fasting_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  planned_hours numeric not null check (planned_hours between 1 and 72),
  idempotency_key text,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  check (ended_at is null or ended_at > started_at)
);
-- Only one active fast at a time.
create unique index fasting_sessions_one_active_idx on public.fasting_sessions (user_id) where ended_at is null;

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  linked_entity_type text not null check (linked_entity_type in ('workout_session', 'hydration', 'fasting')),
  linked_entity_id uuid,
  scheduled_at timestamptz not null,
  channel text not null default 'local' check (channel in ('push', 'local')),
  enabled boolean not null default true,
  status text not null default 'enabled'
    check (status in ('disabled', 'enabled', 'scheduled', 'delivered', 'delivery_failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- No duplicate reminders for the same event and configuration.
create unique index reminders_unique_idx
  on public.reminders (user_id, linked_entity_type, coalesce(linked_entity_id, '00000000-0000-0000-0000-000000000000'::uuid), channel);
create trigger reminders_updated_at before update on public.reminders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Idempotency store for retriable multi-row operations (spec §9 rule 6)
-- ---------------------------------------------------------------------------

create table public.idempotency_keys (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  operation text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);
