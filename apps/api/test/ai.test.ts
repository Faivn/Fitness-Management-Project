import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { handleRequest } from '../src/app.js';
import { ConfigError, getEnv } from '../src/config/env.js';
import { AiUnavailableError, createGroqClient } from '../src/lib/ai.js';
import { testEnv } from './support/harness.js';

const schema = z.object({ reply: z.string().min(1), count: z.number().int() });

function completion(content: string | null, status = 200) {
  const body =
    status === 200
      ? { id: 'chatcmpl-test', object: 'chat.completion', choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }] }
      : { error: { message: 'provider error text', type: 'test' } };
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('server configuration', () => {
  const base = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_0123456789abcdef' };

  it('reads the Groq variables and applies the documented defaults', () => {
    const e = getEnv({ ...base, GROQ_API_KEY: 'gsk_test_key_value' });
    expect(e).toMatchObject({
      GROQ_API_KEY: 'gsk_test_key_value',
      GROQ_BASE_URL: 'https://api.groq.com/openai/v1',
      GROQ_MODEL: 'openai/gpt-oss-120b',
    });
  });

  it('treats an empty key as not configured', () => {
    expect(getEnv({ ...base, GROQ_API_KEY: '' }).GROQ_API_KEY).toBeUndefined();
  });

  it('refuses to send the key to a non-https, non-local base URL', () => {
    expect(() => getEnv({ ...base, GROQ_BASE_URL: 'http://evil.example/v1' })).toThrow(ConfigError);
    expect(getEnv({ ...base, GROQ_BASE_URL: 'http://localhost:9999/v1' }).GROQ_BASE_URL).toBe('http://localhost:9999/v1');
  });
});

describe('Groq client (OpenAI-compatible Chat Completions)', () => {
  it('sends a structured-output request to the configured base URL and validates the reply', async () => {
    const seen: any[] = [];
    const client = createGroqClient(testEnv, async (url, init) => {
      seen.push({ url, body: JSON.parse(String(init.body)), headers: init.headers as Record<string, string> });
      return completion(JSON.stringify({ reply: 'hi', count: 2 }));
    });
    const out = await client.structured({ name: 'demo', schema, messages: [{ role: 'user', content: 'hello' }] });
    expect(out).toEqual({ reply: 'hi', count: 2 });
    expect(seen[0].url).toBe('https://groq.test/openai/v1/chat/completions');
    expect(seen[0].body.model).toBe('test-model');
    expect(seen[0].body.response_format).toMatchObject({ type: 'json_schema', json_schema: { name: 'demo', strict: false } });
    expect(seen[0].body.messages).toEqual([{ role: 'user', content: 'hello' }]);
    expect(seen[0].headers.authorization).toBe('Bearer test-groq-key-0000');
  });

  it('never puts the API key in the request body', async () => {
    let body = '';
    const client = createGroqClient(testEnv, async (_u, init) => {
      body = String(init.body);
      return completion(JSON.stringify({ reply: 'hi', count: 1 }));
    });
    await client.structured({ name: 'demo', schema, messages: [] });
    expect(body).not.toContain('test-groq-key-0000');
  });

  it('asks the model to repair output that does not match the schema, once', async () => {
    let calls = 0;
    const client = createGroqClient(testEnv, async (_u, init) => {
      calls++;
      const body = JSON.parse(String(init.body));
      if (calls === 1) return completion(JSON.stringify({ reply: 'hi', count: 'two' }));
      expect(body.messages.at(-1).content).toMatch(/did not match/);
      return completion(JSON.stringify({ reply: 'hi', count: 2 }));
    });
    await expect(client.structured({ name: 'demo', schema, messages: [] })).resolves.toEqual({ reply: 'hi', count: 2 });
    expect(calls).toBe(2);
  });

  it('retries once when the provider rejects a malformed structured output (400)', async () => {
    let calls = 0;
    const client = createGroqClient(testEnv, async () => (++calls === 1 ? completion(null, 400) : completion(JSON.stringify({ reply: 'ok', count: 1 }))));
    await expect(client.structured({ name: 'demo', schema, messages: [] })).resolves.toEqual({ reply: 'ok', count: 1 });
  });

  it('gives up safely after invalid replies, empty content or non-JSON text', async () => {
    for (const content of ['not json', '', null]) {
      const client = createGroqClient(testEnv, async () => completion(content));
      await expect(client.structured({ name: 'demo', schema, messages: [] })).rejects.toMatchObject({ reason: 'invalid_output' });
    }
  });

  it('maps provider failures to typed, non-leaky errors', async () => {
    const cases: Array<[number, string]> = [
      [401, 'auth_failed'],
      [403, 'auth_failed'],
      [429, 'rate_limited'],
      [500, 'provider_error'],
      [503, 'provider_error'],
    ];
    for (const [status, reason] of cases) {
      const client = createGroqClient(testEnv, async () => completion(null, status));
      const err = await client.structured({ name: 'demo', schema, messages: [] }).catch((e) => e);
      expect(err).toBeInstanceOf(AiUnavailableError);
      expect(err.reason).toBe(reason);
      expect(err.message).not.toContain('test-groq-key-0000');
      expect(err.message).not.toContain('provider error text');
    }
  });

  it('maps network failures and timeouts', async () => {
    const down = createGroqClient(testEnv, async () => {
      throw new TypeError('fetch failed');
    });
    await expect(down.structured({ name: 'demo', schema, messages: [] })).rejects.toMatchObject({ reason: 'provider_error' });

    const slow = createGroqClient({ ...testEnv, GROQ_TIMEOUT_MS: 1000 }, (_u, init) => new Promise((_res, rej) => init.signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })))));
    await expect(slow.structured({ name: 'demo', schema, messages: [] })).rejects.toMatchObject({ reason: 'timeout' });
  }, 10_000);

  it('reports not configured without making a request', async () => {
    let called = false;
    const client = createGroqClient({ ...testEnv, GROQ_API_KEY: undefined }, async () => {
      called = true;
      return completion('{}');
    });
    expect(client.configured).toBe(false);
    await expect(client.structured({ name: 'demo', schema, messages: [] })).rejects.toMatchObject({ reason: 'not_configured' });
    expect(called).toBe(false);
  });
});

describe('CORS', () => {
  it('allows only configured browser origins', async () => {
    const ok = await handleRequest(new Request('http://api.test/api/v1/health', { headers: { origin: 'http://localhost:8081' } }), { env: testEnv, log: () => {} });
    expect(ok.headers.get('access-control-allow-origin')).toBe('http://localhost:8081');
    const bad = await handleRequest(new Request('http://api.test/api/v1/health', { headers: { origin: 'https://evil.example' } }), { env: testEnv, log: () => {} });
    expect(bad.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('resolves the path from the Vercel rewrite parameter', async () => {
    const r = await handleRequest(new Request('http://api.test/api/router?__path=health'), { env: testEnv, log: () => {} });
    expect(r.status).toBe(200);
  });
});
