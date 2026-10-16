import type { ZodType } from 'zod';
import { handleRequest } from '../../src/app.js';
import type { Env } from '../../src/config/env.js';
import { AiUnavailableError, type AiClient, type ChatMessage } from '../../src/lib/ai.js';
import { createTestDatabase, PgTestClient } from '../../src/dev/pgliteSupabase.js';

export const USERS = {
  alice: '11111111-1111-4111-8111-111111111111',
  bob: '22222222-2222-4222-8222-222222222222',
} as const;

export const testEnv: Env = {
  SUPABASE_URL: 'http://supabase.test',
  SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key-0000',
  GROQ_API_KEY: 'test-groq-key-0000',
  GROQ_BASE_URL: 'https://groq.test/openai/v1',
  GROQ_MODEL: 'test-model',
  GROQ_TIMEOUT_MS: 5000,
  APP_ORIGIN: 'http://localhost:8081',
  API_ENV: 'test',
};

/** Scripted AI: each call pops the next response (or error) for its schema name. */
export class FakeAi implements AiClient {
  configured = true;
  calls: Array<{ name: string; messages: ChatMessage[] }> = [];
  private queue = new Map<string, Array<unknown | Error>>();

  enqueue(name: string, response: unknown | Error) {
    const list = this.queue.get(name) ?? [];
    list.push(response);
    this.queue.set(name, list);
  }

  async structured<T>({ name, schema, messages, onText }: { name: string; schema: ZodType<T>; messages: ChatMessage[]; onText?: (soFar: string) => void }): Promise<T> {
    this.calls.push({ name, messages });
    const next = this.queue.get(name)?.shift();
    if (next === undefined) throw new AiUnavailableError('no scripted response', 'provider_error');
    if (next instanceof Error) throw next;
    if (onText) {
      // Emulate token streaming: cumulative JSON text in small chunks.
      const full = JSON.stringify(next);
      for (let i = 9; i < full.length + 9; i += 9) onText(full.slice(0, i));
    }
    // Real client validates too — model output is untrusted.
    const r = schema.safeParse(next);
    if (!r.success) throw new AiUnavailableError('invalid scripted output', 'invalid_output');
    return r.data;
  }
}

export async function createHarness(opts: { now?: string } = {}) {
  const { db, columns } = await createTestDatabase();
  await db.exec(
    `insert into auth.users (id, email) values ('${USERS.alice}', 'alice@example.test'), ('${USERS.bob}', 'bob@example.test');
     update public.profiles set timezone = 'Africa/Lagos';`,
  );
  const ai = new FakeAi();
  let now = new Date(opts.now ?? '2026-10-16T08:00:00Z');
  const tokens: Record<string, string> = { 'token-alice': USERS.alice, 'token-bob': USERS.bob };

  async function call<T = any>(
    method: string,
    path: string,
    body?: unknown,
    as: keyof typeof USERS | null = 'alice',
  ): Promise<{ status: number; body: T }> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (as) headers.authorization = `Bearer token-${as}`;
    const res = await handleRequest(
      new Request(`http://api.test/api/v1/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }),
      {
        env: testEnv,
        verifyToken: async (_env, token) => (tokens[token] ? { id: tokens[token]!, email: null } : null),
        userClient: (_env, _token, user) => new PgTestClient(db, columns, user.id).asSupabase(),
        ai: () => ai,
        now: () => now,
        log: () => {},
      },
    );
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }

  /** Streaming call: returns the parsed NDJSON events. */
  async function callStream(path: string, body: unknown, as: keyof typeof USERS | null = 'alice') {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (as) headers.authorization = `Bearer token-${as}`;
    const res = await handleRequest(new Request(`http://api.test/api/v1/${path}`, { method: 'POST', headers, body: JSON.stringify(body) }), {
      env: testEnv,
      verifyToken: async (_env, token) => (tokens[token] ? { id: tokens[token]!, email: null } : null),
      userClient: (_env, _token, user) => new PgTestClient(db, columns, user.id).asSupabase(),
      ai: () => ai,
      now: () => now,
      log: () => {},
    });
    const text = await res.text();
    const events = res.headers.get('content-type')?.includes('ndjson') ? text.split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
    return { status: res.status, contentType: res.headers.get('content-type'), events, text };
  }

  return {
    db,
    ai,
    call,
    callStream,
    setNow(iso: string) {
      now = new Date(iso);
    },
  };
}

let counter = 0;
export function key(prefix = 'k'): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}-xxxx`;
}
