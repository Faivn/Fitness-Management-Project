-- Tighten privileges after the initial schema.
--
-- Supabase's default privileges give `authenticated` every privilege on new
-- tables in `public`. Mova only needs SELECT/INSERT/UPDATE/DELETE, with RLS
-- deciding which rows; TRUNCATE in particular ignores RLS, so remove the rest.
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- handle_new_user() is a SECURITY DEFINER trigger function; it must never be
-- callable through the API (Supabase advisor 0029). The trigger still runs.
revoke execute on function public.handle_new_user() from authenticated;
