import type { AiClient } from './ai.js';

/**
 * The only database surface the engine needs: the small subset of the
 * supabase-js query builder (`from(...).select/insert/update/upsert/delete`
 * with eq/neq/gt/gte/lt/lte/in/is/not, order, limit, single/maybeSingle) and
 * `rpc`. Supabase's client satisfies it on a server; `createLocalDb` satisfies
 * it in the browser on top of local storage.
 */
export interface Db {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: any; error: { code?: string; message?: string } | null }>;
}

export interface EngineUser {
  id: string;
  email: string | null;
}

/** Per-request context: who is acting, where data lives, which AI answers, and what time it is. */
export interface AppContext {
  user: EngineUser;
  db: Db;
  ai: AiClient;
  now: () => Date;
}
