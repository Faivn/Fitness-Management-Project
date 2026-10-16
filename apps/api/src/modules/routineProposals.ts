import {
  routinePlanSchema,
  routineProposalOutputSchema,
  type ApplyResult,
  type ApproveRoutineProposalInput,
  type GenerateRoutineProposalInput,
  type RoutinePlan,
  type RoutineProposal,
  type ScheduleWindow,
} from '@mova/shared';
import type { AppContext } from '../context.js';
import { must, mustOne } from '../db/helpers.js';
import { aiUnavailable, conflict, fromDbError, unprocessable } from '../http/errors.js';
import { AiUnavailableError, type ChatMessage } from '../lib/ai.js';
import { getFitnessContext } from './aiContext.js';
import { appendMessage, ensureConversation } from './conversations.js';
import { routineRevisionPrompt, routineSystemPrompt } from './prompts.js';
import { getMonthlyReview } from './monthlyReviews.js';
import { getRoutine } from './routines.js';
import { conflictError, planSchedule } from './scheduling.js';

function toProposal(r: any): RoutineProposal {
  return {
    id: r.id,
    status: r.status,
    version: r.version,
    mode: r.mode,
    targetRoutineId: r.target_routine_id,
    plan: r.plan,
    clarifyingQuestions: r.clarifying_questions ?? [],
    conversationId: r.conversation_id,
    appliedRoutineId: r.applied_routine_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    approvedAt: r.approved_at,
    appliedAt: r.applied_at,
  };
}

export async function getRoutineProposal(ctx: AppContext, id: string): Promise<RoutineProposal> {
  return toProposal(await mustOne(ctx.db.from('routine_proposals').select('*').eq('id', id).maybeSingle(), 'Proposal'));
}

export async function listRoutineProposals(ctx: AppContext): Promise<RoutineProposal[]> {
  const rows = await must(ctx.db.from('routine_proposals').select('*').eq('status', 'draft').order('created_at', { ascending: false }).limit(10));
  return rows.map(toProposal);
}

/** Only goal ids the user actually owns may be linked. */
async function ownedGoalIds(ctx: AppContext, plan: RoutinePlan): Promise<RoutinePlan> {
  if (plan.goalIds.length === 0) return plan;
  const rows = await must(ctx.db.from('fitness_goals').select('id').in('id', plan.goalIds));
  const owned = new Set(rows.map((r: any) => r.id));
  return { ...plan, goalIds: plan.goalIds.filter((g) => owned.has(g)) };
}

async function runModel(ctx: AppContext, messages: ChatMessage[]) {
  try {
    return await ctx.ai.structured({ name: 'routine_proposal', schema: routineProposalOutputSchema, messages, temperature: 0.3 });
  } catch (e) {
    if (e instanceof AiUnavailableError) throw aiUnavailable();
    throw e;
  }
}

/** WF-03 steps 1–5: generate a draft proposal. Nothing active changes here. */
export async function generateRoutineProposal(ctx: AppContext, input: GenerateRoutineProposalInput): Promise<RoutineProposal> {
  const conversationId = await ensureConversation(ctx, input.conversationId, 'workout');
  await appendMessage(ctx, conversationId, 'user', input.request);

  const fitness = await getFitnessContext(ctx);
  let currentPlan: RoutinePlan | null = null;
  if (input.mode !== 'new' && input.targetRoutineId) {
    currentPlan = (await getRoutine(ctx, input.targetRoutineId)).plan;
  }
  let reviewContext: string | null = null;
  if (input.monthlyReviewId) {
    const review = await getMonthlyReview(ctx, input.monthlyReviewId);
    reviewContext = `Saved review for ${review.periodStart} to ${review.periodEnd} (computed from records):\n${JSON.stringify({
      counts: review.stats.counts,
      summary: review.summaryText,
      reflection: review.reflection,
    })}`;
  }
  const messages: ChatMessage[] = [
    { role: 'system', content: routineSystemPrompt(fitness, input.mode) },
    ...(currentPlan ? [{ role: 'user' as const, content: `CURRENT routine:\n${JSON.stringify(currentPlan)}` }] : []),
    ...(reviewContext ? [{ role: 'user' as const, content: reviewContext }] : []),
    {
      role: 'user',
      content: `${input.request}${input.goalIds.length ? `\nLink to goal ids: ${input.goalIds.join(', ')}` : ''}`,
    },
  ];
  const out = await runModel(ctx, messages);
  const plan = out.plan && !out.needsClarification ? await ownedGoalIds(ctx, out.plan) : null;

  const row = await mustOne(
    ctx.db
      .from('routine_proposals')
      .insert({
        user_id: ctx.user.id,
        conversation_id: conversationId,
        status: 'draft',
        version: 1,
        mode: input.mode,
        target_routine_id: input.mode === 'new' ? null : input.targetRoutineId ?? null,
        request_text: input.request,
        plan,
        clarifying_questions: out.clarifyingQuestions,
      })
      .select('*')
      .maybeSingle(),
    'Proposal',
  );

  await appendMessage(
    ctx,
    conversationId,
    'assistant',
    plan
      ? `I've drafted "${plan.title}" for you to review. Nothing is scheduled until you approve it.`
      : `Before I draft a routine: ${out.clarifyingQuestions.join(' ') || 'could you tell me a bit more?'}`,
    { routineProposalId: row.id, clarifyingQuestions: out.clarifyingQuestions },
  );
  return toProposal(row);
}

async function requireDraft(ctx: AppContext, id: string, version: number): Promise<RoutineProposal> {
  const p = await getRoutineProposal(ctx, id);
  if (p.status !== 'draft') throw unprocessable(`This proposal is ${p.status}.`);
  if (p.version !== version) throw conflict('This proposal changed since you opened it. Reload and review it again.');
  return p;
}

async function bumpVersion(ctx: AppContext, p: RoutineProposal, patch: Record<string, unknown>): Promise<RoutineProposal> {
  const rows = await must(
    ctx.db
      .from('routine_proposals')
      .update({ ...patch, version: p.version + 1 })
      .eq('id', p.id)
      .eq('version', p.version)
      .eq('status', 'draft')
      .select('*'),
  );
  if (!rows[0]) throw conflict('This proposal changed since you opened it. Reload and review it again.');
  return toProposal(rows[0]);
}

/** Direct user edit of the draft (WF-03 step 6). */
export async function editRoutineProposal(ctx: AppContext, id: string, version: number, plan: RoutinePlan) {
  const p = await requireDraft(ctx, id, version);
  return bumpVersion(ctx, p, { plan: await ownedGoalIds(ctx, plan), clarifying_questions: [] });
}

/** Conversational refinement; the prompt requires unaffected edits to be kept. */
export async function reviseRoutineProposal(ctx: AppContext, id: string, version: number, instruction: string) {
  const p = await requireDraft(ctx, id, version);
  if (p.conversationId) await appendMessage(ctx, p.conversationId, 'user', instruction);
  const fitness = await getFitnessContext(ctx);
  const out = await runModel(ctx, [
    { role: 'system', content: routineSystemPrompt(fitness, p.mode) },
    { role: 'system', content: routineRevisionPrompt() },
    { role: 'user', content: `CURRENT plan:\n${JSON.stringify(p.plan)}\n\nInstruction: ${instruction}` },
  ]);
  if (!out.plan || out.needsClarification) {
    return bumpVersion(ctx, p, { clarifying_questions: out.clarifyingQuestions });
  }
  return bumpVersion(ctx, p, { plan: await ownedGoalIds(ctx, out.plan), clarifying_questions: [] });
}

export async function checkProposalConflicts(ctx: AppContext, id: string, schedule: ScheduleWindow) {
  const p = await getRoutineProposal(ctx, id);
  if (!p.plan) throw unprocessable('This proposal has no plan yet.');
  const s = await planSchedule(ctx, routinePlanSchema.parse(p.plan), schedule, p.targetRoutineId ?? undefined);
  return { occurrences: s.occurrences.length, conflicts: s.conflicts };
}

/**
 * WF-03 steps 9–12: revalidate, surface conflicts, then apply atomically via
 * the transactional RPC. Approval is bound to the exact version reviewed.
 */
export async function approveRoutineProposal(ctx: AppContext, id: string, input: ApproveRoutineProposalInput): Promise<ApplyResult> {
  const p = await getRoutineProposal(ctx, id);
  if (p.status === 'applied' && p.appliedRoutineId) {
    return { routine: await getRoutine(ctx, p.appliedRoutineId), sessionsCreated: 0, conflicts: [] };
  }
  if (p.status !== 'draft') throw unprocessable(`This proposal is ${p.status}.`);
  if (p.version !== input.version) throw conflict('This proposal changed since you reviewed it. Review it again.');

  const parsed = routinePlanSchema.safeParse(p.plan);
  if (!parsed.success) {
    throw unprocessable('This proposal is incomplete and cannot be applied yet.', parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }
  const plan = await ownedGoalIds(ctx, parsed.data);
  const s = await planSchedule(ctx, plan, input.schedule, p.targetRoutineId ?? undefined);
  if (s.conflicts.length && !input.acceptConflicts) throw conflictError(s.conflicts);

  const { data, error } = await ctx.db.rpc('apply_routine_proposal', {
    p_proposal_id: id,
    p_version: input.version,
    p_occurrences: s.occurrences,
    p_timezone: s.timezone,
    p_today: s.today,
    p_idempotency_key: input.idempotencyKey,
  });
  // The RPC is one transaction: on failure nothing was written and the draft
  // stays intact, so the user can safely retry with the same idempotency key.
  if (error) throw fromDbError(error);
  const result = data as { routineId: string; sessionsCreated: number };
  return { routine: await getRoutine(ctx, result.routineId), sessionsCreated: result.sessionsCreated, conflicts: s.conflicts };
}
