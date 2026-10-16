-- Transactional domain operations (spec §8.0.3, §8.5).
--
-- All functions are SECURITY INVOKER: they run as the calling user, so RLS
-- still applies to every read and write. Each call is a single transaction,
-- so a routine is never left active with missing sessions, and an
-- idempotency key makes retries return the original result instead of
-- creating duplicates.

-- ---------------------------------------------------------------------------
-- Idempotency helpers
-- ---------------------------------------------------------------------------

create or replace function public._idem_get(p_key text)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select response from public.idempotency_keys
  where user_id = (select auth.uid()) and key = p_key;
$$;

create or replace function public._idem_put(p_key text, p_operation text, p_response jsonb)
returns void
language sql
security invoker
set search_path = public, pg_temp
as $$
  insert into public.idempotency_keys (user_id, key, operation, response)
  values ((select auth.uid()), p_key, p_operation, p_response);
$$;

create or replace function public._require_user()
returns uuid
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v uuid := (select auth.uid());
begin
  if v is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Session creation from a routine version
-- ---------------------------------------------------------------------------

-- p_occurrences: [{ sessionIndex, title, activityType, plannedDate, plannedTime, durationMinutes }]
-- computed by the API from the shared generateOccurrences() rule.
create or replace function public._create_sessions_for_version(
  p_routine_id uuid,
  p_version_id uuid,
  p_plan jsonb,
  p_occurrences jsonb,
  p_timezone text,
  p_source text
)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public._require_user();
  occ jsonb;
  v_session_id uuid;
  ex jsonb;
  ex_ord integer;
  created integer := 0;
begin
  for occ in select * from jsonb_array_elements(coalesce(p_occurrences, '[]'::jsonb))
  loop
    insert into public.workout_sessions (
      user_id, routine_id, routine_version_id, session_index, title, activity_type, source, status,
      original_planned_date, planned_date, planned_time, planned_duration_minutes, planned_timezone
    ) values (
      v_user, p_routine_id, p_version_id, (occ->>'sessionIndex')::int, occ->>'title',
      coalesce(occ->>'activityType', 'strength'), p_source, 'scheduled',
      (occ->>'plannedDate')::date, (occ->>'plannedDate')::date, nullif(occ->>'plannedTime', '')::time,
      nullif(occ->>'durationMinutes', '')::int, p_timezone
    )
    on conflict (routine_version_id, session_index, original_planned_date) do nothing
    returning id into v_session_id;

    if v_session_id is null then
      continue;
    end if;
    created := created + 1;

    ex_ord := 0;
    for ex in
      select * from jsonb_array_elements(coalesce(p_plan->'sessions'->((occ->>'sessionIndex')::int)->'exercises', '[]'::jsonb))
    loop
      insert into public.session_exercises (
        session_id, user_id, exercise_id, display_name, sort_order, target_sets,
        target_reps_min, target_reps_max, target_weight, weight_unit, rest_seconds, instructions
      ) values (
        v_session_id, v_user, nullif(ex->>'exerciseId', '')::uuid, ex->>'name', ex_ord,
        (ex->>'targetSets')::int, nullif(ex->>'repsMin', '')::int, nullif(ex->>'repsMax', '')::int,
        nullif(ex->>'targetWeight', '')::numeric, nullif(ex->>'weightUnit', ''),
        nullif(ex->>'restSeconds', '')::int, nullif(ex->>'instructions', '')
      );
      ex_ord := ex_ord + 1;
    end loop;
  end loop;
  return created;
end;
$$;

-- Cancel FUTURE scheduled sessions of a routine (used when a routine is
-- replaced or re-versioned). Completed / past history is never touched, and
-- every cancellation is written to schedule_changes.
create or replace function public._retire_future_sessions(p_routine_id uuid, p_from_date date, p_reason text)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public._require_user();
  s record;
  n integer := 0;
begin
  for s in
    select id, planned_date, planned_time, status from public.workout_sessions
    where routine_id = p_routine_id and user_id = v_user
      and status = 'scheduled' and planned_date >= p_from_date
    for update
  loop
    insert into public.schedule_changes (user_id, session_id, change_type, old_date, old_time, previous_status, reason, actor)
    values (v_user, s.id, 'cancelled', s.planned_date, s.planned_time, s.status, p_reason, 'system');
    update public.workout_sessions set status = 'cancelled' where id = s.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

create or replace function public._link_goals(p_routine_id uuid, p_plan jsonb)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public._require_user();
begin
  insert into public.routine_goals (routine_id, goal_id, user_id)
  select p_routine_id, g.id, v_user
  from public.fitness_goals g
  where g.user_id = v_user
    and g.id in (select (jsonb_array_elements_text(coalesce(p_plan->'goalIds', '[]'::jsonb)))::uuid)
  on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- WF-03: apply an approved AI routine proposal
-- ---------------------------------------------------------------------------

create or replace function public.apply_routine_proposal(
  p_proposal_id uuid,
  p_version integer,
  p_occurrences jsonb,
  p_timezone text,
  p_today date,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public._require_user();
  v_existing jsonb := public._idem_get(p_idempotency_key);
  p public.routine_proposals%rowtype;
  v_routine_id uuid;
  v_version_number integer;
  v_version_id uuid;
  v_created integer;
  v_retired integer := 0;
  v_goals jsonb;
  v_result jsonb;
begin
  if v_existing is not null then
    return v_existing;
  end if;

  select * into p from public.routine_proposals where id = p_proposal_id and user_id = v_user for update;
  if not found then
    raise exception 'proposal not found' using errcode = 'P0002';
  end if;
  if p.status = 'applied' then
    return jsonb_build_object('routineId', p.applied_routine_id, 'sessionsCreated', 0, 'alreadyApplied', true);
  end if;
  if p.status <> 'draft' then
    raise exception 'proposal is %', p.status using errcode = 'P0001';
  end if;
  if p.version <> p_version then
    raise exception 'proposal changed since it was reviewed (now version %)', p.version using errcode = '40001';
  end if;
  if p.plan is null then
    raise exception 'proposal has no plan to apply' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(to_jsonb(g) - 'user_id'), '[]'::jsonb) into v_goals
  from public.fitness_goals g
  where g.user_id = v_user
    and g.id in (select (jsonb_array_elements_text(coalesce(p.plan->'goalIds', '[]'::jsonb)))::uuid);

  if p.mode in ('adjust', 'replace') and p.target_routine_id is not null then
    -- New version of the existing routine; old versions and history stay.
    select id into v_routine_id from public.workout_routines
    where id = p.target_routine_id and user_id = v_user for update;
    if not found then
      raise exception 'target routine not found' using errcode = 'P0002';
    end if;
    select coalesce(max(version_number), 0) + 1 into v_version_number
    from public.workout_routine_versions where routine_id = v_routine_id;
    v_retired := public._retire_future_sessions(v_routine_id, p_today, format('Replaced by routine version %s', v_version_number));
    update public.workout_routines
      set current_version = v_version_number, title = p.plan->>'title', status = 'active'
      where id = v_routine_id;
  else
    insert into public.workout_routines (user_id, title, status, current_version, source)
    values (v_user, p.plan->>'title', 'active', 1, 'ai')
    returning id into v_routine_id;
    v_version_number := 1;
  end if;

  insert into public.workout_routine_versions (routine_id, user_id, version_number, goal_snapshot, plan_data, change_reason)
  values (v_routine_id, v_user, v_version_number, v_goals, p.plan, coalesce(p.request_text, 'AI proposal approved'))
  returning id into v_version_id;

  perform public._link_goals(v_routine_id, p.plan);
  v_created := public._create_sessions_for_version(v_routine_id, v_version_id, p.plan, p_occurrences, p_timezone, 'ai');

  update public.routine_proposals
    set status = 'applied', approved_version = p_version, approved_at = now(), applied_at = now(),
        applied_routine_id = v_routine_id
    where id = p.id;

  v_result := jsonb_build_object(
    'routineId', v_routine_id, 'versionId', v_version_id, 'versionNumber', v_version_number,
    'sessionsCreated', v_created, 'sessionsRetired', v_retired
  );
  perform public._idem_put(p_idempotency_key, 'apply_routine_proposal', v_result);
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- WF-04: manual routine create / new version
-- ---------------------------------------------------------------------------

create or replace function public.create_manual_routine(
  p_plan jsonb,
  p_activate boolean,
  p_occurrences jsonb,
  p_timezone text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public._require_user();
  v_existing jsonb := public._idem_get(p_idempotency_key);
  v_routine_id uuid;
  v_version_id uuid;
  v_created integer := 0;
  v_result jsonb;
begin
  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.workout_routines (user_id, title, status, current_version, source)
  values (v_user, p_plan->>'title', case when p_activate then 'active' else 'draft' end, 1, 'manual')
  returning id into v_routine_id;

  insert into public.workout_routine_versions (routine_id, user_id, version_number, plan_data, change_reason)
  values (v_routine_id, v_user, 1, p_plan, 'Created manually')
  returning id into v_version_id;

  perform public._link_goals(v_routine_id, p_plan);

  -- Creating a template and scheduling sessions are distinct actions.
  if p_activate then
    v_created := public._create_sessions_for_version(v_routine_id, v_version_id, p_plan, p_occurrences, p_timezone, 'manual');
  end if;

  v_result := jsonb_build_object('routineId', v_routine_id, 'versionId', v_version_id, 'versionNumber', 1, 'sessionsCreated', v_created);
  perform public._idem_put(p_idempotency_key, 'create_manual_routine', v_result);
  return v_result;
end;
$$;

create or replace function public.save_routine_version(
  p_routine_id uuid,
  p_plan jsonb,
  p_change_reason text,
  p_activate boolean,
  p_reschedule_future boolean,
  p_occurrences jsonb,
  p_timezone text,
  p_today date,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public._require_user();
  v_existing jsonb := public._idem_get(p_idempotency_key);
  r public.workout_routines%rowtype;
  v_version_number integer;
  v_version_id uuid;
  v_created integer := 0;
  v_retired integer := 0;
  v_result jsonb;
begin
  if v_existing is not null then
    return v_existing;
  end if;

  select * into r from public.workout_routines where id = p_routine_id and user_id = v_user for update;
  if not found then
    raise exception 'routine not found' using errcode = 'P0002';
  end if;

  select coalesce(max(version_number), 0) + 1 into v_version_number
  from public.workout_routine_versions where routine_id = r.id;

  insert into public.workout_routine_versions (routine_id, user_id, version_number, plan_data, change_reason)
  values (r.id, v_user, v_version_number, p_plan, p_change_reason)
  returning id into v_version_id;

  update public.workout_routines
    set current_version = v_version_number, title = p_plan->>'title',
        status = case when p_activate then 'active' else status end
    where id = r.id;

  perform public._link_goals(r.id, p_plan);

  if p_reschedule_future then
    v_retired := public._retire_future_sessions(r.id, p_today, format('Replaced by routine version %s', v_version_number));
  end if;
  if p_reschedule_future or (p_activate and r.status <> 'active') then
    v_created := public._create_sessions_for_version(r.id, v_version_id, p_plan, p_occurrences, p_timezone, r.source);
  end if;

  v_result := jsonb_build_object('routineId', r.id, 'versionId', v_version_id, 'versionNumber', v_version_number,
                                 'sessionsCreated', v_created, 'sessionsRetired', v_retired);
  perform public._idem_put(p_idempotency_key, 'save_routine_version', v_result);
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- WF-07: reschedule / miss / cancel — always written to schedule_changes
-- ---------------------------------------------------------------------------

create or replace function public.reschedule_session(
  p_session_id uuid,
  p_new_date date,
  p_new_time time,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public._require_user();
  v_existing jsonb := public._idem_get(p_idempotency_key);
  s public.workout_sessions%rowtype;
  v_change_id uuid;
  v_result jsonb;
begin
  if v_existing is not null then
    return v_existing;
  end if;

  select * into s from public.workout_sessions where id = p_session_id and user_id = v_user for update;
  if not found then
    raise exception 'session not found' using errcode = 'P0002';
  end if;
  if s.planned_date is null then
    raise exception 'an unplanned activity cannot be rescheduled' using errcode = 'P0001';
  end if;
  if s.status not in ('scheduled', 'missed') then
    raise exception 'a % session cannot be moved', s.status using errcode = 'P0001';
  end if;

  insert into public.schedule_changes (
    user_id, session_id, change_type, old_date, old_time, new_date, new_time, previous_status, reason, actor, idempotency_key
  ) values (
    v_user, s.id, 'rescheduled', s.planned_date, s.planned_time, p_new_date, p_new_time, s.status, p_reason, 'user', p_idempotency_key
  ) returning id into v_change_id;

  -- Moving is not completion: the session goes back to (or stays) scheduled.
  update public.workout_sessions
    set planned_date = p_new_date, planned_time = p_new_time, status = 'scheduled'
    where id = s.id;

  v_result := jsonb_build_object('sessionId', s.id, 'changeId', v_change_id);
  perform public._idem_put(p_idempotency_key, 'reschedule_session', v_result);
  return v_result;
end;
$$;

create or replace function public.set_session_outcome(
  p_session_id uuid,
  p_outcome text,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public._require_user();
  v_existing jsonb := public._idem_get(p_idempotency_key);
  s public.workout_sessions%rowtype;
  v_change_type text;
  v_result jsonb;
begin
  if v_existing is not null then
    return v_existing;
  end if;
  if p_outcome not in ('missed', 'cancelled') then
    raise exception 'unsupported outcome %', p_outcome using errcode = '22023';
  end if;

  select * into s from public.workout_sessions where id = p_session_id and user_id = v_user for update;
  if not found then
    raise exception 'session not found' using errcode = 'P0002';
  end if;
  if p_outcome = 'missed' and s.status <> 'scheduled' then
    raise exception 'only a scheduled session can be marked missed (it is %)', s.status using errcode = 'P0001';
  end if;
  if p_outcome = 'cancelled' and s.status not in ('scheduled', 'missed') then
    raise exception 'a % session cannot be cancelled', s.status using errcode = 'P0001';
  end if;

  v_change_type := case p_outcome when 'missed' then 'marked_missed' else 'cancelled' end;
  insert into public.schedule_changes (user_id, session_id, change_type, old_date, old_time, previous_status, reason, actor, idempotency_key)
  values (v_user, s.id, v_change_type, s.planned_date, s.planned_time, s.status, p_reason, 'user', p_idempotency_key);

  update public.workout_sessions set status = p_outcome where id = s.id;

  v_result := jsonb_build_object('sessionId', s.id, 'status', p_outcome);
  perform public._idem_put(p_idempotency_key, 'set_session_outcome', v_result);
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- WF-10: approve a meal-plan proposal → active plan, timetable, shopping list
-- ---------------------------------------------------------------------------

-- p_shopping: consolidated items computed by the API:
--   [{ name, quantity, unit, category, sourceEntryIndexes: [int] }]
create or replace function public.approve_meal_plan_proposal(
  p_proposal_id uuid,
  p_version integer,
  p_shopping jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public._require_user();
  v_existing jsonb := public._idem_get(p_idempotency_key);
  p public.meal_plan_proposals%rowtype;
  v_plan_id uuid;
  entry jsonb;
  item jsonb;
  v_entry_ids uuid[] := '{}';
  v_entry_id uuid;
  v_archived integer;
  v_result jsonb;
begin
  if v_existing is not null then
    return v_existing;
  end if;

  select * into p from public.meal_plan_proposals where id = p_proposal_id and user_id = v_user for update;
  if not found then
    raise exception 'proposal not found' using errcode = 'P0002';
  end if;
  if p.status = 'applied' then
    return jsonb_build_object('mealPlanId', p.applied_meal_plan_id, 'alreadyApplied', true);
  end if;
  if p.status <> 'draft' then
    raise exception 'proposal is %', p.status using errcode = 'P0001';
  end if;
  if p.version <> p_version then
    raise exception 'proposal changed since it was reviewed (now version %)', p.version using errcode = '40001';
  end if;
  if p.plan is null then
    raise exception 'proposal has no plan to approve' using errcode = 'P0001';
  end if;

  -- Older overlapping plans are archived, never deleted (history is kept).
  update public.meal_plans
    set status = 'archived'
    where user_id = v_user and status = 'active'
      and start_date <= (p.plan->>'endDate')::date and end_date >= (p.plan->>'startDate')::date;
  get diagnostics v_archived = row_count;

  insert into public.meal_plans (user_id, proposal_id, title, goal_context, start_date, end_date, status, version, source, slots, approved_at)
  values (
    v_user, p.id, p.plan->>'title', p.plan->>'goalContext', (p.plan->>'startDate')::date, (p.plan->>'endDate')::date,
    'active', p.version, 'ai',
    coalesce((select array_agg(x) from jsonb_array_elements_text(p.plan->'slots') x), '{}'),
    now()
  ) returning id into v_plan_id;

  for entry in select * from jsonb_array_elements(p.plan->'entries')
  loop
    insert into public.meal_plan_entries (meal_plan_id, user_id, entry_date, meal_slot, sort_order, meal_name, description, ingredients, is_smoothie, notes)
    values (
      v_plan_id, v_user, (entry->>'date')::date, entry->>'slot', coalesce((entry->>'sortOrder')::int, 0),
      entry->>'mealName', entry->>'description', coalesce(entry->'ingredients', '[]'::jsonb),
      coalesce((entry->>'isSmoothie')::boolean, false), entry->>'notes'
    ) returning id into v_entry_id;
    v_entry_ids := v_entry_ids || v_entry_id;
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_shopping, '[]'::jsonb))
  loop
    insert into public.shopping_list_items (meal_plan_id, user_id, name, quantity, unit, category, source_meal_entry_ids)
    values (
      v_plan_id, v_user, item->>'name', nullif(item->>'quantity', '')::numeric, nullif(item->>'unit', ''),
      nullif(item->>'category', ''),
      coalesce(
        (select array_agg(v_entry_ids[(i::int) + 1]) from jsonb_array_elements_text(coalesce(item->'sourceEntryIndexes', '[]'::jsonb)) i),
        '{}'
      )
    );
  end loop;

  update public.meal_plan_proposals
    set status = 'applied', approved_at = now(), applied_meal_plan_id = v_plan_id
    where id = p.id;

  v_result := jsonb_build_object('mealPlanId', v_plan_id, 'archivedPlans', v_archived);
  perform public._idem_put(p_idempotency_key, 'approve_meal_plan_proposal', v_result);
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- WF-06: correct a set log with an audit row
-- ---------------------------------------------------------------------------

create or replace function public.correct_exercise_log(
  p_log_id uuid,
  p_actual_reps integer,
  p_actual_weight numeric,
  p_weight_unit text,
  p_status text,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public._require_user();
  l public.exercise_logs%rowtype;
  v_new jsonb;
begin
  select * into l from public.exercise_logs where id = p_log_id and user_id = v_user for update;
  if not found then
    raise exception 'log not found' using errcode = 'P0002';
  end if;

  v_new := jsonb_build_object('actual_reps', p_actual_reps, 'actual_weight', p_actual_weight,
                              'weight_unit', p_weight_unit, 'status', coalesce(p_status, l.status));

  insert into public.exercise_log_corrections (log_id, user_id, previous_values, new_values, reason)
  values (
    l.id, v_user,
    jsonb_build_object('actual_reps', l.actual_reps, 'actual_weight', l.actual_weight, 'weight_unit', l.weight_unit, 'status', l.status),
    v_new, p_reason
  );

  update public.exercise_logs
    set actual_reps = p_actual_reps, actual_weight = p_actual_weight, weight_unit = p_weight_unit,
        status = coalesce(p_status, l.status), corrected_at = now()
    where id = l.id;

  return jsonb_build_object('logId', l.id);
end;
$$;

-- Functions are executable by PUBLIC by default; restrict to signed-in users.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
