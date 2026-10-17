import { describe, expect, it } from 'vitest';
import {
  addDays,
  completeMealPlan,
  missingMealCells,
  calculatePersonalRecords,
  canReschedule,
  canTransition,
  consolidateShoppingList,
  dayOfWeek,
  describeSummary,
  detectConflicts,
  fastingStatus,
  generateOccurrences,
  groupMealsByWeekday,
  hydrationTotalMl,
  localDateOf,
  summarisePeriod,
  zonedToUtc,
  type MealEntry,
  type RoutinePlan,
  type SessionForSummary,
  type SetLogForRecords,
} from '../src/index.js';

describe('session lifecycle', () => {
  it('never completes a cancelled or completed session again', () => {
    expect(canTransition('completed', 'scheduled')).toBe(false);
    expect(canTransition('cancelled', 'completed')).toBe(false);
  });
  it('lets a missed session return to scheduled only via explicit reschedule', () => {
    expect(canTransition('missed', 'scheduled')).toBe(true);
    expect(canReschedule('missed')).toBe(true);
    expect(canReschedule('completed')).toBe(false);
    expect(canReschedule('in_progress')).toBe(false);
  });
  it('does not allow an in-progress session to be marked missed', () => {
    expect(canTransition('in_progress', 'missed')).toBe(false);
  });
});

describe('dates and timezones', () => {
  it('converts local wall time to UTC across DST', () => {
    // London is UTC+1 in July, UTC+0 in January.
    expect(zonedToUtc('2026-07-01', '07:00', 'Europe/London').toISOString()).toBe('2026-07-01T06:00:00.000Z');
    expect(zonedToUtc('2026-01-15', '07:00', 'Europe/London').toISOString()).toBe('2026-01-15T07:00:00.000Z');
    // Lagos is UTC+1 all year.
    expect(zonedToUtc('2026-03-10', '18:30', 'Africa/Lagos').toISOString()).toBe('2026-03-10T17:30:00.000Z');
  });
  it('computes the local date in the user timezone', () => {
    const instant = new Date('2026-10-15T23:30:00Z');
    expect(localDateOf(instant, 'Africa/Lagos')).toBe('2026-10-16');
    expect(localDateOf(instant, 'America/New_York')).toBe('2026-10-15');
  });
  it('does calendar arithmetic without timezone drift', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(dayOfWeek('2026-10-16')).toBe(5); // Friday
  });
});

const plan: RoutinePlan = {
  title: 'Upper / lower',
  goalIds: [],
  assumptions: [],
  warnings: [],
  sessions: [
    {
      title: 'Upper body',
      activityType: 'strength',
      dayOfWeek: 1,
      startTime: '07:00',
      durationMinutes: 60,
      exercises: [{ name: 'Bench press', targetSets: 3, repsMin: 8, repsMax: 10 }],
    },
    { title: 'Easy run', activityType: 'running', dayOfWeek: 3, exercises: [] },
  ],
};

describe('schedule generation and conflicts', () => {
  it('creates a deterministic, bounded set of occurrences', () => {
    const occ = generateOccurrences(plan, { startDate: '2026-10-12', weeks: 2 });
    expect(occ.map((o) => `${o.plannedDate}:${o.title}`)).toEqual([
      '2026-10-12:Upper body',
      '2026-10-14:Easy run',
      '2026-10-19:Upper body',
      '2026-10-21:Easy run',
    ]);
    expect(generateOccurrences(plan, { startDate: '2026-10-12', weeks: 2 })).toEqual(occ);
  });

  it('flags overlapping and same-day untimed slots', () => {
    const conflicts = detectConflicts(
      [
        { title: 'Upper body', plannedDate: '2026-10-12', plannedTime: '07:00', durationMinutes: 60 },
        { title: 'Easy run', plannedDate: '2026-10-14', plannedTime: null, durationMinutes: null },
      ],
      [
        { id: 'a', title: 'Yoga', plannedDate: '2026-10-12', plannedTime: '07:30', durationMinutes: 30 },
        { id: 'b', title: 'Swim', plannedDate: '2026-10-12', plannedTime: '09:00', durationMinutes: 30 },
        { id: 'c', title: 'Walk', plannedDate: '2026-10-14', plannedTime: '18:00', durationMinutes: 30 },
      ],
    );
    expect(conflicts.map((c) => `${c.kind}:${c.existing.title}`)).toEqual(['overlap:Yoga', 'same_day:Walk']);
  });

  it('ignores a session conflicting with itself when it is moved', () => {
    const c = detectConflicts(
      [{ id: 'x', title: 'Upper', plannedDate: '2026-10-13', plannedTime: '07:00', durationMinutes: 60 }],
      [{ id: 'x', title: 'Upper', plannedDate: '2026-10-13', plannedTime: '07:00', durationMinutes: 60 }],
    );
    expect(c).toHaveLength(0);
  });
});

describe('personal records (pr-v1)', () => {
  const log = (over: Partial<SetLogForRecords>): SetLogForRecords => ({
    id: Math.random().toString(36),
    exerciseId: null,
    exerciseName: 'Bench Press',
    actualReps: 5,
    actualWeight: 60,
    weightUnit: 'kg',
    status: 'completed',
    activityDate: '2026-10-01',
    ...over,
  });

  it('compares across units but reports the logged unit', () => {
    const recs = calculatePersonalRecords([
      log({ actualWeight: 60, weightUnit: 'kg' }),
      log({ actualWeight: 140, weightUnit: 'lb', activityDate: '2026-10-05' }), // 63.5 kg
    ]);
    const heaviest = recs.find((r) => r.type === 'heaviest_weight');
    expect(heaviest).toMatchObject({ value: 140, unit: 'lb', achievedOn: '2026-10-05' });
  });

  it('ignores skipped sets and sets with unknown reps', () => {
    const recs = calculatePersonalRecords([
      log({ actualWeight: 200, status: 'skipped' }),
      log({ actualWeight: 300, actualReps: null }),
      log({ actualWeight: 50 }),
    ]);
    expect(recs.find((r) => r.type === 'heaviest_weight')?.value).toBe(50);
  });

  it('does not merge differently named exercises', () => {
    const recs = calculatePersonalRecords([
      log({ exerciseName: 'Bench press' }),
      log({ exerciseName: 'Incline bench press', actualWeight: 40 }),
    ]);
    expect(new Set(recs.map((r) => r.exerciseKey)).size).toBe(2);
  });

  it('keeps bodyweight sets as rep records only', () => {
    const recs = calculatePersonalRecords([log({ exerciseName: 'Push-up', actualWeight: null, weightUnit: null, actualReps: 25 })]);
    expect(recs.map((r) => r.type)).toEqual(['most_reps']);
  });
});

describe('monthly summary', () => {
  const base: Omit<SessionForSummary, 'id' | 'status' | 'originalPlannedDate' | 'plannedDate' | 'actualDate' | 'actualEndAt'> = {
    title: 'Upper body',
    activityType: 'strength',
    source: 'ai',
    setLogCount: 0,
  };

  const sessions: SessionForSummary[] = [
    { ...base, id: 's1', status: 'completed', originalPlannedDate: '2026-09-02', plannedDate: '2026-09-02', actualDate: '2026-09-02', actualEndAt: '2026-09-02T08:00:00Z', setLogCount: 9 },
    { ...base, id: 's2', status: 'completed', originalPlannedDate: '2026-09-04', plannedDate: '2026-09-06', actualDate: '2026-09-06', actualEndAt: '2026-09-06T08:00:00Z' },
    { ...base, id: 's3', status: 'missed', originalPlannedDate: '2026-09-09', plannedDate: '2026-09-09', actualDate: null, actualEndAt: null },
    { ...base, id: 's4', status: 'scheduled', originalPlannedDate: '2026-09-11', plannedDate: '2026-09-11', actualDate: null, actualEndAt: null },
    { ...base, id: 's5', status: 'completed', originalPlannedDate: '2026-09-13', plannedDate: '2026-09-13', actualDate: null, actualEndAt: null },
    { ...base, id: 's6', title: 'Evening run', activityType: 'running', source: 'spontaneous', status: 'completed', originalPlannedDate: null, plannedDate: null, actualDate: '2026-09-15', actualEndAt: '2026-09-15T19:00:00Z' },
    { ...base, id: 's7', status: 'scheduled', originalPlannedDate: '2026-09-29', plannedDate: '2026-09-29', actualDate: null, actualEndAt: null },
    { ...base, id: 'out', status: 'completed', originalPlannedDate: '2026-08-20', plannedDate: '2026-08-20', actualDate: '2026-08-20', actualEndAt: '2026-08-20T08:00:00Z' },
  ];

  const summary = summarisePeriod({
    periodStart: '2026-09-01',
    periodEnd: '2026-09-30',
    today: '2026-09-20',
    sessions,
    scheduleChanges: [{ sessionId: 's2', changeType: 'rescheduled', createdAt: '2026-09-03T10:00:00Z' }],
  });

  it('distinguishes every activity status from stored records', () => {
    expect(summary.counts).toMatchObject({
      planned: 6,
      completed: 3,
      completedAsPlanned: 1,
      completedAfterReschedule: 1,
      missed: 1,
      rescheduled: 1,
      spontaneous: 1,
      notRecorded: 2,
      upcoming: 1,
    });
  });

  it('never counts a completed status without evidence as completed', () => {
    expect(summary.items.find((i) => i.sessionId === 's5')?.outcome).toBe('not_recorded');
  });

  it('only includes records in the period and lists their ids', () => {
    expect(summary.sourceRecordIds).not.toContain('out');
    expect(summary.sourceRecordIds).toHaveLength(7);
  });

  it('distinguishes no records from no activity', () => {
    const empty = summarisePeriod({ periodStart: '2026-01-01', periodEnd: '2026-01-31', today: '2026-02-01', sessions: [], scheduleChanges: [] });
    expect(empty.isEmpty).toBe(true);
    expect(describeSummary(empty)).toMatch(/No activity was recorded/);
  });
});

describe('meal planning', () => {
  const entry = (over: Partial<MealEntry>): MealEntry => ({
    date: '2026-10-19',
    slot: 'Lunch',
    sortOrder: 1,
    mealName: 'Jollof rice',
    ingredients: [],
    isSmoothie: false,
    ...over,
  });

  it('consolidates repeated ingredients and keeps unknown quantities unknown', () => {
    const list = consolidateShoppingList([
      entry({ ingredients: [{ name: 'Rice', quantity: 200, unit: 'g' }, { name: 'Tomatoes', quantity: 3 }] }),
      entry({ mealName: 'Fried rice', ingredients: [{ name: 'rice', quantity: 150, unit: 'g' }, { name: 'Tomato' }] }),
    ]);
    expect(list.find((i) => i.name === 'Rice')).toMatchObject({ quantity: 350, unit: 'g', sourceEntryIndexes: [0, 1] });
    expect(list.find((i) => i.name === 'Tomatoes')?.quantity).toBeUndefined();
  });
});

describe('optional modules', () => {
  it('totals hydration across units for one local date', () => {
    expect(
      hydrationTotalMl(
        [
          { quantity: 500, unit: 'ml', localDate: '2026-10-16' },
          { quantity: 0.5, unit: 'l', localDate: '2026-10-16' },
          { quantity: 1, unit: 'l', localDate: '2026-10-15' },
        ],
        '2026-10-16',
      ),
    ).toBe(1000);
  });

  it('derives fasting status from schedule across midnight', () => {
    const schedule = { fastStartTime: '20:00', fastHours: 16 };
    const during = fastingStatus(schedule, null, new Date('2026-10-16T06:00:00Z'), 'Africa/Lagos'); // 07:00 local
    expect(during).toMatchObject({ state: 'fasting', basis: 'schedule' });
    const after = fastingStatus(schedule, null, new Date('2026-10-16T14:00:00Z'), 'Africa/Lagos'); // 15:00 local
    expect(after).toMatchObject({ state: 'not_fasting', nextFastStartsAt: '2026-10-16T19:00:00.000Z' });
  });

  it('prefers a manually started fast', () => {
    const s = fastingStatus(null, { startedAt: '2026-10-16T00:00:00Z', plannedHours: 12 }, new Date('2026-10-16T06:00:00Z'), 'UTC');
    expect(s).toMatchObject({ state: 'fasting', basis: 'manual', fraction: 0.5 });
  });
});

describe('groupMealsByWeekday', () => {
  it('shows a recurring Monday–Sunday week, earliest date wins, ordered by slot', () => {
    // 2026-10-16 is a Friday; 2026-10-19 a Monday; 2026-10-23 the next Friday.
    const e = (date: string, sortOrder: number, name: string) => ({ date, sortOrder, name });
    const out = groupMealsByWeekday([e('2026-10-23', 1, 'later friday'), e('2026-10-16', 2, 'dinner'), e('2026-10-16', 1, 'breakfast'), e('2026-10-19', 1, 'monday')]);
    expect(out.map(([wd]) => wd)).toEqual([0, 4]);
    expect(out[1]![1].map((x) => x.name)).toEqual(['breakfast', 'dinner']);
  });
});

describe('completing a meal plan the model left unfinished', () => {
  const meal = (date: string, slot: string, n: number, name: string) => ({ date, slot, sortOrder: n, mealName: name, ingredients: [], isSmoothie: false });
  // Four days were planned, the model stopped halfway through day 3, and day 4 is missing.
  const plan = {
    startDate: '2026-10-19',
    endDate: '2026-10-22',
    slots: ['Breakfast', 'Lunch'],
    entries: [
      meal('2026-10-19', 'Breakfast', 0, 'Oats'),
      meal('2026-10-19', 'Lunch', 1, 'Salad'),
      meal('2026-10-20', 'Breakfast', 0, 'Eggs'),
      meal('2026-10-20', 'Lunch', 1, 'Soup'),
      meal('2026-10-21', 'Breakfast', 0, 'Toast'),
    ],
  };

  it('reports the empty cells', () => {
    expect(missingMealCells(plan, '2026-10-19', 4)).toEqual([
      { date: '2026-10-21', slot: 'Lunch' },
      { date: '2026-10-22', slot: 'Breakfast' },
      { date: '2026-10-22', slot: 'Lunch' },
    ]);
  });

  it('fills every day and slot from the most recent meal for that slot, keeping what the model wrote', () => {
    const done = completeMealPlan(plan, '2026-10-19', 4);
    expect(missingMealCells(done, '2026-10-19', 4)).toEqual([]);
    expect(done.endDate).toBe('2026-10-22');
    const name = (d: string, s: string) => done.entries.find((e) => e.date === d && e.slot === s)?.mealName;
    expect(name('2026-10-21', 'Breakfast')).toBe('Toast');
    expect(name('2026-10-21', 'Lunch')).toBe('Soup');
    expect(name('2026-10-22', 'Breakfast')).toBe('Toast');
  });
});
