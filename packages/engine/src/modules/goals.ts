import type { Goal, GoalDraft, GoalProposal } from '@mova/shared';
import type { AppContext } from '../context.js';
import { must, mustOne } from '../db/helpers.js';
import { toGoal } from '../db/mappers.js';
import { conflict, unprocessable } from '../http/errors.js';

function goalRow(userId: string, g: GoalDraft) {
  return {
    user_id: userId,
    title: g.title,
    description: g.description ?? null,
    priority: g.priority,
    target_value: g.targetValue ?? null,
    target_unit: g.targetUnit ?? null,
    target_date: g.targetDate ?? null,
    is_measurable: g.isMeasurable,
  };
}

export async function listGoals(ctx: AppContext, includeArchived = false): Promise<Goal[]> {
  let q = ctx.db.from('fitness_goals').select('*').order('created_at', { ascending: false });
  if (!includeArchived) q = q.in('status', ['active', 'achieved']);
  const rows = await must(q);
  return rows.map(toGoal);
}

export async function createGoal(ctx: AppContext, input: GoalDraft & { idempotencyKey: string }): Promise<Goal> {
  const existing = await must(
    ctx.db.from('fitness_goals').select('*').eq('idempotency_key', input.idempotencyKey).limit(1),
  );
  if (existing[0]) return toGoal(existing[0]);
  const row = await mustOne(
    ctx.db
      .from('fitness_goals')
      .insert({ ...goalRow(ctx.user.id, input), status: 'active', source: 'manual', idempotency_key: input.idempotencyKey })
      .select('*')
      .maybeSingle(),
    'Goal',
  );
  return toGoal(row);
}

export async function updateGoal(ctx: AppContext, id: string, patch: Partial<GoalDraft> & { status?: Goal['status'] }): Promise<Goal> {
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.priority !== undefined) update.priority = patch.priority;
  if (patch.targetValue !== undefined) update.target_value = patch.targetValue;
  if (patch.targetUnit !== undefined) update.target_unit = patch.targetUnit;
  if (patch.targetDate !== undefined) update.target_date = patch.targetDate;
  if (patch.isMeasurable !== undefined) update.is_measurable = patch.isMeasurable;
  if (patch.status !== undefined) update.status = patch.status;
  const row = await mustOne(ctx.db.from('fitness_goals').update(update).eq('id', id).select('*').maybeSingle(), 'Goal');
  return toGoal(row);
}

// --- AI goal proposals (WF-02) --------------------------------------------

export function toGoalProposal(r: Record<string, any>): GoalProposal {
  return {
    id: r.id,
    status: r.status,
    version: r.version,
    goals: r.goals ?? [],
    conversationId: r.conversation_id,
    createdAt: r.created_at,
  };
}

export async function createGoalProposal(ctx: AppContext, conversationId: string, goals: GoalDraft[]): Promise<GoalProposal> {
  const row = await mustOne(
    ctx.db
      .from('goal_proposals')
      .insert({ user_id: ctx.user.id, conversation_id: conversationId, goals, status: 'draft', version: 1 })
      .select('*')
      .maybeSingle(),
    'Goal proposal',
  );
  return toGoalProposal(row);
}

export async function getGoalProposal(ctx: AppContext, id: string): Promise<GoalProposal> {
  return toGoalProposal(await mustOne(ctx.db.from('goal_proposals').select('*').eq('id', id).maybeSingle(), 'Goal proposal'));
}

/**
 * Approve exactly the reviewed version, possibly with user edits. Goals are
 * saved only here — never directly from model output.
 */
export async function approveGoalProposal(
  ctx: AppContext,
  id: string,
  input: { version: number; goals: GoalDraft[]; idempotencyKey: string },
): Promise<Goal[]> {
  const proposal = await getGoalProposal(ctx, id);
  if (proposal.status === 'applied') {
    const rows = await must(ctx.db.from('fitness_goals').select('*').eq('goal_proposal_id', id));
    return rows.map(toGoal);
  }
  if (proposal.status !== 'draft') throw unprocessable(`This proposal is ${proposal.status}.`);
  if (proposal.version !== input.version) throw conflict('This proposal changed since you reviewed it. Review it again.');

  // Claim the proposal first so a concurrent approve cannot insert twice.
  const claimed = await must(
    ctx.db
      .from('goal_proposals')
      .update({ status: 'applied', approved_at: ctx.now().toISOString(), goals: input.goals })
      .eq('id', id)
      .eq('status', 'draft')
      .eq('version', input.version)
      .select('id'),
  );
  if (claimed.length === 0) throw conflict('This proposal was already handled.');

  const rows = await must(
    ctx.db
      .from('fitness_goals')
      .insert(input.goals.map((g) => ({ ...goalRow(ctx.user.id, g), status: 'active', source: 'ai', goal_proposal_id: id })))
      .select('*'),
  );
  return rows.map(toGoal);
}

export async function rejectProposal(ctx: AppContext, table: 'goal_proposals' | 'routine_proposals' | 'meal_plan_proposals', id: string) {
  const rows = await must(ctx.db.from(table).update({ status: 'rejected' }).eq('id', id).eq('status', 'draft').select('id'));
  if (rows.length === 0) throw unprocessable('Only a draft proposal can be rejected.');
  return { id, status: 'rejected' as const };
}
