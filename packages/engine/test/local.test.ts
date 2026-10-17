import { describe, expect, it } from 'vitest';
import { addDays, todayIn } from '@mova/shared';
import { z } from 'zod';
import { createDemoAi, createLocalApi, createRemoteAi, memoryStorage, withFallback } from '../src/index.js';

const TZ = 'Africa/Lagos';
const key = (() => {
  let n = 0;
  return () => `test-key-${++n}-xxxxxxxx`;
})();

async function fresh(sample = true) {
  const storage = memoryStorage();
  const api = createLocalApi({ storage, timezone: TZ, sample });
  await api.ready;
  return { api, storage };
}

describe('demo data', () => {
  it('opens already populated, with onboarding still to do', async () => {
    const { api } = await fresh();
    const profile: any = await api.call('GET', 'profile');
    expect(profile.onboardingCompletedAt).toBeNull();
    expect(profile.timezone).toBe(TZ);
    const today = todayIn(TZ);
    const sessions: any[] = await api.call('GET', `workout-sessions?from=${addDays(today, -21)}&to=${addDays(today, 28)}`);
    expect(sessions.length).toBeGreaterThan(8);
    expect(sessions.some((s) => s.status === 'completed')).toBe(true);
    expect(sessions.some((s) => s.status === 'missed')).toBe(true);
    expect(sessions.some((s) => s.originalPlannedDate !== s.plannedDate)).toBe(true); // a moved session keeps its original date
    expect(((await api.call('GET', 'routines')) as any[]).length).toBe(1);
    expect(((await api.call('GET', 'meal-plans')) as any[])[0].status).toBe('active');
    expect(((await api.call('GET', 'goals')) as any[]).length).toBe(2);
    expect(((await api.call('GET', 'monthly-reviews')) as any[]).length).toBe(1);
    const overview: any = await api.call('GET', 'overview');
    expect(overview.hydration.totalMl).toBe(830);
    expect(overview.fasting.schedule.label).toBe('16:8');
  });

  it('is created once and then read back from storage', async () => {
    const { api, storage } = await fresh();
    await api.call('PATCH', 'preferences', { equipment: ['Kettlebell'] });
    api.database.flush();
    const again = createLocalApi({ storage, timezone: TZ });
    await again.ready;
    expect(((await again.call('GET', 'profile')) as any).equipment).toEqual(['Kettlebell']);
    expect(((await again.call('GET', 'routines')) as any[]).length).toBe(1); // not seeded twice
  });

  it('replaces missing, corrupt or outdated storage with fresh demo data', async () => {
    for (const bad of ['not json', '{"version":999,"tables":{}}', '{"version":1}', '{"version":1,"tables":{"profiles":"x"}}', 'null']) {
      const api = createLocalApi({ storage: memoryStorage(bad), timezone: TZ });
      await api.ready;
      expect(((await api.call('GET', 'routines')) as any[]).length).toBe(1);
    }
  });

  it('resets to the original demo data', async () => {
    const { api } = await fresh();
    await api.call('POST', 'goals', { title: 'Temporary', priority: 'low', isMeasurable: false, idempotencyKey: key() });
    expect(((await api.call('GET', 'goals')) as any[]).length).toBe(3);
    await api.reset();
    expect(((await api.call('GET', 'goals')) as any[]).length).toBe(2);
  });
});

describe('core flows', () => {
  it('keeps AI routine suggestions as drafts until approved, then schedules them', async () => {
    const { api } = await fresh();
    const today = todayIn(TZ);
    const before = ((await api.call('GET', 'routines')) as any[]).length;
    const proposal: any = await api.call('POST', 'routine-proposals', { request: 'Two short strength sessions a week' });
    expect(proposal.status).toBe('draft');
    expect(((await api.call('GET', 'routines')) as any[]).length).toBe(before); // nothing saved yet
    const res: any = await api.call('POST', `routine-proposals/${proposal.id}/approve`, {
      version: proposal.version, schedule: { startDate: today, weeks: 2 }, acceptConflicts: true, idempotencyKey: key(),
    });
    expect(res.sessionsCreated).toBeGreaterThan(0);
    expect(((await api.call('GET', 'routines')) as any[]).length).toBe(before + 1);
  });

  it('creates a manual routine, and records a move as history', async () => {
    const { api } = await fresh();
    const today = todayIn(TZ);
    const plan = { title: 'Push day', goalIds: [], assumptions: [], warnings: [], sessions: [{ title: 'Push', activityType: 'strength', dayOfWeek: 2, startTime: '18:00', durationMinutes: 45, exercises: [{ name: 'Push-up', targetSets: 3, repsMin: 8, repsMax: 12 }] }] };
    const routine: any = await api.call('POST', 'routines', { plan, activate: true, schedule: { startDate: today, weeks: 2 }, acceptConflicts: true, idempotencyKey: key() });
    expect(routine.routine?.title ?? routine.title).toBe('Push day');
    const sessions: any[] = await api.call('GET', `workout-sessions?from=${today}&to=${addDays(today, 20)}`);
    const push = sessions.find((s) => s.title === 'Push');
    expect(push).toBeTruthy();
    const moved: any = await api.call('PATCH', `workout-sessions/${push.id}/reschedule`, { newDate: addDays(push.plannedDate, 1), newTime: '07:00', reason: 'Travel', acceptConflicts: true, idempotencyKey: key() });
    expect(moved).toBeTruthy();
    const detail: any = await api.call('GET', `workout-sessions/${push.id}`);
    expect(detail.originalPlannedDate).toBe(push.plannedDate);
    expect(detail.plannedDate).toBe(addDays(push.plannedDate, 1));
    expect(detail.scheduleChanges).toHaveLength(1);
  });

  it('replaces a clashing routine: stops it, cancels its upcoming sessions, keeps history', async () => {
    const { api } = await fresh(false);
    const today = todayIn(TZ);
    const plan = (title: string) => ({ title, goalIds: [], assumptions: [], warnings: [], sessions: [{ title, activityType: 'strength', dayOfWeek: new Date(today + 'T12:00:00Z').getUTCDay(), exercises: [{ name: 'Squat', targetSets: 3 }] }] });
    const make = (title: string, acceptConflicts = false) => api.call<any>('POST', 'routines', { plan: plan(title), activate: true, schedule: { startDate: today, weeks: 2 }, acceptConflicts, idempotencyKey: key() });
    const first = await make('Old');
    await expect(make('New')).rejects.toMatchObject({ status: 409, code: 'schedule_conflict' });
    const res: any = await api.call('POST', `routines/${first.routine.id}/deactivate`, {});
    expect(res.sessionsRetired).toBeGreaterThan(0);
    expect(res.routine.status).toBe('draft');
    const second = await make('New');
    expect(second.sessionsCreated).toBeGreaterThan(0);
    const list: any[] = await api.call('GET', `workout-sessions?from=${today}&to=${addDays(today, 14)}`);
    expect(list.filter((x) => x.status === 'scheduled').every((x) => x.title === 'New')).toBe(true);
  });

  it('activating a draft routine schedules its sessions', async () => {
    const { api } = await fresh(false);
    const today = todayIn(TZ);
    const plan = { title: 'R', goalIds: [], assumptions: [], warnings: [], sessions: [{ title: 'S', activityType: 'strength', dayOfWeek: new Date(today + 'T12:00:00Z').getUTCDay(), exercises: [{ name: 'Squat', targetSets: 3 }] }] };
    const made: any = await api.call('POST', 'routines', { plan, activate: false, idempotencyKey: key() });
    const res: any = await api.call('POST', `routines/${made.routine.id}/versions`, { plan, rescheduleFuture: false, activate: true, schedule: { startDate: today, weeks: 4 }, acceptConflicts: false, idempotencyKey: key() });
    expect(res.routine.status).toBe('active');
    expect(res.sessionsCreated).toBeGreaterThan(0);
  });

  it('adds a training day to an existing active routine and schedules it', async () => {
    const { api } = await fresh(false);
    const today = todayIn(TZ);
    const dow = new Date(today + 'T12:00:00Z').getUTCDay();
    const day = (title: string, d: number) => ({ title, activityType: 'strength', dayOfWeek: d, exercises: [{ name: 'Squat', targetSets: 3 }] });
    const base = { title: 'R', goalIds: [], assumptions: [], warnings: [] };
    const made: any = await api.call('POST', 'routines', { plan: { ...base, sessions: [day('Lower', dow)] }, activate: true, schedule: { startDate: today, weeks: 2 }, idempotencyKey: key() });
    const other = (dow + 2) % 7;
    const res: any = await api.call('POST', `routines/${made.routine.id}/versions`, {
      plan: { ...base, sessions: [day('Lower', dow), day('Upper', other)] },
      rescheduleFuture: true,
      activate: false,
      schedule: { startDate: today, weeks: 2 },
      acceptConflicts: true,
      idempotencyKey: key(),
    });
    expect(res.sessionsCreated).toBeGreaterThan(2);
    const list: any[] = await api.call('GET', `workout-sessions?from=${today}&to=${addDays(today, 14)}`);
    const titles = new Set(list.filter((x) => x.status === 'scheduled').map((x) => x.title));
    expect(titles).toEqual(new Set(['Lower', 'Upper']));
  });

  it('plans meals only after approval and updates the shopping list', async () => {
    const { api } = await fresh();
    const today = todayIn(TZ);
    const start = addDays(today, 10);
    const proposal: any = await api.call('POST', 'meal-plan-proposals', { request: 'Weekly plan', startDate: start, days: 3 });
    expect(((await api.call('GET', 'meal-plans')) as any[]).every((p) => p.startDate !== start)).toBe(true);
    const done: any = await api.call('POST', `meal-plan-proposals/${proposal.id}/approve`, { version: proposal.version, idempotencyKey: key() });
    const plan: any = await api.call('GET', `meal-plans/${done.id}`);
    expect(plan.entries.length).toBeGreaterThan(0);
    const item = plan.shoppingList[0];
    const checked: any = await api.call('PATCH', `shopping-items/${item.id}`, { checked: true });
    expect(checked.checked).toBe(true);
  });

  it('tracks water, fasting and activity history', async () => {
    const { api } = await fresh();
    const today = todayIn(TZ);
    await api.call('POST', 'hydration/entries', { quantity: 250, unit: 'ml', idempotencyKey: key() });
    expect(((await api.call('GET', 'hydration')) as any).totalMl).toBe(1080);
    const started: any = await api.call('POST', 'fasting/start', { plannedHours: 16, idempotencyKey: key() });
    expect(started.activeFast).toBeTruthy();
    const later = new Date(Date.now() + 60_000).toISOString();
    expect(((await api.call('POST', 'fasting/end', { endedAt: later })) as any).activeFast).toBeNull();
    await api.call('POST', 'activities', { activityType: 'running', title: 'Park run', activityDate: addDays(today, -1), durationSeconds: 1500, confirmSeparate: true, idempotencyKey: key() });
    const history: any = await api.call('GET', `history?from=${addDays(today, -40)}&to=${today}`);
    expect(JSON.stringify(history)).toContain('Park run');
  });

  it('answers the companion with a draft, never a saved change', async () => {
    const { api } = await fresh();
    const goals = ((await api.call('GET', 'goals')) as any[]).length;
    const turn: any = await api.call('POST', 'ai/turn', { message: 'I want to build strength', clientMessageId: key() });
    expect(turn.goalProposal.status).toBe('draft');
    expect(((await api.call('GET', 'goals')) as any[]).length).toBe(goals);
    const ok: any = await api.call('POST', `goal-proposals/${turn.goalProposal.id}/approve`, { version: 1, goals: turn.goalProposal.goals.slice(0, 1), idempotencyKey: key() });
    expect(ok).toBeTruthy();
    expect(((await api.call('GET', 'goals')) as any[]).length).toBe(goals + 1);
  });

  it('opens an empty workspace for a new person: nothing is fabricated', async () => {
    const { api } = await fresh(false);
    const today = todayIn(TZ);
    expect(((await api.call('GET', 'goals')) as any[]).length).toBe(0);
    expect(((await api.call('GET', 'routines')) as any[]).length).toBe(0);
    expect(((await api.call('GET', 'meal-plans')) as any[]).length).toBe(0);
    expect(((await api.call('GET', `workout-sessions?from=${addDays(today, -30)}&to=${addDays(today, 30)}`)) as any[]).length).toBe(0);
    const overview: any = await api.call('GET', 'overview');
    expect(overview).toMatchObject({ hasActiveRoutine: false, mealPlanId: null, hydration: null, fasting: null });
    expect(overview.meals).toEqual([]);
    expect(overview.sessions).toEqual([]);
  });

  it('erases every past conversation on a new chat', async () => {
    const { api } = await fresh();
    const first: any = await api.call('POST', 'ai/turn', { message: 'Plan my training week', clientMessageId: key() });
    await api.call('POST', 'ai/turn', { conversationId: first.conversation.id, message: 'Three days', clientMessageId: key() });
    expect(((await api.call('GET', 'ai/conversations')) as any[]).length).toBeGreaterThan(0);
    const res: any = await api.call('DELETE', 'ai/conversations');
    expect(res.cleared).toBeGreaterThan(0);
    expect((await api.call('GET', 'ai/conversations')) as any[]).toEqual([]);
    await expect(api.call('GET', `ai/conversations/${first.conversation.id}`)).rejects.toMatchObject({ status: 404 });
    // The next message starts a fresh conversation.
    const next: any = await api.call('POST', 'ai/turn', { message: 'Hello again', clientMessageId: key() });
    expect(next.conversation.id).not.toBe(first.conversation.id);
    expect(next.conversation.messages.length).toBe(2);
  });

  it('interviews one question at a time before offering a draft, and answers general questions', async () => {
    const { api } = await fresh(false);
    const say = (message: string, conversationId?: string) => api.call<any>('POST', 'ai/turn', { conversationId, message, clientMessageId: key() });
    const last = (t: any) => t.conversation.messages.at(-1);
    const t1 = await say('Help me create a workout routine');
    expect(last(t1).content).toMatch(/days a week/);
    expect(last(t1).metadata.suggestedNextStep).toBe('none');
    const t2 = await say('Three days, 45 minutes', t1.conversation.id);
    expect(last(t2).content).toMatch(/equipment/);
    const t3 = await say('Dumbbells', t2.conversation.id);
    expect(last(t3).metadata.suggestedNextStep).toBe('create_routine');
    const q = await say('How much protein should I eat?');
    expect(last(q).content).toMatch(/protein/i);
    expect(last(q).metadata.suggestedNextStep).toBe('none');
  });

  it('rejects invalid input with a validation error', async () => {
    const { api } = await fresh();
    await expect(api.call('POST', 'hydration/entries', { quantity: -5, unit: 'ml', idempotencyKey: key() })).rejects.toMatchObject({ status: 400 });
    await expect(api.call('GET', 'nope')).rejects.toMatchObject({ status: 404 });
  });
});

describe('live AI through the server endpoint', () => {
  const schema = z.object({ reply: z.string() });
  const call = (ai: ReturnType<typeof createRemoteAi>) => ai.structured({ name: 't', schema, messages: [{ role: 'user', content: 'hi' }] });

  it('parses and validates the model reply', async () => {
    const ok = createRemoteAi({ url: '/api/ai', fetch: (async () => new Response(JSON.stringify({ text: 'Sure:\n{"reply":"hello"}' }), { status: 200 })) as typeof fetch });
    expect(await call(ok)).toEqual({ reply: 'hello' });
  });

  it('rejects a reply that does not match the schema', async () => {
    const bad = createRemoteAi({ url: '/api/ai', fetch: (async () => new Response(JSON.stringify({ text: '{"nope":1}' }), { status: 200 })) as typeof fetch });
    await expect(call(bad)).rejects.toMatchObject({ reason: 'invalid_output' });
  });

  it('falls back to the demo assistant when the endpoint is not configured', async () => {
    const off = createRemoteAi({ url: '/api/ai', fetch: (async () => new Response('{}', { status: 503 })) as typeof fetch });
    const seen: unknown[] = [];
    const ai = withFallback(off, createDemoAi(), (e) => seen.push(e));
    const { api } = { api: createLocalApi({ storage: memoryStorage(), timezone: 'Africa/Lagos', sample: false, ai }) };
    await api.ready;
    const turn: any = await api.call('POST', 'ai/turn', { message: 'How much protein should I eat?', clientMessageId: 'live-ai-fallback-1' });
    expect(turn.conversation.messages.length).toBe(2);
    expect(seen.length).toBeGreaterThan(0);
  });
});
