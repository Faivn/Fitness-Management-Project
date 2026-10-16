import { z } from 'zod';
import { CONVERSATION_CONTEXTS, GOAL_STATUSES } from '../enums.js';
import { goalPriority, idempotencyKey, localDate, requiredText, shortText, uuid } from './common.js';

/** A goal as proposed by the AI or entered by the user (WF-02). */
export const goalDraftSchema = z.object({
  title: requiredText(120),
  description: shortText(600),
  priority: goalPriority.default('medium'),
  targetValue: z.number().positive().max(100_000).optional(),
  targetUnit: shortText(30),
  targetDate: localDate.optional(),
  /** Distinguish what the user said from what the AI made measurable. */
  isMeasurable: z.boolean().default(false),
});
export type GoalDraft = z.infer<typeof goalDraftSchema>;

export const createGoalSchema = goalDraftSchema.extend({ idempotencyKey });

export const updateGoalSchema = goalDraftSchema.partial().extend({
  status: z.enum(GOAL_STATUSES).optional(),
});

export const aiTurnSchema = z.object({
  conversationId: uuid.optional(),
  context: z.enum(CONVERSATION_CONTEXTS).default('general'),
  message: requiredText(4000),
  /** Client-generated key so a retried send does not duplicate the user message. */
  clientMessageId: z.string().min(8).max(100),
});
export type AiTurnInput = z.infer<typeof aiTurnSchema>;

/** Approving one or more AI goal proposals, possibly after edits. */
export const approveGoalProposalSchema = z.object({
  version: z.number().int().min(1),
  goals: z.array(goalDraftSchema).min(1).max(10),
  idempotencyKey,
});
