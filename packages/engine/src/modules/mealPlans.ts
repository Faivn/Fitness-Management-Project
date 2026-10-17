import {
  addDays,
  completeMealPlan,
  consolidateShoppingList,
  missingMealCells,
  mealPlanProposalOutputSchema,
  mealPlanSchema,
  type MealPlan,
  type MealPlanDraft,
  type MealPlanProposal,
} from '@mova/shared';
import type { AppContext } from '../context.js';
import { must, mustOne } from '../db/helpers.js';
import { toMealEntry, toShoppingItem } from '../db/mappers.js';
import { aiUnavailable, conflict, fromDbError, unprocessable } from '../http/errors.js';
import { AiUnavailableError, type ChatMessage } from '../ai.js';
import { getFitnessContext } from './aiContext.js';
import { appendMessage, ensureConversation } from './conversations.js';
import { mealPlanRevisionPrompt, mealPlanSystemPrompt } from './prompts.js';

function toProposal(r: any): MealPlanProposal {
  return {
    id: r.id,
    status: r.status,
    version: r.version,
    plan: r.plan,
    clarifyingQuestions: r.clarifying_questions ?? [],
    appliedMealPlanId: r.applied_meal_plan_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function runModel(ctx: AppContext, messages: ChatMessage[]) {
  try {
    return await ctx.ai.structured({ name: 'meal_plan_proposal', schema: mealPlanProposalOutputSchema, messages, temperature: 0.5 });
  } catch (e) {
    if (e instanceof AiUnavailableError) throw aiUnavailable();
    throw e;
  }
}

/** WF-10: AI drafts a timetable + shopping list. Nothing is active until approved. */
export async function generateMealPlanProposal(
  ctx: AppContext,
  input: { conversationId?: string; request: string; startDate: string; days: number },
): Promise<MealPlanProposal> {
  const conversationId = await ensureConversation(ctx, input.conversationId, 'meal_plan');
  await appendMessage(ctx, conversationId, 'user', input.request);
  const fitness = await getFitnessContext(ctx);
  const out = await runModel(ctx, [
    { role: 'system', content: mealPlanSystemPrompt(fitness, input.startDate, input.days) },
    { role: 'user', content: `${input.request}\n(Plan dates: ${input.startDate} to ${addDays(input.startDate, input.days - 1)})` },
  ]);
  let plan = out.plan && !out.needsClarification ? out.plan : null;
  if (plan) {
    let missing = missingMealCells(plan, input.startDate, input.days);
    if (missing.length) {
      // The model stopped early. Ask once for the complete plan, then fill any gap that is left.
      const dates = [...new Set(missing.map((m) => m.date))].join(', ');
      const again = await runModel(ctx, [
        { role: 'system', content: mealPlanSystemPrompt(fitness, input.startDate, input.days) },
        { role: 'user', content: `${input.request}\n(Plan dates: ${input.startDate} to ${addDays(input.startDate, input.days - 1)})` },
        { role: 'assistant', content: JSON.stringify(out) },
        { role: 'user', content: `That plan is incomplete: no meals for ${dates}. Return the COMPLETE plan with every meal slot filled on EVERY date from ${input.startDate} to ${addDays(input.startDate, input.days - 1)}. Keep descriptions short.` },
      ]);
      if (again.plan && !again.needsClarification) {
        const better = again.plan;
        if (missingMealCells(better, input.startDate, input.days).length < missing.length) plan = better;
      }
    }
    plan = completeMealPlan(plan, input.startDate, input.days);
  }
  const row = await mustOne(
    ctx.db
      .from('meal_plan_proposals')
      .insert({
        user_id: ctx.user.id,
        conversation_id: conversationId,
        status: 'draft',
        version: 1,
        request_text: input.request,
        plan,
        clarifying_questions: out.clarifyingQuestions,
      })
      .select('*')
      .maybeSingle(),
    'Meal plan proposal',
  );
  await appendMessage(
    ctx,
    conversationId,
    'assistant',
    plan ? `I've drafted "${plan.title}" for you.` : `Before I plan your meals: ${out.clarifyingQuestions.join(' ')}`,
    { mealPlanProposalId: row.id, clarifyingQuestions: out.clarifyingQuestions },
  );
  return toProposal(row);
}

export async function getMealPlanProposal(ctx: AppContext, id: string) {
  return toProposal(await mustOne(ctx.db.from('meal_plan_proposals').select('*').eq('id', id).maybeSingle(), 'Meal plan proposal'));
}

async function requireDraft(ctx: AppContext, id: string, version: number) {
  const p = await getMealPlanProposal(ctx, id);
  if (p.status !== 'draft') throw unprocessable(`This proposal is ${p.status}.`);
  if (p.version !== version) throw conflict('This proposal changed since you opened it. Reload and review it again.');
  return p;
}

async function bump(ctx: AppContext, p: MealPlanProposal, patch: Record<string, unknown>) {
  const rows = await must(
    ctx.db.from('meal_plan_proposals').update({ ...patch, version: p.version + 1 }).eq('id', p.id).eq('version', p.version).eq('status', 'draft').select('*'),
  );
  if (!rows[0]) throw conflict('This proposal changed since you opened it.');
  return toProposal(rows[0]);
}

export async function editMealPlanProposal(ctx: AppContext, id: string, version: number, plan: MealPlanDraft) {
  const p = await requireDraft(ctx, id, version);
  return bump(ctx, p, { plan, clarifying_questions: [] });
}

export async function reviseMealPlanProposal(ctx: AppContext, id: string, version: number, instruction: string) {
  const p = await requireDraft(ctx, id, version);
  const fitness = await getFitnessContext(ctx);
  const start = p.plan?.startDate ?? fitness.today;
  const days = p.plan ? Math.round((Date.parse(p.plan.endDate) - Date.parse(p.plan.startDate)) / 86_400_000) + 1 : 7;
  const out = await runModel(ctx, [
    { role: 'system', content: mealPlanSystemPrompt(fitness, start, days) },
    { role: 'system', content: mealPlanRevisionPrompt() },
    { role: 'user', content: `CURRENT plan:\n${JSON.stringify(p.plan)}\n\nInstruction: ${instruction}` },
  ]);
  if (!out.plan || out.needsClarification) return bump(ctx, p, { clarifying_questions: out.clarifyingQuestions });
  return bump(ctx, p, { plan: out.plan, clarifying_questions: [] });
}

/**
 * Approve the exact reviewed version. The shopping list is re-consolidated
 * from the (possibly edited) meals so it always matches the approved plan.
 */
export async function approveMealPlanProposal(ctx: AppContext, id: string, version: number, idempotencyKey: string): Promise<MealPlan> {
  const p = await getMealPlanProposal(ctx, id);
  if (p.status === 'applied' && p.appliedMealPlanId) return getMealPlan(ctx, p.appliedMealPlanId);
  if (p.status !== 'draft') throw unprocessable(`This proposal is ${p.status}.`);
  if (p.version !== version) throw conflict('This proposal changed since you reviewed it. Review it again.');
  const parsed = mealPlanSchema.safeParse(p.plan);
  if (!parsed.success) throw unprocessable('This meal plan is incomplete and cannot be approved yet.');
  const plan = parsed.data;

  const hasIngredients = plan.entries.some((e) => e.ingredients.length > 0);
  const hints = new Map(plan.shoppingList.filter((i) => i.category).map((i) => [i.name.trim().toLowerCase(), i.category!]));
  const shopping = hasIngredients
    ? consolidateShoppingList(plan.entries, hints)
    : plan.shoppingList.map((i) => ({ ...i, sourceEntryIndexes: [] as number[] }));

  const { data, error } = await ctx.db.rpc('approve_meal_plan_proposal', {
    p_proposal_id: id,
    p_version: version,
    p_shopping: shopping,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw fromDbError(error);
  return getMealPlan(ctx, (data as { mealPlanId: string }).mealPlanId);
}

export async function getMealPlan(ctx: AppContext, id: string): Promise<MealPlan> {
  const r = await mustOne(ctx.db.from('meal_plans').select('*').eq('id', id).maybeSingle(), 'Meal plan');
  const [entries, items] = await Promise.all([
    must(ctx.db.from('meal_plan_entries').select('*').eq('meal_plan_id', id).order('entry_date').order('sort_order')),
    must(ctx.db.from('shopping_list_items').select('*').eq('meal_plan_id', id).order('category').order('name')),
  ]);
  return {
    id: r.id,
    title: r.title,
    goalContext: r.goal_context,
    startDate: r.start_date,
    endDate: r.end_date,
    status: r.status,
    version: r.version,
    source: r.source,
    slots: r.slots ?? [],
    approvedAt: r.approved_at,
    createdAt: r.created_at,
    entries: entries.map(toMealEntry),
    shoppingList: items.map(toShoppingItem),
  };
}

/** Active plan first, then history (old plans are never deleted). */
export async function listMealPlans(ctx: AppContext) {
  const rows = await must(ctx.db.from('meal_plans').select('id,title,start_date,end_date,status,created_at').order('start_date', { ascending: false }).limit(30));
  return rows.map((r: any) => ({ id: r.id, title: r.title, startDate: r.start_date, endDate: r.end_date, status: r.status, createdAt: r.created_at }));
}

export async function updateShoppingItem(ctx: AppContext, itemId: string, patch: Record<string, unknown>) {
  const update: Record<string, unknown> = {};
  for (const [k, col] of [
    ['checked', 'checked'],
    ['name', 'name'],
    ['quantity', 'quantity'],
    ['unit', 'unit'],
    ['category', 'category'],
  ] as const) {
    if (patch[k] !== undefined) update[col] = patch[k];
  }
  const rows = await must(ctx.db.from('shopping_list_items').update(update).eq('id', itemId).select('*'));
  if (!rows[0]) throw unprocessable('Item not found.');
  return toShoppingItem(rows[0]);
}

export async function addShoppingItem(
  ctx: AppContext,
  planId: string,
  input: { name: string; quantity?: number; unit?: string; category?: string; idempotencyKey: string },
) {
  await mustOne(ctx.db.from('meal_plans').select('id').eq('id', planId).maybeSingle(), 'Meal plan');
  const existing = await must(ctx.db.from('shopping_list_items').select('*').eq('idempotency_key', input.idempotencyKey).limit(1));
  if (existing[0]) return toShoppingItem(existing[0]);
  const row = await mustOne(
    ctx.db
      .from('shopping_list_items')
      .insert({
        meal_plan_id: planId,
        user_id: ctx.user.id,
        name: input.name,
        quantity: input.quantity ?? null,
        unit: input.unit ?? null,
        category: input.category ?? null,
        idempotency_key: input.idempotencyKey,
      })
      .select('*')
      .maybeSingle(),
    'Item',
  );
  return toShoppingItem(row);
}

export async function deleteShoppingItem(ctx: AppContext, itemId: string) {
  await must(ctx.db.from('shopping_list_items').delete().eq('id', itemId).select('id'));
  return { id: itemId, deleted: true };
}
