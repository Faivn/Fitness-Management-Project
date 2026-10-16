-- Row Level Security (spec §8.0.2, §9 rule 1).
-- Every private table: RLS on, access only to rows where user_id = auth.uid().
-- History tables get SELECT + INSERT only — no UPDATE or DELETE policies, so
-- users (and the API acting as the user) can never rewrite history.

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.goal_proposals enable row level security;
alter table public.fitness_goals enable row level security;
alter table public.workout_routines enable row level security;
alter table public.workout_routine_versions enable row level security;
alter table public.routine_goals enable row level security;
alter table public.routine_proposals enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.session_exercises enable row level security;
alter table public.exercise_logs enable row level security;
alter table public.exercise_log_corrections enable row level security;
alter table public.schedule_changes enable row level security;
alter table public.meal_plan_proposals enable row level security;
alter table public.meal_plans enable row level security;
alter table public.meal_plan_entries enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.monthly_summaries enable row level security;
alter table public.hydration_targets enable row level security;
alter table public.hydration_entries enable row level security;
alter table public.fasting_schedules enable row level security;
alter table public.fasting_sessions enable row level security;
alter table public.reminders enable row level security;
alter table public.idempotency_keys enable row level security;

-- Profiles are keyed by id rather than user_id. Rows are created by trigger.
create policy profiles_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Full CRUD-minus-delete for mutable user-owned records.
do $$
declare
  t text;
begin
  foreach t in array array[
    'conversations', 'goal_proposals', 'fitness_goals', 'workout_routines', 'routine_proposals',
    'workout_sessions', 'meal_plan_proposals', 'meal_plans', 'monthly_summaries',
    'hydration_targets', 'fasting_schedules', 'fasting_sessions', 'reminders'
  ]
  loop
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update', t);
  end loop;
end;
$$;

-- Insert-only history / snapshot tables.
do $$
declare
  t text;
begin
  foreach t in array array[
    'conversation_messages', 'workout_routine_versions', 'routine_goals', 'session_exercises',
    'exercise_log_corrections', 'schedule_changes', 'meal_plan_entries', 'idempotency_keys'
  ]
  loop
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert', t);
  end loop;
end;
$$;

-- Set logs: insert, read and explicit correction (corrections are audited).
create policy exercise_logs_select on public.exercise_logs for select to authenticated using (user_id = (select auth.uid()));
create policy exercise_logs_insert on public.exercise_logs for insert to authenticated with check (user_id = (select auth.uid()));
create policy exercise_logs_update on public.exercise_logs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- The few deletes the product allows, each an explicit user action.
create policy shopping_list_items_select on public.shopping_list_items for select to authenticated using (user_id = (select auth.uid()));
create policy shopping_list_items_insert on public.shopping_list_items for insert to authenticated with check (user_id = (select auth.uid()));
create policy shopping_list_items_update on public.shopping_list_items for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy shopping_list_items_delete on public.shopping_list_items for delete to authenticated using (user_id = (select auth.uid()));

create policy hydration_entries_select on public.hydration_entries for select to authenticated using (user_id = (select auth.uid()));
create policy hydration_entries_insert on public.hydration_entries for insert to authenticated with check (user_id = (select auth.uid()));
create policy hydration_entries_delete on public.hydration_entries for delete to authenticated using (user_id = (select auth.uid()));

create policy reminders_delete on public.reminders for delete to authenticated using (user_id = (select auth.uid()));

-- Cross-row ownership: child rows must belong to a parent the user owns.
create or replace function public.owns_session(p_session_id uuid)
returns boolean
language sql
stable
security invoker
as $$
  select exists (select 1 from public.workout_sessions s where s.id = p_session_id and s.user_id = (select auth.uid()));
$$;

create policy exercise_logs_parent on public.exercise_logs as restrictive for insert to authenticated
  with check (public.owns_session(session_id));
create policy session_exercises_parent on public.session_exercises as restrictive for insert to authenticated
  with check (public.owns_session(session_id));
create policy schedule_changes_parent on public.schedule_changes as restrictive for insert to authenticated
  with check (public.owns_session(session_id));

-- The anonymous role has no business with private data.
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
