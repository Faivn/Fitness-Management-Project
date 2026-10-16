/**
 * DEVELOPMENT TOOL ONLY (used by generateSampleSnapshot.ts and never by the
 * deployed API). A deterministic stand-in for the AI provider so sample data can be
 * generated without an API key. Every response is clearly labelled as a
 * sample, and still goes through the same Zod validation and approval flow
 * as real model output.
 */
import { addDays, type MealEntry } from '@mova/shared';
import type { ZodType } from 'zod';
import { AiUnavailableError, type AiClient, type ChatMessage } from '../lib/ai.js';

const LABEL = '[Sample AI reply — no AI service connected in this preview]';

function lastUser(messages: ChatMessage[]): string {
  return [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
}

function routinePlan() {
  return {
    title: 'Sample routine: upper / lower + easy run',
    purpose: 'Sample template — not personalised. Review and edit before approving.',
    goalIds: [],
    sessions: [
      {
        title: 'Upper body',
        focus: 'Chest, back, shoulders',
        activityType: 'strength',
        dayOfWeek: 1,
        startTime: '07:00',
        durationMinutes: 60,
        exercises: [
          { name: 'Bench press', targetSets: 3, repsMin: 8, repsMax: 10, restSeconds: 120 },
          { name: 'Seated row', targetSets: 3, repsMin: 10, repsMax: 12, restSeconds: 90 },
          { name: 'Overhead press', targetSets: 3, repsMin: 8, repsMax: 10, restSeconds: 90 },
        ],
      },
      { title: 'Easy run', focus: 'Conversational pace', activityType: 'running', dayOfWeek: 3, startTime: '18:00', durationMinutes: 30, exercises: [] },
      {
        title: 'Lower body',
        focus: 'Legs and core',
        activityType: 'strength',
        dayOfWeek: 5,
        startTime: '17:30',
        durationMinutes: 60,
        exercises: [
          { name: 'Back squat', targetSets: 3, repsMin: 5, repsMax: 8, restSeconds: 150 },
          { name: 'Romanian deadlift', targetSets: 3, repsMin: 8, repsMax: 10, restSeconds: 120 },
          { name: 'Plank', targetSets: 3, repsMin: 1, repsMax: 1, instructions: 'Hold 30–45 seconds' },
        ],
      },
    ],
    assumptions: ['Sample: this is a fixed template, not based on your data', 'Assumes access to a barbell, bench and cable row'],
    warnings: ['Check the days and times fit your week before approving'],
  };
}

const MEALS: Array<Omit<MealEntry, 'date' | 'sortOrder'>> = [
  { slot: 'Breakfast', mealName: 'Akara with pap', description: 'Bean fritters with light pap', ingredients: [{ name: 'Black-eyed beans', quantity: 150, unit: 'g' }, { name: 'Pap (ogi)', quantity: 1, unit: 'cup' }], isSmoothie: false },
  { slot: 'Lunch', mealName: 'Jollof rice with grilled chicken', description: 'Smaller rice portion, more vegetables', ingredients: [{ name: 'Rice', quantity: 100, unit: 'g' }, { name: 'Chicken breast', quantity: 150, unit: 'g' }, { name: 'Tomatoes', quantity: 2 }], isSmoothie: false },
  { slot: 'Afternoon snack', mealName: 'Banana and spinach smoothie', description: 'Blend with water or milk', ingredients: [{ name: 'Banana', quantity: 1 }, { name: 'Spinach', quantity: 1, unit: 'handful' }], isSmoothie: true },
  { slot: 'Dinner', mealName: 'Fish pepper soup', description: 'Light, spicy broth with fish', ingredients: [{ name: 'Catfish', quantity: 200, unit: 'g' }, { name: 'Pepper soup spice' }], isSmoothie: false },
];

function mealPlan(text: string) {
  const m = text.match(/Plan dates: (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/);
  const start = m?.[1] ?? new Date().toISOString().slice(0, 10);
  const end = m?.[2] ?? start;
  const entries: MealEntry[] = [];
  for (let d = start, i = 0; d <= end && i < 14; d = addDays(d, 1), i++) {
    MEALS.forEach((meal, k) => entries.push({ ...meal, date: d, sortOrder: k }));
  }
  return {
    title: 'Sample meal plan',
    goalContext: 'Sample plan — not personalised',
    startDate: start,
    endDate: end,
    slots: MEALS.map((x) => x.slot),
    entries,
    shoppingList: [
      { name: 'Black-eyed beans', category: 'Pantry' },
      { name: 'Rice', category: 'Grains' },
      { name: 'Chicken breast', category: 'Protein' },
      { name: 'Catfish', category: 'Protein' },
      { name: 'Banana', category: 'Produce' },
      { name: 'Spinach', category: 'Produce' },
      { name: 'Tomatoes', category: 'Produce' },
    ],
    assumptions: ['Sample: fixed meals, not based on your preferences'],
  };
}

export function createSampleAi(): AiClient {
  return {
    configured: true,
    async structured<T>({ name, schema, messages }: { name: string; schema: ZodType<T>; messages: ChatMessage[] }): Promise<T> {
      const text = lastUser(messages);
      let out: unknown;
      switch (name) {
        case 'assistant_turn':
          out = {
            reply: `${LABEL} I heard: "${text.slice(0, 140)}". In the real app the AI would reply to this. Here are sample goals you can edit, approve or dismiss.`,
            clarifyingQuestions: ['Which days can you usually train?'],
            proposedGoals: [
              { title: 'Train consistently four times a week', priority: 'high', isMeasurable: false },
              { title: 'Run 5 km without stopping', priority: 'medium', isMeasurable: true, targetValue: 5, targetUnit: 'km' },
            ],
            suggestedNextStep: /meal|food|eat/i.test(text) ? 'create_meal_plan' : 'create_routine',
          };
          break;
        case 'routine_proposal':
          out = { needsClarification: false, clarifyingQuestions: [], plan: routinePlan() };
          break;
        case 'meal_plan_proposal':
          out = { needsClarification: false, clarifyingQuestions: [], plan: mealPlan(messages.map((m) => m.content).join('\n')) };
          break;
        default:
          // e.g. monthly_summary: let the app use its factual, record-based fallback.
          throw new AiUnavailableError('sample AI does not generate this', 'not_configured');
      }
      return schema.parse(out);
    },
  };
}
