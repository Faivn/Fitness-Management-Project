/**
 * Offline demo assistant. A deterministic, rule-based stand-in for a live AI:
 * it answers from fixed templates chosen by keywords in the request, so the
 * demo works without a backend or API key. It is NOT a live model, and the app
 * says so. Everything it returns still passes the same Zod validation and the
 * same draft → review → explicit approval flow as real model output.
 */
import { addDays, type MealEntry } from '@mova/shared';
import type { ZodType } from 'zod';
import { AiUnavailableError, type AiClient, type ChatMessage } from '../ai.js';


function lastUser(messages: ChatMessage[]): string {
  return [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
}

function routinePlan() {
  return {
    title: 'Upper / lower + easy run',
    purpose: 'Demo routine from a fixed template. Review and edit before approving.',
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
    assumptions: ['Fixed demo template, not based on your data', 'Assumes a barbell, bench and cable row'],
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
    title: 'Weekly meal plan',
    goalContext: 'Demo plan from fixed meals',
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
    assumptions: ['Fixed demo meals, not based on your preferences'],
  };
}

function goalsFor(text: string) {
  const goals: Array<Record<string, unknown>> = [];
  if (/run|5\s?k|10\s?k|marathon|jog/i.test(text)) goals.push({ title: 'Run 5 km without stopping', priority: 'high', isMeasurable: true, targetValue: 5, targetUnit: 'km' });
  if (/strength|muscle|lift|gym|bulk|tone/i.test(text) || goals.length === 0) goals.push({ title: 'Train three times a week', priority: goals.length ? 'medium' : 'high', isMeasurable: false });
  if (/weight|lean|cut|fat|lose/i.test(text)) goals.push({ title: 'Build a steady weekly routine', priority: 'medium', isMeasurable: false });
  return goals.slice(0, 2);
}

type Intake = { kind: 'routine' | 'meal'; step: number } | null;

const QUESTIONS = {
  routine: ['How many days a week can you train, and for how long each time?', 'What equipment do you have? Anything you want to avoid?'],
  meal: ['Which foods do you like, and which do you avoid?', 'How many meals a day do you want, and is there a budget or diet to respect?'],
} as const;

/**
 * A short, fixed interview when a conversation opens with a routine or meal-plan
 * request: one question at a time, then an offer to draft. After that, later
 * messages are answered normally.
 */
function intake(messages: ChatMessage[]): Intake {
  const users = messages.filter((m) => m.role === 'user').map((m) => m.content);
  const first = users[0] ?? '';
  // Only a request to build something starts the interview; a plain question is just answered.
  const asksToBuild = /\b(create|make|build|plan|draft|set up|design)\b/i.test(first);
  const kind = !asksToBuild ? null : /\b(meals?|food|eat|eating|diet|nutrition)\b/i.test(first) ? 'meal' : /\b(routine|workout|training|exercise)\b/i.test(first) ? 'routine' : null;
  return kind && users.length <= QUESTIONS[kind].length + 1 ? { kind, step: users.length } : null;
}

/** Small, general answers to common fitness and food questions (simulated, never medical advice). */
function generalAnswer(text: string): string | null {
  if (!/\?|^(how|what|why|can|should|is|do|does)\b/i.test(text.trim())) return null;
  if (/protein/i.test(text)) return 'Protein helps muscles recover. Many people aim for some at every meal, such as eggs, fish, beans or chicken. This is general guidance, not personal advice.';
  if (/rest|recover|sore/i.test(text)) return 'Rest days are part of the plan: muscles adapt while you recover. Light movement and enough sleep usually help. If something hurts, ease off and ask a professional.';
  if (/warm|stretch/i.test(text)) return 'A few minutes of easy movement before you start raises your heart rate gently and helps joints feel ready. Keep stretches light until you are warm.';
  if (/water|hydrat|drink/i.test(text)) return 'Sip water through the day, and a little more around workouts. Your own thirst and the colour of your urine are good everyday guides.';
  if (/sets|reps|how many/i.test(text)) return 'A common starting point is 2 to 4 sets of 6 to 12 reps, with a weight that feels challenging but leaves one or two reps in reserve.';
  return 'Good question. I can give general fitness and food guidance, and I can build you a workout routine or a meal plan. Which would help most?';
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createDemoAi(opts: { delayMs?: number } = {}): AiClient {
  const delay = opts.delayMs ?? 0;
  return {
    configured: true,
    async structured<T>({ name, schema, messages }: { name: string; schema: ZodType<T>; messages: ChatMessage[] }): Promise<T> {
      const text = lastUser(messages);
      let out: unknown;
      switch (name) {
        case 'assistant_turn': {
          if (delay) await sleep(delay);
          const interview = intake(messages);
          if (interview) {
            const next = QUESTIONS[interview.kind][interview.step - 1];
            out = next
              ? { reply: next, clarifyingQuestions: [], proposedGoals: [], suggestedNextStep: 'none' }
              : interview.kind === 'meal'
                ? { reply: 'Thanks, that is enough. I can draft a 7-day meal plan with a shopping list. Nothing is saved until you approve it.', clarifyingQuestions: [], proposedGoals: [], suggestedNextStep: 'create_meal_plan' }
                : { reply: 'Thanks, that is enough. I can draft a routine. You review and approve it before it is scheduled.', clarifyingQuestions: [], proposedGoals: [], suggestedNextStep: 'create_routine' };
            break;
          }
          const general = generalAnswer(text);
          const wantsMeals = /\b(meals?|food|eat|eating|diet|nutrition)\b/i.test(text);
          const wantsRoutine = /routine|workout|plan|schedule|train/i.test(text) && !wantsMeals;
          const wantsReview = /review|month/i.test(text) && !wantsMeals && !wantsRoutine;
          out = general && !/routine|workout|meal plan|plan my/i.test(text)
            ? { reply: general, clarifyingQuestions: [], proposedGoals: [], suggestedNextStep: 'none' }
            : wantsMeals
            ? { reply: 'I can draft a 7-day meal plan with a shopping list. Nothing is saved until you approve it.', clarifyingQuestions: [], proposedGoals: [], suggestedNextStep: 'create_meal_plan' }
            : wantsRoutine
              ? { reply: 'I can draft a three-day routine with a run. You review and approve it before it is scheduled.', clarifyingQuestions: ['Which days suit you best?'], proposedGoals: [], suggestedNextStep: 'create_routine' }
              : wantsReview
                ? { reply: 'You can review your month from History. I can summarise it from your records.', clarifyingQuestions: [], proposedGoals: [], suggestedNextStep: 'monthly_review' }
                : { reply: 'Here are goals based on what you said. Edit them, approve them or dismiss them.', clarifyingQuestions: [], proposedGoals: goalsFor(text), suggestedNextStep: 'none' };
          break;
        }
        case 'routine_proposal':
          if (delay) await sleep(delay);
          out = { needsClarification: false, clarifyingQuestions: [], plan: routinePlan() };
          break;
        case 'meal_plan_proposal':
          if (delay) await sleep(delay);
          out = { needsClarification: false, clarifyingQuestions: [], plan: mealPlan(messages.map((m) => m.content).join('\n')) };
          break;
        default:
          // e.g. monthly_summary: the app falls back to its factual, record-based summary.
          throw new AiUnavailableError('demo assistant does not generate this', 'not_configured');
      }
      return schema.parse(out);
    },
  };
}
