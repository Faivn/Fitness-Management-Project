import {
  assistantTurnOutputSchema,
  type AiTurnInput,
  type Conversation,
  type ConversationMessage,
  type GoalProposal,
} from '@mova/shared';
import type { AppContext } from '../context.js';
import { must, mustOne } from '../db/helpers.js';
import { aiUnavailable } from '../http/errors.js';
import { AiUnavailableError, type ChatMessage } from '../lib/groq.js';
import { getFitnessContext } from './aiContext.js';
import { createGoalProposal } from './goals.js';
import { conversationSystemPrompt } from './prompts.js';

const HISTORY_LIMIT = 16;

function toMessage(r: any): ConversationMessage {
  return { id: r.id, role: r.role, content: r.content, createdAt: r.created_at, metadata: r.metadata };
}

export async function getConversation(ctx: AppContext, id: string): Promise<Conversation> {
  const conv = await mustOne(ctx.db.from('conversations').select('*').eq('id', id).maybeSingle(), 'Conversation');
  const messages = await must(
    ctx.db.from('conversation_messages').select('*').eq('conversation_id', id).order('created_at', { ascending: true }),
  );
  return {
    id: conv.id,
    context: conv.context_type,
    createdAt: conv.created_at,
    updatedAt: conv.updated_at,
    messages: messages.map(toMessage),
  };
}

export async function listConversations(ctx: AppContext) {
  const rows = await must(ctx.db.from('conversations').select('id,context_type,updated_at').order('updated_at', { ascending: false }).limit(20));
  return rows.map((r: any) => ({ id: r.id, context: r.context_type, updatedAt: r.updated_at }));
}

export async function ensureConversation(ctx: AppContext, id: string | undefined, context: string): Promise<string> {
  if (id) {
    await mustOne(ctx.db.from('conversations').select('id').eq('id', id).maybeSingle(), 'Conversation');
    return id;
  }
  const row = await mustOne(
    ctx.db.from('conversations').insert({ user_id: ctx.user.id, context_type: context }).select('id').maybeSingle(),
    'Conversation',
  );
  return row.id;
}

export async function appendMessage(
  ctx: AppContext,
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  metadata: Record<string, unknown> | null = null,
  clientMessageId: string | null = null,
) {
  const { error } = await ctx.db.from('conversation_messages').insert({
    conversation_id: conversationId,
    user_id: ctx.user.id,
    role,
    content,
    metadata,
    client_message_id: clientMessageId,
  });
  // A retried send with the same client id is a no-op.
  if (error && error.code !== '23505') throw error;
  await ctx.db.from('conversations').update({ updated_at: ctx.now().toISOString() }).eq('id', conversationId);
}

/**
 * WF-02 turn: the user's message is persisted BEFORE calling the model, so an
 * AI failure never loses it. Goal suggestions become a draft proposal that
 * the user must explicitly approve.
 */
export async function aiTurn(ctx: AppContext, input: AiTurnInput): Promise<{ conversation: Conversation; goalProposal: GoalProposal | null }> {
  const conversationId = await ensureConversation(ctx, input.conversationId, input.context);
  await appendMessage(ctx, conversationId, 'user', input.message, null, input.clientMessageId);

  const history = await must(
    ctx.db
      .from('conversation_messages')
      .select('role,content,client_message_id')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT),
  );

  // If this exact message was already answered (client retry), do not call the model again.
  const ordered = [...history].reverse();
  const idx = ordered.findIndex((m: any) => m.client_message_id === input.clientMessageId);
  if (idx >= 0 && ordered.slice(idx + 1).some((m: any) => m.role === 'assistant')) {
    return { conversation: await getConversation(ctx, conversationId), goalProposal: null };
  }

  const fitness = await getFitnessContext(ctx);
  const messages: ChatMessage[] = [
    { role: 'system', content: conversationSystemPrompt(fitness) },
    ...ordered.map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];

  let output;
  try {
    output = await ctx.ai.structured({ name: 'assistant_turn', schema: assistantTurnOutputSchema, messages });
  } catch (e) {
    if (e instanceof AiUnavailableError) throw aiUnavailable();
    throw e;
  }

  let goalProposal: GoalProposal | null = null;
  if (output.proposedGoals.length > 0) {
    goalProposal = await createGoalProposal(ctx, conversationId, output.proposedGoals);
  }

  await appendMessage(ctx, conversationId, 'assistant', output.reply, {
    clarifyingQuestions: output.clarifyingQuestions,
    goalProposalId: goalProposal?.id,
    suggestedNextStep: output.suggestedNextStep,
  });

  return { conversation: await getConversation(ctx, conversationId), goalProposal };
}
