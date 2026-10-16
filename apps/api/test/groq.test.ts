import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { handleRequest } from '../src/app.js';
import { AiUnavailableError, createGroqClient } from '../src/lib/groq.js';
import { testEnv } from './support/harness.js';

const schema = z.object({ reply: z.string().min(1), count: z.number().int() });

function reply(content: string, status = 200) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status, headers: { 'content-type': 'application/json' } });
}

describe('Groq client', () => {
  it('sends a json_schema request server-side and validates the reply', async () => {
    const seen: any[] = [];
    const client = createGroqClient(testEnv, async (url, init) => {
      seen.push({ url, body: JSON.parse(String(init.body)), auth: (init.headers as Record<string, string>).authorization });
      return reply(JSON.stringify({ reply: 'hi', count: 2 }));
    });
    const out = await client.structured({ name: 'demo', schema, messages: [{ role: 'user', content: 'hello' }] });
    expect(out).toEqual({ reply: 'hi', count: 2 });
    expect(seen[0].url).toBe('http://groq.test/v1/chat/completions');
    expect(seen[0].body.response_format.type).toBe('json_schema');
    expect(seen[0].body.model).toBe('test-model');
    expect(seen[0].auth).toBe('Bearer test-groq-key');
  });

  it('asks the model to repair output that does not match the schema, once', async () => {
    let calls = 0;
    const client = createGroqClient(testEnv, async (_url, init) => {
      calls++;
      const body = JSON.parse(String(init.body));
      if (calls === 1) return reply(JSON.stringify({ reply: 'hi', count: 'two' }));
      expect(body.messages.at(-1).content).toMatch(/did not match/);
      return reply(JSON.stringify({ reply: 'hi', count: 2 }));
    });
    await expect(client.structured({ name: 'demo', schema, messages: [] })).resolves.toEqual({ reply: 'hi', count: 2 });
    expect(calls).toBe(2);
  });

  it('gives up safely after a second invalid reply', async () => {
    const client = createGroqClient(testEnv, async () => reply('not json'));
    await expect(client.structured({ name: 'demo', schema, messages: [] })).rejects.toMatchObject({ reason: 'invalid_output' });
  });

  it('maps rate limits and missing configuration to AI-unavailable errors', async () => {
    const limited = createGroqClient(testEnv, async () => new Response('{}', { status: 429 }));
    await expect(limited.structured({ name: 'demo', schema, messages: [] })).rejects.toBeInstanceOf(AiUnavailableError);
    const unconfigured = createGroqClient({ ...testEnv, GROQ_API_KEY: undefined }, async () => reply('{}'));
    expect(unconfigured.configured).toBe(false);
    await expect(unconfigured.structured({ name: 'demo', schema, messages: [] })).rejects.toMatchObject({ reason: 'not_configured' });
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
