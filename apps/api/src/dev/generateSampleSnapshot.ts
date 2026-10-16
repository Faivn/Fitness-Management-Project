/**
 * DEVELOPMENT TOOL — generates the read-only SAMPLE snapshot the web app shows
 * when no backend is configured (apps/mobile/src/sample/snapshot.json).
 *
 * It replays real API calls (real handler, real migrations, RLS and database
 * functions on an embedded Postgres, canned sample AI) to build a few weeks of
 * clearly labelled sample activity, then records the API's GET responses.
 * Nothing here is deployed or used at runtime by the API.
 *
 * Run: npm run sample:generate
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addDays, dayOfWeek, todayIn, zonedToUtc } from '@mova/shared';
import { handleRequest, type AppDeps } from '../app.js';
import type { Env } from '../config/env.js';
import { createTestDatabase, PgTestClient } from './pgliteSupabase.js';
import { createSampleAi } from './sampleAi.js';

const USER = '00000000-0000-4000-8000-0000005a3e1e';
const TIMEZONE = 'Africa/Lagos';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../../mobile/src/sample/snapshot.json');

const env: Env = {
  SUPABASE_URL: 'http://sample.invalid',
  SUPABASE_PUBLISHABLE_KEY: 'sample-generator-not-a-key',
  OPENAI_API_KEY: undefined,
  OPENAI_MODEL: 'sample',
  OPENAI_TIMEOUT_MS: 1000,
  OPENAI_SUPPORTS_TEMPERATURE: false,
  APP_ORIGIN: '',
  API_ENV: 'development',
};

const { db, columns } = await createTestDatabase();
await db.exec(`insert into auth.users (id, email) values ('${USER}', 'sample@mova.invalid');`);
await db.query(`update public.profiles set timezone = $1 where id = $2`, [TIMEZONE, USER]);

let now = new Date();
const deps: AppDeps = {
  env,
  verifyToken: async () => ({ id: USER, email: null }),
  userClient: () => new PgTestClient(db, columns, USER).asSupabase(),
  ai: () => createSampleAi(),
  now: () => now,
  log: () => {},
};

async function call(method: string, path: string, body?: unknown): Promise<any> {
  const res = await handleRequest(
    new Request(`http://sample.local/api/v1/${path}`, {
      method,
      headers: { authorization: 'Bearer sample', 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    deps,
  );
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json)}`);
  return json;
}

let n = 0;
const key = () => `sample-${++n}-xxxxxxxx`;
const at = (date: string, time: string) => (now = zonedToUtc(date, time, TIMEZONE));

const today = todayIn(TIMEZONE);
const monday = addDays(today, -((dayOfWeek(today) + 6) % 7) - 14); // Monday two weeks ago

// --- Seed (all of it is sample data) --------------------------------------
at(monday, '06:00');
await call('POST', 'profile/onboarding', { timezone: TIMEZONE });
await call('POST', 'goals', { title: 'Sample goal: train three times a week', priority: 'high', isMeasurable: false, idempotencyKey: key() });
await call('POST', 'ai/turn', { message: 'I want to train four times a week and improve my running', clientMessageId: key() });

const proposal = await call('POST', 'routine-proposals', { request: 'Upper/lower split plus an easy run, three days a week' });
await call('POST', `routine-proposals/${proposal.id}/approve`, { version: proposal.version, schedule: { startDate: monday, weeks: 4 }, acceptConflicts: true, idempotencyKey: key() });
const sessions: any[] = await call('GET', `workout-sessions?from=${monday}&to=${addDays(monday, 27)}`);
const on = (d: string) => sessions.find((s) => s.plannedDate === d);

async function strength(id: string, date: string, sets: Array<[string, number, number, number]>) {
  at(date, '07:00');
  await call('POST', `workout-sessions/${id}/start`, {});
  await call('POST', `workout-sessions/${id}/logs`, {
    logs: sets.map(([exerciseName, setNumber, actualReps, actualWeight]) => ({ clientId: key(), exerciseName, setNumber, actualReps, actualWeight, weightUnit: 'kg' })),
  });
  at(date, '08:00');
  await call('POST', `workout-sessions/${id}/finish`, { outcome: 'completed', idempotencyKey: key() });
}

// Week 1: upper done, run done, lower missed.
await strength(on(monday).id, monday, [
  ['Bench press', 1, 10, 50], ['Bench press', 2, 9, 50], ['Bench press', 3, 8, 50],
  ['Seated row', 1, 12, 40], ['Seated row', 2, 11, 40], ['Overhead press', 1, 10, 25],
]);
at(addDays(monday, 2), '18:40');
await call('POST', `workout-sessions/${on(addDays(monday, 2)).id}/finish`, { outcome: 'completed', durationSeconds: 1860, distanceValue: 5.2, distanceUnit: 'km', idempotencyKey: key() });
at(addDays(monday, 5), '09:00');
await call('POST', `workout-sessions/${on(addDays(monday, 4)).id}/missed`, { reason: 'Long day at work', idempotencyKey: key() });

// Week 2: upper moved Mon → Tue and completed heavier; spontaneous walk; run completed.
const upper2 = on(addDays(monday, 7)).id;
at(addDays(monday, 7), '05:30');
await call('PATCH', `workout-sessions/${upper2}/reschedule`, { newDate: addDays(monday, 8), newTime: '07:00', reason: 'Early meeting', acceptConflicts: true, idempotencyKey: key() });
await strength(upper2, addDays(monday, 8), [
  ['Bench press', 1, 8, 55], ['Bench press', 2, 8, 55], ['Bench press', 3, 7, 55],
  ['Seated row', 1, 12, 42.5], ['Seated row', 2, 12, 42.5],
]);
at(addDays(monday, 9), '19:00');
await call('POST', `workout-sessions/${on(addDays(monday, 9)).id}/finish`, { outcome: 'completed', durationSeconds: 1740, distanceValue: 5, distanceUnit: 'km', idempotencyKey: key() });
at(addDays(monday, 10), '20:30');
await call('POST', 'activities', { activityType: 'walking', title: 'Evening walk', activityDate: addDays(monday, 10), durationSeconds: 2400, confirmSeparate: true, idempotencyKey: key() });

// This week: Monday's upper session completed if it has already passed.
if (addDays(monday, 14) < today) {
  await strength(on(addDays(monday, 14)).id, addDays(monday, 14), [['Bench press', 1, 8, 57.5], ['Bench press', 2, 7, 57.5], ['Seated row', 1, 12, 45]]);
}

// A second routine proposal left as a draft so the review screen can be explored.
at(today, '08:00');
await call('POST', 'routine-proposals', { request: 'Add a short mobility session on Sundays', mode: 'new' });

// Meal plan for this week and modules.
const meal = await call('POST', 'meal-plan-proposals', { request: 'Nigerian food, cutting phase, four meals a day', startDate: today, days: 7 });
await call('POST', `meal-plan-proposals/${meal.id}/approve`, { version: meal.version, idempotencyKey: key() });
await call('PATCH', 'preferences', { hydrationEnabled: true, fastingEnabled: true, equipment: ['Barbell', 'Dumbbells', 'Cable row'] });
await call('PUT', 'hydration/target', { dailyTarget: 2.5, unit: 'l' });
at(today, '08:30');
await call('POST', 'hydration/entries', { quantity: 500, unit: 'ml', idempotencyKey: key() });
at(today, '11:00');
await call('POST', 'hydration/entries', { quantity: 330, unit: 'ml', idempotencyKey: key() });
await call('PUT', 'fasting/schedule', { label: '16:8', fastStartTime: '20:00', fastHours: 16 });
at(addDays(today, -1), '20:00');
await call('POST', 'fasting/start', { plannedHours: 16, idempotencyKey: key() });
at(today, '11:30');
await call('POST', 'fasting/end', {});

// A saved monthly review for the previous month.
const [y, m] = today.split('-').map(Number) as [number, number];
const prevStart = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
const prevEnd = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
const draft = await call('POST', 'monthly-reviews/generate', { periodStart: prevStart, periodEnd: prevEnd });
await call('POST', 'monthly-reviews', { draftId: draft.draftId, summaryText: draft.narrative, idempotencyKey: key() });
now = new Date();

// --- Record responses ------------------------------------------------------
const responses: Record<string, unknown> = {};
async function record(path: string) {
  responses[path] = await call('GET', path);
  return responses[path] as any;
}

const from = addDays(today, -90);
const to = addDays(today, 60);
const allSessions: any[] = await call('GET', `workout-sessions?from=${from}&to=${to}`);
const schedule = await call('GET', `schedule?from=${from}&to=${to}`);
const details: Record<string, unknown> = {};
for (const s of allSessions) details[s.id] = await record(`workout-sessions/${s.id}`);

for (const p of ['profile', 'preferences', 'overview', 'goals', 'routines', 'routine-proposals', 'meal-plans', 'exercises', 'personal-records', 'monthly-reviews', 'hydration', 'fasting', 'reminders']) {
  await record(p);
}
for (const r of responses.routines as any[]) await record(`routines/${r.id}`);
for (const p of responses['routine-proposals'] as any[]) await record(`routine-proposals/${p.id}`);
for (const p of responses['meal-plans'] as any[]) await record(`meal-plans/${p.id}`);
for (const r of responses['monthly-reviews'] as any[]) await record(`monthly-reviews/${r.id}`);
for (const e of responses.exercises as any[]) await record(`exercises/history?name=${encodeURIComponent(e.exerciseName)}`);
const conversations: any[] = await record('ai/conversations');
for (const c of conversations) {
  const conv = await record(`ai/conversations/${c.id}`);
  for (const msg of conv.messages) {
    const meta = msg.metadata ?? {};
    if (meta.goalProposalId) await record(`goal-proposals/${meta.goalProposalId}`);
    if (meta.routineProposalId) await record(`routine-proposals/${meta.routineProposalId}`);
    if (meta.mealPlanProposalId) await record(`meal-plan-proposals/${meta.mealPlanProposalId}`);
  }
}

const snapshot = {
  notice: 'SAMPLE DATA — generated by apps/api/src/dev/generateSampleSnapshot.ts. Not a real person or account.',
  generatedAt: new Date().toISOString(),
  today,
  timezone: TIMEZONE,
  sessions: allSessions,
  meals: schedule.meals,
  responses,
};
writeFileSync(OUT, `${JSON.stringify(snapshot, null, 1)}\n`);
console.log(`Wrote ${OUT}: ${allSessions.length} sessions, ${Object.keys(responses).length} recorded responses, today ${today}.`);
await db.close();
