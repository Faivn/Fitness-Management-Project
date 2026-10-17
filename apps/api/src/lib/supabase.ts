import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { EngineUser } from '@mova/engine';
import type { Env } from '../config/env.js';

/**
 * A Supabase client scoped to ONE verified user: the publishable key plus the
 * user's own access token, so every query runs under that user's RLS
 * (spec §8.0.1 step 4). The service-role key is never used for user requests.
 */
export function createUserClient(env: Env, accessToken: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export type VerifiedUser = EngineUser;

/** Verify an access token with Supabase Auth and derive the user id from it. */
export async function verifyAccessToken(env: Env, accessToken: string): Promise<VerifiedUser | null> {
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}
