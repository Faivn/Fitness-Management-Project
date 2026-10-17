/**
 * End-to-end API tests (spec §11.3 / §11.4) against the real migrations in an
 * embedded Postgres with RLS, using a scripted AI. No network access.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { AiUnavailableError } from '../src/lib/ai.js';
import { createHarness, key } from './support/harness.js';

type H = Awaited<ReturnType<typeof createHarness>>;
let h: H;

const plan = {
  title: 'Upper / lower + run',
  purpose: 'Build strength and keep running',
  goalIds: [] as string[],
  sessions: [
    {
      title: 'Upper body',
      activityType: 'strength',
      dayOfWeek: 1,
      startTime: '07:00',
      durationMinutes: 60,
      exercises: [
        { name: 'Bench press', targetSets: 3, repsMin: 8, repsMax: 10, targetWeight: 50, weightUnit: 'kg' },
        { name: 'Seated row', targetSets: 3, repsMin: 10, repsMax: 12 },
      ],
    },
    { title: 'Easy run', activityType: 'running', dayOfWeek: 3, durationMinutes: 30, exercises: [] },
    {
      title: 'Lower body',
      activityType: 'strength',
      dayOfWeek: 5,
      startTime: '18:00',
      durationMinutes: 60,
      exercises: [{ name: 'Back squat', targetSets: 3, repsMin: 5, repsMax: 8 }],
    },
  ],
  assumptions: ['Assumed access to a barbell and bench'],
  warnings: [],
};

beforeAll(async () => {
  h = await createHarness({ now: '2026-10-16T08:00:00Z' }); // Friday 09:00 in Lagos
}, 60_000);

describe('security and transport', () => {
  it('serves a public health check without configuration details', async () => {
    const r = await h.call('GET', 'health', undefined, null);
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).not.toMatch(/key|supabase|groq/i);
  });

  it('rejects requests without a valid token', async () => {
    expect((await h.call('GET', 'profile', undefined, null)).status).toBe(401);
  });

  it('returns structured validation errors', async () => {
    const r = await h.call('POST', 'goals', { title: '', idempotencyKey: key() });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('validation_failed');
  });

  it('404s unknown endpoints and 405s wrong methods', async () => {
    expect((await h.call('GET', 'nope')).status).toBe(404);
    expect((await h.call('DELETE', 'profile')).status).toBe(405);
  });
});

describe('WF-01 onboarding', () => {
  it('enters the workspace without a questionnaire and only once', async () => {
    const first = await h.call('POST', 'profile/onboarding', { timezone: 'Africa/Lagos' });
    expect(first.status).toBe(200);
    expect(first.body.onboardingCompletedAt).toBeTruthy();
    const again = await h.call('POST', 'profile/onboarding', { timezone: 'Europe/London' });
    expect(again.body.onboardingCompletedAt).toBe(first.body.onboardingCompletedAt);
  });
});

describe('WF-02 AI conversation and goals', () => {
  it('saves AI goal suggestions only as a proposal until approved', async () => {
    h.ai.enqueue('assistant_turn', {
      reply: 'Great — here is how I understood your goals.',
      proposedGoals: [{ title: 'Train four times a week', priority: 'high' }, { title: 'Run 5 km comfortably', isMeasurable: true, targetValue: 5, targetUnit: 'km' }],
    });
    const turn = await h.call('POST', 'ai/turn', { message: 'I want to train 4x a week and improve my running', clientMessageId: key('msg') });
    expect(turn.status).toBe(200);
    expect(turn.body.goalProposal.status).toBe('draft');
    expect((await h.call('GET', 'goals')).body).toHaveLength(0);

    const approved = await h.call('POST', `goal-proposals/${turn.body.goalProposal.id}/approve`, {
      version: 1,
      goals: [{ title: 'Train four times a week', priority: 'high' }],
      idempotencyKey: key(),
    });
    expect(approved.status).toBe(200);
    const goals = (await h.call('GET', 'goals')).body;
    expect(goals.map((g: any) => g.title)).toEqual(['Train four times a week']);
    expect(goals[0].source).toBe('ai');
  });

  it('keeps the user message when the AI fails', async () => {
    h.ai.enqueue('assistant_turn', new AiUnavailableError('down', 'provider_error'));
    const r = await h.call('POST', 'ai/turn', { message: 'Can you plan my week?', clientMessageId: key('msg') });
    expect(r.status).toBe(503);
    const convs = (await h.call('GET', 'ai/conversations')).body;
    const conv = (await h.call('GET', `ai/conversations/${convs[0].id}`)).body;
    expect(conv.messages.at(-1)).toMatchObject({ role: 'user', content: 'Can you plan my week?' });
  });

  it('does not let one user read another user\'s conversation', async () => {
    const convs = (await h.call('GET', 'ai/conversations')).body;
    expect((await h.call('GET', `ai/conversations/${convs[0].id}`, undefined, 'bob')).status).toBe(404);
  });
});

let routineId: string;
let lowerSessionId: string;

describe('WF-03 AI routine generation and approval', () => {
  let proposalId: string;
  let version: number;

  it('creates a draft that changes nothing active', async () => {
    h.ai.enqueue('routine_proposal', { plan });
    const r = await h.call('POST', 'routine-proposals', { request: 'Upper/lower split plus one easy run' });
    expect(r.status).toBe(201);
    expect(r.body.status).toBe('draft');
    proposalId = r.body.id;
    version = r.body.version;
    expect((await h.call('GET', 'routines')).body).toHaveLength(0);
  });

  it('lets the user edit the draft directly, bumping its version', async () => {
    const edited = { ...plan, sessions: plan.sessions.map((s) => (s.title === 'Easy run' ? { ...s, title: 'Easy 30-min run' } : s)) };
    const r = await h.call('PATCH', `routine-proposals/${proposalId}`, { version, plan: edited });
    expect(r.status).toBe(200);
    expect(r.body.version).toBe(version + 1);
    version = r.body.version;
  });

  it('rejects approval of a stale version', async () => {
    const r = await h.call('POST', `routine-proposals/${proposalId}/approve`, {
      version: version - 1,
      schedule: { startDate: '2026-10-16', weeks: 1 },
      idempotencyKey: key(),
    });
    expect(r.status).toBe(409);
  });

  it('surfaces schedule conflicts before applying', async () => {
    const existing = await h.call('POST', 'workout-sessions', {
      activityType: 'cycling',
      title: 'Evening ride',
      plannedDate: '2026-10-16',
      plannedTime: '18:30',
      durationMinutes: 45,
      idempotencyKey: key(),
    });
    expect(existing.status).toBe(201);
    const r = await h.call('POST', `routine-proposals/${proposalId}/approve`, {
      version,
      schedule: { startDate: '2026-10-16', weeks: 1 },
      idempotencyKey: key(),
    });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('schedule_conflict');
    expect(r.body.error.details.messages[0]).toMatch(/Lower body.*Evening ride/);
  });

  it('applies once with conflicts acknowledged; retries never duplicate', async () => {
    const body = { version, schedule: { startDate: '2026-10-16', weeks: 1 }, acceptConflicts: true, idempotencyKey: key('apply') };
    const r = await h.call('POST', `routine-proposals/${proposalId}/approve`, body);
    expect(r.status).toBe(200);
    expect(r.body.sessionsCreated).toBe(3);
    routineId = r.body.routine.id;
    const retry = await h.call('POST', `routine-proposals/${proposalId}/approve`, body);
    expect(retry.status).toBe(200);
    const sessions = (await h.call('GET', 'workout-sessions?from=2026-10-16&to=2026-10-22')).body;
    expect(sessions.filter((s: any) => s.routineId === routineId)).toHaveLength(3);
  });

  it('shows the applied routine in the overview', async () => {
    const o = (await h.call('GET', 'overview')).body;
    expect(o.localDate).toBe('2026-10-16');
    expect(o.hasActiveRoutine).toBe(true);
    const lower = o.sessions.find((s: any) => s.title === 'Lower body');
    expect(lower.status).toBe('scheduled');
    lowerSessionId = lower.id;
  });
});

describe('WF-04 manual routine', () => {
  it('creates a draft template without scheduling anything', async () => {
    const r = await h.call('POST', 'routines', {
      plan: { title: 'Home mobility', sessions: [{ title: 'Mobility', activityType: 'mobility', dayOfWeek: 0 }] },
      activate: false,
      idempotencyKey: key(),
    });
    expect(r.status).toBe(201);
    expect(r.body.routine.status).toBe('draft');
    expect(r.body.sessionsCreated).toBe(0);
  });
});

describe('WF-06 workout execution and logging', () => {
  it('does not complete a session just because it was opened', async () => {
    const d = (await h.call('GET', `workout-sessions/${lowerSessionId}`)).body;
    expect(d.status).toBe('scheduled');
    expect(d.exercises[0].displayName).toBe('Back squat');
    expect(d.previousPerformance).toEqual({});
  });

  it('logs sets idempotently and records actual completion', async () => {
    h.setNow('2026-10-16T17:05:00Z');
    expect((await h.call('POST', `workout-sessions/${lowerSessionId}/start`, {})).body.status).toBe('in_progress');
    const logs = [
      { clientId: 'set-squat-1', exerciseName: 'Back squat', setNumber: 1, actualReps: 8, actualWeight: 60, weightUnit: 'kg' },
      { clientId: 'set-squat-2', exerciseName: 'Back squat', setNumber: 2, actualReps: 6, actualWeight: 70, weightUnit: 'kg' },
    ];
    await h.call('POST', `workout-sessions/${lowerSessionId}/logs`, { logs });
    await h.call('POST', `workout-sessions/${lowerSessionId}/logs`, { logs }); // retry
    const d = (await h.call('GET', `workout-sessions/${lowerSessionId}`)).body;
    expect(d.setLogs).toHaveLength(2);

    h.setNow('2026-10-16T18:00:00Z');
    const fin = await h.call('POST', `workout-sessions/${lowerSessionId}/finish`, { outcome: 'completed', idempotencyKey: key() });
    expect(fin.body).toMatchObject({ status: 'completed', actualDate: '2026-10-16', actualDurationSeconds: 3300 });
  });

  it('only changes completed logs through an audited correction', async () => {
    const r = await h.call('POST', `workout-sessions/${lowerSessionId}/logs`, {
      logs: [{ clientId: 'set-squat-3', exerciseName: 'Back squat', setNumber: 3, actualReps: 5 }],
    });
    expect(r.status).toBe(422);
    const d = (await h.call('GET', `workout-sessions/${lowerSessionId}`)).body;
    const c = await h.call('PATCH', `workout-logs/${d.setLogs[1].id}`, { actualWeight: 72.5, correctionReason: 'Mis-typed' });
    expect(c.body).toMatchObject({ actualWeight: 72.5 });
    expect(c.body.correctedAt).toBeTruthy();
  });

  it('shows personal records from the logs', async () => {
    const prs = (await h.call('GET', 'personal-records')).body;
    expect(prs.find((p: any) => p.type === 'heaviest_weight')).toMatchObject({ exerciseName: 'Back squat', value: 72.5, unit: 'kg' });
  });
});

describe('WF-07 missed workouts and rescheduling', () => {
  let upperId: string;

  it('reschedules with a reason, keeps the original date, and refuses to move completed sessions', async () => {
    h.setNow('2026-10-17T08:00:00Z');
    const sessions = (await h.call('GET', 'workout-sessions?from=2026-10-16&to=2026-10-22')).body;
    upperId = sessions.find((s: any) => s.title === 'Upper body').id;
    const r = await h.call('PATCH', `workout-sessions/${upperId}/reschedule`, {
      newDate: '2026-10-20',
      newTime: '07:00',
      reason: 'Work trip',
      idempotencyKey: key(),
    });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: 'scheduled', plannedDate: '2026-10-20', originalPlannedDate: '2026-10-19' });
    expect(r.body.scheduleChanges[0]).toMatchObject({ changeType: 'rescheduled', oldDate: '2026-10-19', newDate: '2026-10-20', reason: 'Work trip' });
    expect(r.body.exercises).toHaveLength(2);

    const blocked = await h.call('PATCH', `workout-sessions/${lowerSessionId}/reschedule`, { newDate: '2026-10-25', idempotencyKey: key() });
    expect(blocked.status).toBe(422);
  });

  it('marks a session missed without cancelling it, and logs completion on the actual date later', async () => {
    h.setNow('2026-10-21T20:00:00Z');
    const run = (await h.call('GET', 'workout-sessions?from=2026-10-21&to=2026-10-21')).body.find((s: any) => s.activityType === 'running');
    const missed = await h.call('POST', `workout-sessions/${run.id}/missed`, { idempotencyKey: key() });
    expect(missed.body.status).toBe('missed');

    // Overview the next day still lists the past-due Upper session for attention.
    h.setNow('2026-10-22T08:00:00Z');
    const o = (await h.call('GET', 'overview')).body;
    expect(o.needsAttention.map((s: any) => s.title)).toContain('Upper body');

    const done = await h.call('POST', `workout-sessions/${upperId}/finish`, { outcome: 'completed', idempotencyKey: key() });
    expect(done.body).toMatchObject({ status: 'completed', actualDate: '2026-10-22', plannedDate: '2026-10-20', originalPlannedDate: '2026-10-19' });
  });
});

describe('WF-08 / WF-12 spontaneous and past activity', () => {
  it('asks before duplicating a planned session, then records an unplanned run without inventing a plan', async () => {
    h.setNow('2026-10-23T08:00:00Z');
    const dup = await h.call('POST', 'activities', { activityType: 'cycling', activityDate: '2026-10-16', idempotencyKey: key() });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('possible_duplicate');

    const run = await h.call('POST', 'activities', {
      activityType: 'running',
      title: 'Spontaneous run',
      activityDate: '2026-10-22',
      durationSeconds: 1800,
      idempotencyKey: key(),
    });
    expect(run.status).toBe(201);
    expect(run.body.session).toMatchObject({
      source: 'historical_entry',
      status: 'completed',
      plannedDate: null,
      originalPlannedDate: null,
      actualDistanceValue: null,
    });
  });
});

describe('WF-10 meal planning', () => {
  it('approves an AI meal plan with a consolidated shopping list and no calories', async () => {
    h.ai.enqueue('meal_plan_proposal', {
      plan: {
        title: 'Cutting week',
        goalContext: 'Cutting phase in Nigeria',
        startDate: '2026-10-23',
        endDate: '2026-10-24',
        slots: ['Breakfast', 'Lunch'],
        entries: [
          { date: '2026-10-23', slot: 'Breakfast', sortOrder: 0, mealName: 'Moi moi', ingredients: [{ name: 'Beans', quantity: 200, unit: 'g' }] },
          { date: '2026-10-23', slot: 'Lunch', sortOrder: 1, mealName: 'Beans and plantain', ingredients: [{ name: 'Beans', quantity: 150, unit: 'g' }, { name: 'Plantain', quantity: 2 }] },
          { date: '2026-10-24', slot: 'Breakfast', sortOrder: 0, mealName: 'Banana smoothie', isSmoothie: true, ingredients: [{ name: 'Banana', quantity: 2 }] },
          { date: '2026-10-24', slot: 'Lunch', sortOrder: 1, mealName: 'Jollof rice', ingredients: [{ name: 'Rice', quantity: 1, unit: 'cup' }] },
        ],
        shoppingList: [{ name: 'Beans', category: 'Pantry' }],
      },
    });
    const p = await h.call('POST', 'meal-plan-proposals', { request: 'Cutting, Nigerian food, 2 days', startDate: '2026-10-23', days: 2 });
    expect(p.status).toBe(201);
    const plan = await h.call('POST', `meal-plan-proposals/${p.body.id}/approve`, { version: 1, idempotencyKey: key() });
    expect(plan.status).toBe(200);
    expect(plan.body.shoppingList.find((i: any) => i.name === 'Beans')).toMatchObject({ quantity: 350, unit: 'g', category: 'Pantry' });
    expect(JSON.stringify(plan.body)).not.toMatch(/calor|macro|protein/i);

    const o = (await h.call('GET', 'overview')).body;
    expect(o.meals.map((m: any) => m.mealName)).toEqual(['Moi moi', 'Beans and plantain']);
  });
});

describe('WF-13 / WF-14 optional modules', () => {
  it('keeps hydration history when the module is disabled', async () => {
    await h.call('PATCH', 'preferences', { hydrationEnabled: true });
    await h.call('PUT', 'hydration/target', { dailyTarget: 2, unit: 'l' });
    const k = key();
    await h.call('POST', 'hydration/entries', { quantity: 500, unit: 'ml', idempotencyKey: k });
    const day = (await h.call('POST', 'hydration/entries', { quantity: 500, unit: 'ml', idempotencyKey: k })).body;
    expect(day.totalMl).toBe(500);
    expect((await h.call('GET', 'overview')).body.hydration.totalMl).toBe(500);

    await h.call('PATCH', 'preferences', { hydrationEnabled: false });
    expect((await h.call('GET', 'overview')).body.hydration).toBeNull();
    expect((await h.call('GET', 'hydration')).body.entries).toHaveLength(1);
  });

  it('records fasts separately from the schedule', async () => {
    await h.call('PATCH', 'preferences', { fastingEnabled: true });
    await h.call('PUT', 'fasting/schedule', { fastStartTime: '20:00', fastHours: 16 });
    const started = (await h.call('POST', 'fasting/start', { plannedHours: 16, idempotencyKey: key() })).body;
    expect(started.activeFast).not.toBeNull();
    expect((await h.call('POST', 'fasting/start', { plannedHours: 16, idempotencyKey: key() })).status).toBe(409);
    h.setNow('2026-10-23T20:00:00Z');
    const ended = (await h.call('POST', 'fasting/end', {})).body;
    expect(ended.activeFast).toBeNull();
    expect(ended.recentFasts).toHaveLength(1);
  });
});

describe('WF-15 monthly review', () => {
  it('summarises stored records, falls back without AI, and never duplicates saved reviews', async () => {
    // No scripted AI response → AI unavailable → factual fallback narrative.
    const draft = await h.call('POST', 'monthly-reviews/generate', { periodStart: '2026-10-01', periodEnd: '2026-10-31' });
    expect(draft.status).toBe(200);
    expect(draft.body.aiAvailable).toBe(false);
    expect(draft.body.summary.counts).toMatchObject({ completed: 3, missed: 1, rescheduled: 1, completedAfterReschedule: 1, historicalEntries: 1 });

    const saved = await h.call('POST', 'monthly-reviews', { draftId: draft.body.draftId, summaryText: draft.body.narrative, idempotencyKey: key() });
    expect(saved.status).toBe(201);

    const draft2 = await h.call('POST', 'monthly-reviews/generate', { periodStart: '2026-10-01', periodEnd: '2026-10-31', reflection: 'Busy month' });
    const saved2 = await h.call('POST', 'monthly-reviews', { draftId: draft2.body.draftId, summaryText: 'Edited summary', idempotencyKey: key() });
    expect(saved2.body.version).toBe(2);
    expect((await h.call('GET', 'monthly-reviews')).body).toHaveLength(1);

    // Source logs untouched by summarising.
    const d = (await h.call('GET', `workout-sessions/${lowerSessionId}`)).body;
    expect(d.setLogs).toHaveLength(2);
  });
});

describe('cross-user isolation through the API', () => {
  it('returns 404 for another user\'s session and empty lists', async () => {
    expect((await h.call('GET', `workout-sessions/${lowerSessionId}`, undefined, 'bob')).status).toBe(404);
    expect((await h.call('GET', 'routines', undefined, 'bob')).body).toEqual([]);
    expect((await h.call('POST', `workout-sessions/${lowerSessionId}/start`, {}, 'bob')).status).toBe(404);
  });

  it('keeps history after the routine is replaced', async () => {
    h.ai.enqueue('routine_proposal', { plan: { ...plan, title: 'Phase 2' } });
    h.setNow('2026-10-24T08:00:00Z');
    const p = await h.call('POST', 'routine-proposals', { request: 'Next phase', mode: 'replace', targetRoutineId: routineId });
    const r = await h.call('POST', `routine-proposals/${p.body.id}/approve`, {
      version: 1,
      schedule: { startDate: '2026-10-26', weeks: 1 },
      acceptConflicts: true,
      idempotencyKey: key(),
    });
    expect(r.status).toBe(200);
    expect(r.body.routine.currentVersion).toBe(2);
    const d = (await h.call('GET', `workout-sessions/${lowerSessionId}`)).body;
    expect(d).toMatchObject({ status: 'completed' });
    expect(d.setLogs).toHaveLength(2);
    const versions = (await h.call('GET', `routines/${routineId}`)).body.versions;
    expect(versions.map((v: any) => v.versionNumber)).toEqual([2, 1]);
  });
});
