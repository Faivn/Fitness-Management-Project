import { describe, expect, it } from 'vitest';
import {
  assistantTurnOutputSchema,
  logActivitySchema,
  mealPlanSchema,
  rescheduleSessionSchema,
  routinePlanSchema,
  setLogInputSchema,
} from '../src/index.js';

describe('routine plan schema', () => {
  it('rejects a strength session with no exercises', () => {
    const r = routinePlanSchema.safeParse({
      title: 'Plan',
      sessions: [{ title: 'Push', dayOfWeek: 1, exercises: [] }],
    });
    expect(r.success).toBe(false);
  });

  it('rejects an inverted rep range and a weight without unit', () => {
    const r = routinePlanSchema.safeParse({
      title: 'Plan',
      sessions: [{ title: 'Push', dayOfWeek: 1, exercises: [{ name: 'Bench', targetSets: 3, repsMin: 12, repsMax: 8, targetWeight: 50 }] }],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('sessions.0.exercises.0.repsMax');
      expect(paths).toContain('sessions.0.exercises.0.weightUnit');
    }
  });

  it('allows a running session without exercises', () => {
    const r = routinePlanSchema.safeParse({
      title: 'Plan',
      sessions: [{ title: 'Run', activityType: 'running', dayOfWeek: 2 }],
    });
    expect(r.success).toBe(true);
  });
});

describe('logging schemas keep unknown values unknown', () => {
  it('accepts a set with no weight or reps', () => {
    const r = setLogInputSchema.parse({ clientId: 'abcdefgh-1', exerciseName: 'Squat', setNumber: 1 });
    expect(r.actualReps).toBeUndefined();
    expect(r.actualWeight).toBeUndefined();
  });

  it('accepts a run with no distance', () => {
    const r = logActivitySchema.parse({ activityType: 'running', activityDate: '2026-10-10', idempotencyKey: 'key-12345678' });
    expect(r.distanceValue).toBeUndefined();
  });

  it('rejects impossible dates', () => {
    expect(rescheduleSessionSchema.safeParse({ newDate: '2026-02-30', idempotencyKey: 'key-12345678' }).success).toBe(false);
  });
});

describe('meal plan schema', () => {
  it('has no calorie or macro fields and strips them', () => {
    const parsed = mealPlanSchema.parse({
      title: 'Week',
      startDate: '2026-10-19',
      endDate: '2026-10-25',
      slots: ['Breakfast'],
      entries: [{ date: '2026-10-19', slot: 'Breakfast', sortOrder: 0, mealName: 'Oats', calories: 400 }],
    });
    expect('calories' in (parsed.entries[0] as object)).toBe(false);
  });

  it('rejects meals outside the plan dates', () => {
    const r = mealPlanSchema.safeParse({
      title: 'Week',
      startDate: '2026-10-19',
      endDate: '2026-10-20',
      slots: ['Lunch'],
      entries: [{ date: '2026-10-25', slot: 'Lunch', sortOrder: 0, mealName: 'Soup' }],
    });
    expect(r.success).toBe(false);
  });
});

describe('AI output schema', () => {
  it('rejects malformed model output safely', () => {
    expect(assistantTurnOutputSchema.safeParse({ reply: '' }).success).toBe(false);
    expect(assistantTurnOutputSchema.safeParse({ text: 'hello' }).success).toBe(false);
  });
});
