import { z } from 'zod';
import { idempotencyKey, localDate, requiredText, shortText, uuid } from './common.js';

/**
 * WF-10 meal plan. Deliberately has NO calorie, macro or consumption fields
 * (spec §3.2 and §9 rule 10). Quantities are optional to avoid false precision.
 */
export const ingredientSchema = z.object({
  name: requiredText(80),
  quantity: z.number().positive().max(10_000).optional(),
  unit: shortText(20),
});
export type Ingredient = z.infer<typeof ingredientSchema>;

export const mealEntrySchema = z.object({
  date: localDate,
  /** Configurable slot label, e.g. "Breakfast", "Morning snack", "Post-workout". */
  slot: requiredText(40),
  sortOrder: z.number().int().min(0).max(20),
  mealName: requiredText(120),
  description: shortText(500),
  ingredients: z.array(ingredientSchema).max(30).default([]),
  isSmoothie: z.boolean().default(false),
  notes: shortText(300),
});
export type MealEntry = z.infer<typeof mealEntrySchema>;

export const shoppingItemSchema = z.object({
  name: requiredText(80),
  quantity: z.number().positive().max(100_000).optional(),
  unit: shortText(20),
  category: shortText(40),
});
export type ShoppingItem = z.infer<typeof shoppingItemSchema>;

export const mealPlanSchema = z
  .object({
    title: requiredText(100),
    goalContext: shortText(300),
    startDate: localDate,
    endDate: localDate,
    slots: z.array(requiredText(40)).min(1).max(8),
    entries: z.array(mealEntrySchema).min(1).max(120),
    shoppingList: z.array(shoppingItemSchema).max(200).default([]),
    assumptions: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
  })
  .refine((p) => p.startDate <= p.endDate, { message: 'Start date must be before end date.', path: ['endDate'] })
  .refine((p) => p.entries.every((e) => e.date >= p.startDate && e.date <= p.endDate), {
    message: 'Every meal must fall inside the plan dates.',
    path: ['entries'],
  });
export type MealPlanDraft = z.infer<typeof mealPlanSchema>;

export const generateMealPlanSchema = z.object({
  conversationId: uuid.optional(),
  request: requiredText(2000),
  startDate: localDate,
  days: z.number().int().min(1).max(14).default(7),
});

export const editMealPlanProposalSchema = z.object({
  version: z.number().int().min(1),
  plan: mealPlanSchema,
});

export const reviseMealPlanProposalSchema = z.object({
  version: z.number().int().min(1),
  instruction: requiredText(2000),
});

export const approveMealPlanSchema = z.object({
  version: z.number().int().min(1),
  idempotencyKey,
});

/** Ticking an item is shopping state, not meal-consumption logging. */
export const updateShoppingItemSchema = z.object({
  checked: z.boolean().optional(),
  name: requiredText(80).optional(),
  quantity: z.number().positive().max(100_000).nullable().optional(),
  unit: z.string().trim().max(20).nullable().optional(),
  category: z.string().trim().max(40).nullable().optional(),
});

export const addShoppingItemSchema = shoppingItemSchema.extend({ idempotencyKey });
