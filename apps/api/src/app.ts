import type { SupabaseClient } from '@supabase/supabase-js';
import { ZodError } from 'zod';
import { allowedOrigins, ConfigError, getEnv, type Env } from './config/env.js';
import { ApiError, buildRoutes, errorResponse, json, makeRequest, readJson, unauthorized, validationError, type AiClient, type AppContext, type Db } from '@mova/engine';
import { createGroqClient } from './lib/ai.js';
import { withAiLimits } from './lib/guestLimits.js';
import { createUserClient, verifyAccessToken, type VerifiedUser } from './lib/supabase.js';

/** Dependencies are injectable so tests can run without network services. */
export interface AppDeps {
  env?: Env;
  verifyToken?: (env: Env, token: string) => Promise<VerifiedUser | null>;
  userClient?: (env: Env, token: string, user: VerifiedUser) => SupabaseClient;
  ai?: (env: Env) => AiClient;
  now?: () => Date;
  log?: (entry: Record<string, unknown>) => void;
}

const routes = buildRoutes();

function corsHeaders(env: Env, origin: string | null): Record<string, string> {
  const allowed = allowedOrigins(env);
  // Native apps send no Origin header; only browser origins need allow-listing.
  if (!origin || !allowed.includes(origin)) return { vary: 'Origin' };
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type',
    'access-control-max-age': '600',
    vary: 'Origin',
  };
}

/** Extract the API path ("routines/123") from either the rewrite param or the URL. */
export function apiPath(url: URL): string {
  const fromRewrite = url.searchParams.get('__path');
  if (fromRewrite !== null) return fromRewrite;
  return url.pathname.replace(/^\/api\/v1\/?/, '').replace(/^\/api\/router\/?/, '');
}

export async function handleRequest(request: Request, deps: AppDeps = {}): Promise<Response> {
  const started = Date.now();
  const log = deps.log ?? ((e) => console.log(JSON.stringify(e)));
  const url = new URL(request.url);
  const path = apiPath(url);
  let env: Env;
  try {
    env = deps.env ?? getEnv();
  } catch (e) {
    const message = e instanceof ConfigError ? 'Server is not configured.' : 'Server error.';
    log({ level: 'error', msg: 'config_error', path });
    return json({ error: { code: 'server_misconfigured', message } }, 500);
  }
  const cors = corsHeaders(env, request.headers.get('origin'));

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  // Public health check — returns no configuration details.
  if (path === 'health' && request.method === 'GET') {
    return json({ status: 'ok', time: new Date().toISOString() }, 200, cors);
  }

  let status = 500;
  try {
    const match = routes.match(request.method, path);
    if (match === null) throw new ApiError(404, 'not_found', 'Unknown endpoint.');
    if (match === 'method_not_allowed') throw new ApiError(405, 'method_not_allowed', 'Method not allowed.');

    const header = request.headers.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw unauthorized();
    // Identity always comes from the verified token, never from the request body.
    const user = await (deps.verifyToken ?? verifyAccessToken)(env, token);
    if (!user) throw unauthorized('Your session has expired. Sign in again.');

    const db = (deps.userClient ? deps.userClient(env, token, user) : createUserClient(env, token)) as unknown as Db;
    const ctx: AppContext = {
      user,
      db,
      ai: withAiLimits(deps.ai ? deps.ai(env) : createGroqClient(env), db),
      now: deps.now ?? (() => new Date()),
    };

    const body = await readJson(request);
    const result = await match.route.handler(makeRequest(ctx, match.params, url.searchParams, body));
    status = match.route.status;
    // Streaming routes return a ready Response (their own body); everything else is JSON.
    if (result instanceof Response) {
      for (const [k, v] of Object.entries(cors)) result.headers.set(k, v);
      return result;
    }
    return json(result, status, cors);
  } catch (e) {
    const err =
      e instanceof ApiError
        ? e
        : e instanceof ZodError
          ? validationError(e)
          : new ApiError(500, 'server_error', 'Something went wrong. Nothing was changed.');
    status = err.status;
    if (err.status >= 500) {
      // Operational metadata only — no request bodies, tokens or conversation content.
      log({ level: 'error', msg: 'request_failed', method: request.method, path, code: err.code, error: e instanceof Error ? e.name : 'unknown' });
    }
    return errorResponse(err, cors);
  } finally {
    log({ level: 'info', method: request.method, path: path.replace(/[0-9a-f-]{36}/g, ':id'), status, ms: Date.now() - started });
  }
}
