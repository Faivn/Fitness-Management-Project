import {
  assistantTurnOutputSchema,
  type AssistantTurnOutput,
  type AiTurnInput,
  type Conversation,
  type ConversationMessage,
  type GoalProposal,
} from '@mova/shared';
import type { AppContext } from '../context.js';
import { must, mustOne } from '../db/helpers.js';
import { aiUnavailable } from '../http/errors.js';
import { AiUnavailableError, partialJsonString, type ChatMessage } from '../lib/ai.js';
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

type TurnResult = { conversation: Conversation; goalProposal: GoalProposal | null };

/** Persists the user's message first (so an AI failure never loses it) and builds the model input. */
async function prepareTurn(ctx: AppContext, input: AiTurnInput): Promise<{ conversationId: string; answered: boolean; messages: ChatMessage[] }> {
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
    return { conversationId, answered: true, messages: [] };
  }

  const fitness = await getFitnessContext(ctx);
  const messages: ChatMessage[] = [
    { role: 'system', content: conversationSystemPrompt(fitness) },
    ...ordered.map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];
  return { conversationId, answered: false, messages };
}

/** Saves the assistant reply. Goal suggestions only ever become a DRAFT proposal awaiting approval. */
async function finishTurn(ctx: AppContext, conversationId: string, output: AssistantTurnOutput): Promise<TurnResult> {
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

/**
 * WF-02 turn: the user's message is persisted BEFORE calling the model, so an
 * AI failure never loses it. Goal suggestions become a draft proposal that
 * the user must explicitly approve.
 */
export async function aiTurn(ctx: AppContext, input: AiTurnInput): Promise<TurnResult> {
  const turn = await prepareTurn(ctx, input);
  if (turn.answered) return { conversation: await getConversation(ctx, turn.conversationId), goalProposal: null };
  let output: AssistantTurnOutput;
  try {
    output = await ctx.ai.structured({ name: 'assistant_turn', schema: assistantTurnOutputSchema, messages: turn.messages });
  } catch (e) {
    if (e instanceof AiUnavailableError) throw aiUnavailable();
    throw e;
  }
  return finishTurn(ctx, turn.conversationId, output);
}

/**
 * Streaming variant of aiTurn (newline-delimited JSON):
 *   {"type":"delta","text":"…reply so far…"}   zero or more, text is cumulative
 *   {"type":"done", conversation, goalProposal} the saved result — same as aiTurn
 *   {"type":"error","code","message"}          provider failure; the user's message is already saved
 * Setup errors (validation, database) are thrown before streaming starts so
 * they remain ordinary HTTP errors. Nothing is approved or applied here.
 */
export async function aiTurnStream(ctx: AppContext, input: AiTurnInput, headers: HeadersInit): Promise<Response> {
  const turn = await prepareTurn(ctx, input);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        if (turn.answered) {
          send({ type: 'done', conversation: await getConversation(ctx, turn.conversationId), goalProposal: null });
          return;
        }
        let sent = '';
        let output: AssistantTurnOutput;
        try {
          output = await ctx.ai.structured({
            name: 'assistant_turn',
            schema: assistantTurnOutputSchema,
            messages: turn.messages,
            onText: (soFar) => {
              const reply = partialJsonString(soFar, 'reply');
              if (reply.length > sent.length) {
                sent = reply;
                send({ type: 'delta', text: reply });
              }
            },
          });
        } catch (e) {
          if (e instanceof AiUnavailableError) {
            const err = aiUnavailable();
            send({ type: 'error', code: err.code, message: err.message });
            return;
          }
          throw e;
        }
        send({ type: 'done', ...(await finishTurn(ctx, turn.conversationId, output)) });
      } catch {
        send({ type: 'error', code: 'server_error', message: 'Something went wrong. Your message was kept.' });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no', ...headers } });
}
