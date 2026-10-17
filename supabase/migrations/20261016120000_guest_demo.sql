-- Guest (anonymous) demo sessions.
--
-- Visitors can try Mova without an account through Supabase anonymous sign-ins.
-- A guest is a real auth user (is_anonymous = true), so every table keeps using
-- the same row level security: a guest can only ever see their own rows.
--
-- This migration adds:
--   * ai_usage + reserve_ai_call(): per-guest and global limits on AI calls, so a
--     public demo cannot run up the AI provider bill. Registered users are not limited.
--   * delete_guest_account(): lets a guest erase their own demo data immediately.
--   * purge_stale_guests(): deletes guest users (and, by cascade, all their data)
--     after a retention period; scheduled daily when pg_cron is available.

create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (char_length(kind) <= 40),
  created_at timestamptz not null default now()
);
create index ai_usage_user_idx on public.ai_usage (user_id, created_at desc);
create index ai_usage_day_idx on public.ai_usage (created_at desc);

alter table public.ai_usage enable row level security;
-- Users may read their own usage; nobody writes it directly (only reserve_ai_call does).
create policy ai_usage_select_own on public.ai_usage for select to authenticated using (user_id = auth.uid());
revoke all on public.ai_usage from anon, authenticated;
grant select on public.ai_usage to authenticated;

-- Records one AI call and enforces demo limits for guests. Raises
-- 'demo_limit:<scope>' when a limit is reached.
create or replace function public.reserve_ai_call(p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_guest boolean;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select coalesce(u.is_anonymous, false) into v_guest from auth.users u where u.id = v_user;
  if coalesce(v_guest, false) then
    if (select count(*) from public.ai_usage where user_id = v_user and created_at > now() - interval '1 hour') >= 20 then
      raise exception 'demo_limit:hour';
    end if;
    if (select count(*) from public.ai_usage where user_id = v_user and created_at > now() - interval '1 day') >= 60 then
      raise exception 'demo_limit:day';
    end if;
    if (select count(*) from public.ai_usage where created_at > now() - interval '1 day') >= 3000 then
      raise exception 'demo_limit:global';
    end if;
  end if;
  insert into public.ai_usage (user_id, kind) values (v_user, left(p_kind, 40));
end;
$$;
revoke execute on function public.reserve_ai_call(text) from public, anon;
grant execute on function public.reserve_ai_call(text) to authenticated;

-- A guest erases their own demo workspace. Refuses registered accounts.
create or replace function public.delete_guest_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  delete from auth.users where id = auth.uid() and coalesce(is_anonymous, false);
  if not found then
    raise exception 'not_a_guest';
  end if;
end;
$$;
revoke execute on function public.delete_guest_account() from public, anon;
grant execute on function public.delete_guest_account() to authenticated;

-- Retention: remove guests (and all their data, via ON DELETE CASCADE) after a while.
create or replace function public.purge_stale_guests(p_older_than interval default interval '7 days')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from auth.users where coalesce(is_anonymous, false) and created_at < now() - p_older_than;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.purge_stale_guests(interval) from public, anon, authenticated;

-- Daily clean-up where pg_cron exists (Supabase); skipped in plain Postgres.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('purge-stale-guests', '17 3 * * *', 'select public.purge_stale_guests()');
  end if;
exception when others then
  raise notice 'pg_cron not scheduled: %', sqlerrm;
end;
$$;
