import type { SupabaseClient } from '@supabase/supabase-js';
import type { AiClient } from './ai.js';
import { ApiError, fromDbError } from '../http/errors.js';

const MESSAGES: Record<string, string> = {
  hour: "You've used the demo's AI limit for this hour. Your work is kept — try again in a little while.",
  day: "You've used the demo's AI limit for today. Your work is kept — try again tomorrow.",
  global: 'The demo is very busy today and has reached its daily AI limit. Please try again tomorrow.',
};

/**
 * Counts every AI call in the database (reserve_ai_call) so public guest sessions
 * have per-guest and global limits. Registered users are counted but never limited.
 * The limit lives in the database, next to the data, so it works the same on every
 * serverless instance and cannot be skipped by calling a different endpoint.
 */
export function withAiLimits(ai: AiClient, db: SupabaseClient): AiClient {
  return {
    get configured() {
      return ai.configured;
    },
    async structured(opts) {
      if (ai.configured) {
        const { error } = await db.rpc('reserve_ai_call', { p_kind: opts.name });
        if (error) {
          const scope = /demo_limit:(hour|day|global)/.exec(error.message ?? '')?.[1];
          if (scope) throw new ApiError(429, 'demo_limit', MESSAGES[scope]!);
          throw fromDbError(error);
        }
      }
      return ai.structured(opts);
    },
  };
}
