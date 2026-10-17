import { beforeAll, describe, expect, it } from 'vitest';
import { createHarness, key } from './support/harness.js';

describe('guest (anonymous) sessions', () => {
  let h: Awaited<ReturnType<typeof createHarness>>;
  beforeAll(async () => {
    h = await createHarness();
  });

  it('gets a workspace with the same API and the same approval flow as an account', async () => {
    expect((await h.call('GET', 'profile', undefined, 'guest')).status).toBe(200);
    h.ai.enqueue('assistant_turn', { reply: 'Here is what I understood.', proposedGoals: [{ title: 'Run 5 km', priority: 'high' }] });
    const turn = await h.call('POST', 'ai/turn', { message: 'I want to run a 5k', clientMessageId: key('g') }, 'guest');
    expect(turn.status).toBe(200);
    expect(turn.body.goalProposal.status).toBe('draft');
    expect((await h.call('GET', 'goals', undefined, 'guest')).body).toHaveLength(0); // still nothing saved
    const ok = await h.call('POST', `goal-proposals/${turn.body.goalProposal.id}/approve`, { version: 1, goals: [{ title: 'Run 5 km', priority: 'high' }], idempotencyKey: key() }, 'guest');
    expect(ok.status).toBe(200);
    expect((await h.call('GET', 'goals', undefined, 'guest')).body).toHaveLength(1);
  });

  it('keeps one visitor’s data invisible to another, including proposals', async () => {
    const guestConv = (await h.call('GET', 'ai/conversations', undefined, 'guest')).body;
    expect(guestConv.length).toBeGreaterThan(0);
    expect((await h.call('GET', `ai/conversations/${guestConv[0].id}`, undefined, 'alice')).status).toBe(404);
    expect((await h.call('GET', 'goals', undefined, 'alice')).body).toHaveLength(0);
  });

  it('stops a guest at the hourly AI limit with a clear, non-leaky message, and keeps their message', async () => {
    // 1 call used above; use up the rest of the 20/hour allowance.
    for (let i = 0; i < 19; i++) {
      h.ai.enqueue('assistant_turn', { reply: `ok ${i}` });
      const r = await h.call('POST', 'ai/turn', { message: `message number ${i}`, clientMessageId: key('g') }, 'guest');
      expect(r.status).toBe(200);
    }
    const blocked = await h.call('POST', 'ai/turn', { message: 'one more please', clientMessageId: key('g') }, 'guest');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('demo_limit');
    expect(blocked.body.error.message).toMatch(/limit for this hour/);
    const stream = await h.callStream('ai/turn/stream', { message: 'and via streaming', clientMessageId: key('g') }, 'guest');
    expect(stream.events.at(-1)).toMatchObject({ type: 'error', code: 'demo_limit' });
    const convs = (await h.call('GET', 'ai/conversations', undefined, 'guest')).body;
    const all: string[] = [];
    for (const c of convs) all.push(...(await h.call('GET', `ai/conversations/${c.id}`, undefined, 'guest')).body.messages.map((m: any) => m.content));
    expect(all).toContain('one more please');
    expect(all).toContain('and via streaming');
  });

  it('lets a guest erase their workspace, and refuses a registered account', async () => {
    expect((await h.call('DELETE', 'guest', undefined, 'alice')).status).toBe(403);
    expect((await h.call('DELETE', 'guest', undefined, 'guest')).status).toBe(200);
    expect((await h.call('GET', 'goals', undefined, 'alice')).status).toBe(200); // other users untouched
  });

  it('never limits registered users', async () => {
    for (let i = 0; i < 25; i++) {
      h.ai.enqueue('assistant_turn', { reply: `ok ${i}` });
      expect((await h.call('POST', 'ai/turn', { message: `alice message ${i}`, clientMessageId: key('a') }, 'alice')).status).toBe(200);
    }
  });
});
