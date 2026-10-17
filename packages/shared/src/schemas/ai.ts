import { z } from 'zod';
import { goalDraftSchema } from './goals.js';
import { mealPlanSchema } from './mealPlan.js';
import { routinePlanSchema } from './routine.js';

/**
 * Structured shapes the model must return. Every model response is parsed
 * with these schemas on the server and treated as untrusted (spec §7.4).
 */

export const assistantTurnOutputSchema = z.object({
  reply: z.string().trim().min(1).max(4000),
  /** Focused questions for genuinely missing essentials (WF-02 step 5). */
  clarifyingQuestions: z.array(z.string().trim().min(1).max(300)).max(4).default([]),
  /** Optional goal proposals — saved only after explicit approval. */
  proposedGoals: z.array(goalDraftSchema).max(5).default([]),
  /** Hint that the user may want a structured plan next; never auto-executed. */
  suggestedNextStep: z.enum(['none', 'create_routine', 'create_meal_plan', 'monthly_review']).default('none'),
});
export type AssistantTurnOutput = z.infer<typeof assistantTurnOutputSchema>;

export const routineProposalOutputSchema = z.object({
  needsClarification: z.boolean().default(false),
  clarifyingQuestions: z.array(z.string().trim().min(1).max(300)).max(4).default([]),
  plan: routinePlanSchema.optional(),
});
export type RoutineProposalOutput = z.infer<typeof routineProposalOutputSchema>;

export const mealPlanProposalOutputSchema = z.object({
  needsClarification: z.boolean().default(false),
  clarifyingQuestions: z.array(z.string().trim().min(1).max(300)).max(4).default([]),
  plan: mealPlanSchema.optional(),
});
export type MealPlanProposalOutput = z.infer<typeof mealPlanProposalOutputSchema>;

export const monthlySummaryOutputSchema = z.object({
  summaryText: z.string().trim().min(1).max(6000),
  observations: z.array(z.string().trim().min(1).max(300)).max(8).default([]),
});
export type MonthlySummaryOutput = z.infer<typeof monthlySummaryOutputSchema>;
