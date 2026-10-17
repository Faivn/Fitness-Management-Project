import { beforeAll, describe, expect, it } from 'vitest';
import { AiUnavailableError, createGroqClient, partialJsonString } from '../src/lib/ai.js';
import { z } from 'zod';
import { createHarness, key, testEnv } from './support/harness.js';

describe('partialJsonString', () => {
  it('returns the reply text as it grows, decoding escapes and ignoring an unfinished escape', () => {
    expect(partialJsonString('{"rep', 'reply')).toBe('');
    expect(partialJsonString('{"reply":"Hel', 'reply')).toBe('Hel');
    expect(partialJsonString('{"reply":"Line1\\nLine2 \\"q\\" \\u00e9","x":1}', 'reply')).toBe('Line1\nLine2 "q" é');
    expect(partialJsonString('{"reply":"cut\\', 'reply')).toBe('cut');
    expect(partialJsonString('{"reply":"cut\\u00', 'reply')).toBe('cut');
  });
});

describe('Groq client streaming', () => {
  const schema = z.object({ reply: z.string().min(1), n: z.number() });
  const sse = (chunks: string[]) =>
    new Response(
      new ReadableStream({
        start(c) {
          const enc = new TextEncoder();
          for (const t of chunks) c.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`));
          c.enqueue(enc.encode('data: [DONE]\n\n'));
          c.close();
        },
      }),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    );

  it('asks for a stream, reports cumulative text and still validates the final result', async () => {
    const seen: string[] = [];
    let body: any;
    const client = createGroqClient(testEnv, async (_u, init) => {
      body = JSON.parse(String(init.body));
      return sse(['{"reply":"He', 'llo","n"', ':2}']);
    });
    const out = await client.structured({ name: 'x', schema, messages: [], onText: (t) => seen.push(t) });
    expect(body.stream).toBe(true);
    expect(body.response_format).toBeUndefined(); // Groq only streams tokens without one
    expect(body.messages.at(-1).content).toMatch(/JSON Schema/);
    expect(seen).toEqual(['{"reply":"He', '{"reply":"Hello","n"', '{"reply":"Hello","n":2}']);
    expect(out).toEqual({ reply: 'Hello', n: 2 });
  });

  it('tolerates a code fence around streamed JSON', async () => {
    const client = createGroqClient(testEnv, async () => sse(['```json\n{"reply":"Hi","n":1}\n```']));
    await expect(client.structured({ name: 'x', schema, messages: [], onText: () => {} })).resolves.toEqual({ reply: 'Hi', n: 1 });
  });

  it('fails safely when the streamed output does not match the schema', async () => {
    const client = createGroqClient(testEnv, async (_u, init) =>
      JSON.parse(String(init.body)).stream ? sse(['{"reply":"x","n":"no"}']) : new Response(JSON.stringify({ choices: [{ message: { content: '{"reply":"x","n":"no"}' } }] })),
    );
    await expect(client.structured({ name: 'x', schema, messages: [], onText: () => {} })).rejects.toMatchObject({ reason: 'invalid_output' });
  });
});

describe('POST ai/turn/stream', () => {
  let h: Awaited<ReturnType<typeof createHarness>>;
  beforeAll(async () => {
    h = await createHarness();
  });

  it('streams the reply, then returns the saved conversation; suggestions stay drafts', async () => {
    h.ai.enqueue('assistant_turn', { reply: 'Great — here is how I understood your goals.', proposedGoals: [{ title: 'Train four times a week', priority: 'high' }] });
    const r = await h.callStream('ai/turn/stream', { message: 'I want to train 4x a week', clientMessageId: key('msg') });
    expect(r.status).toBe(200);
    expect(r.contentType).toContain('ndjson');
    const deltas = r.events.filter((e) => e.type === 'delta').map((e) => e.text as string);
    expect(deltas.length).toBeGreaterThan(1);
    expect(deltas.at(-1)).toBe('Great — here is how I understood your goals.');
    for (let i = 1; i < deltas.length; i++) expect(deltas[i]!.startsWith(deltas[i - 1]!)).toBe(true);
    const done = r.events.at(-1);
    expect(done.type).toBe('done');
    expect(done.goalProposal.status).toBe('draft');
    expect(done.conversation.messages.at(-1)).toMatchObject({ role: 'assistant', content: 'Great — here is how I understood your goals.' });
    expect((await h.call('GET', 'goals')).body).toHaveLength(0); // nothing saved without approval
  });

  it('reports an AI failure as an event and keeps the user message', async () => {
    h.ai.enqueue('assistant_turn', new AiUnavailableError('down', 'provider_error'));
    const r = await h.callStream('ai/turn/stream', { message: 'Can you plan my week?', clientMessageId: key('msg') });
    expect(r.status).toBe(200);
    expect(r.events.at(-1)).toMatchObject({ type: 'error', code: 'ai_unavailable' });
    const convs = (await h.call('GET', 'ai/conversations')).body;
    const conv = (await h.call('GET', `ai/conversations/${convs[0].id}`)).body;
    expect(conv.messages.at(-1)).toMatchObject({ role: 'user', content: 'Can you plan my week?' });
  });

  it('does not call the model again when the same message is retried after it was answered', async () => {
    const id = key('msg');
    h.ai.enqueue('assistant_turn', { reply: 'One answer.' });
    const first = await h.callStream('ai/turn/stream', { message: 'Hello there', clientMessageId: id });
    const conversationId = first.events.at(-1).conversation.id;
    const calls = h.ai.calls.length;
    const retry = await h.callStream('ai/turn/stream', { conversationId, message: 'Hello there', clientMessageId: id });
    expect(h.ai.calls.length).toBe(calls);
    expect(retry.events.at(-1).type).toBe('done');
  });

  it('keeps ordinary HTTP errors for bad input and missing auth', async () => {
    expect((await h.callStream('ai/turn/stream', { message: '' })).status).toBe(400);
    expect((await h.callStream('ai/turn/stream', { message: 'hi there', clientMessageId: key('m') }, null)).status).toBe(401);
  });
});
