import { addDays, dayOfWeek, todayIn, zonedToUtc } from '@mova/shared';

/**
 * Realistic starting data for the demo, relative to today so the app looks
 * lived-in on any day: a routine that has run for two weeks (completed,
 * moved and missed sessions), a walk, this week's meal plan, water, fasting
 * and a saved monthly review. It is built by calling the same use cases the
 * app calls, with a clock moved back in time, so every rule is honoured.
 */
export type SeedCall = (method: string, path: string, body?: unknown) => Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function seedDemoData(call: SeedCall, setNow: (d: Date) => void, timezone: string, realNow: Date): Promise<void> {
  let n = 0;
  const key = () => `seed-${++n}-xxxxxxxx`;
  const at = (date: string, time: string) => setNow(zonedToUtc(date, time, timezone));

  const today = todayIn(timezone, realNow);
  const monday = addDays(today, -((dayOfWeek(today) + 6) % 7) - 14); // Monday two weeks ago

  at(monday, '06:00');
  await call('POST', 'goals', { title: 'Train three times a week', priority: 'high', isMeasurable: false, idempotencyKey: key() });
  await call('POST', 'goals', { title: 'Run 5 km without stopping', priority: 'medium', isMeasurable: true, targetValue: 5, targetUnit: 'km', idempotencyKey: key() });
  await call('POST', 'ai/turn', { message: 'I want to train three times a week and build up my running', clientMessageId: key() });

  const proposal = await call('POST', 'routine-proposals', { request: 'Upper/lower split plus an easy run, three days a week' });
  await call('POST', `routine-proposals/${proposal.id}/approve`, { version: proposal.version, schedule: { startDate: monday, weeks: 4 }, acceptConflicts: true, idempotencyKey: key() });
  const sessions: any[] = await call('GET', `workout-sessions?from=${monday}&to=${addDays(monday, 27)}`); // eslint-disable-line @typescript-eslint/no-explicit-any
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

  // Week 2: upper moved Mon → Tue and completed heavier; a spontaneous walk; run done.
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

  // This week: Monday's session done if it has passed.
  if (addDays(monday, 14) < today) {
    await strength(on(addDays(monday, 14)).id, addDays(monday, 14), [['Bench press', 1, 8, 57.5], ['Bench press', 2, 7, 57.5], ['Seated row', 1, 12, 45]]);
  }

  // Meal plan for this week, plus water and fasting.
  at(today, '08:00');
  const meal = await call('POST', 'meal-plan-proposals', { request: 'Nigerian food, four meals a day', startDate: today, days: 7 });
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

  // A saved review of the previous month.
  const [y, m] = today.split('-').map(Number) as [number, number];
  const prevStart = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
  const prevEnd = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
  const draft = await call('POST', 'monthly-reviews/generate', { periodStart: prevStart, periodEnd: prevEnd });
  await call('POST', 'monthly-reviews', { draftId: draft.draftId, summaryText: draft.narrative, idempotencyKey: key() });
  setNow(realNow);
}
