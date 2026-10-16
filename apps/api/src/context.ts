import type { SupabaseClient } from '@supabase/supabase-js';
import type { Env } from './config/env.js';
import type { AiClient } from './lib/groq.js';
import type { VerifiedUser } from './lib/supabase.js';

/** Per-request context. `db` is the user-scoped (RLS) Supabase client. */
export interface AppContext {
  env: Env;
  user: VerifiedUser;
  db: SupabaseClient;
  ai: AiClient;
  now: () => Date;
}
