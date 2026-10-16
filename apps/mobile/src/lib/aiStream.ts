import type { Conversation, GoalProposal } from '@mova/shared';
import { fetch as streamingFetch } from 'expo/fetch';
import { ApiError, api } from './api';
import { config, sampleMode } from './config';
import { supabase } from './supabase';

export type TurnResult = { conversation: Conversation; goalProposal: GoalProposal | null };
export type TurnInput = { conversationId?: string; message: string; clientMessageId: string; context?: string };

type StreamEvent =
  | { type: 'delta'; text: string }
  | ({ type: 'done' } & TurnResult)
  | { type: 'error'; code: string; message: string };

/** Splits a text stream into complete newline-delimited JSON events. Exported for tests. */
export function createNdjsonParser(onEvent: (e: StreamEvent) => void) {
  let buffer = '';
  const flush = (line: string) => {
    if (!line.trim()) return;
    try {
      onEvent(JSON.parse(line) as StreamEvent);
    } catch {
      // A malformed line is ignored; the saved conversation always arrives in the final event.
    }
  };
  return {
    push(chunk: string) {
      buffer += chunk;
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        flush(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
      }
    },
    end() {
      flush(buffer);
      buffer = '';
    },
  };
}

/**
 * One AI companion turn with the reply streamed as it is generated.
 * `onText` receives the cumulative reply text. The resolved value is the saved
 * conversation exactly as the non-streaming endpoint returns it, so approval
 * flows are untouched. Falls back to the plain endpoint if streaming is not
 * available on the server.
 */
export async function streamAiTurn(input: TurnInput, onText: (text: string) => void): Promise<TurnResult> {
  if (sampleMode) return api<TurnResult>('POST', 'ai/turn', input); // throws the read-only preview error
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new ApiError(401, 'unauthorized', 'Sign in to continue.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 70_000);
  try {
    let res;
    try {
      res = await streamingFetch(`${config.apiUrl}/api/v1/ai/turn/stream`, {
        method: 'POST',
        signal: controller.signal,
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json', accept: 'application/x-ndjson' },
        body: JSON.stringify(input),
      });
    } catch (e) {
      if (controller.signal.aborted) throw new ApiError(0, 'timeout', 'Mova took too long to respond. Your message was kept — try again.');
      throw new ApiError(0, 'network', "Couldn't reach Mova. Check your connection — your message was kept.");
    }
    if (res.status === 404 || res.status === 405) return api<TurnResult>('POST', 'ai/turn', input);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string; details?: unknown } } | null;
      if (res.status === 401) await supabase.auth.refreshSession().catch(() => undefined);
      throw new ApiError(res.status, body?.error?.code ?? 'server_error', body?.error?.message ?? 'Something went wrong.', body?.error?.details);
    }
    if (!res.body) return api<TurnResult>('POST', 'ai/turn', input);

    let result: TurnResult | null = null;
    let failure: ApiError | null = null;
    const parser = createNdjsonParser((e) => {
      if (e.type === 'delta') onText(e.text);
      else if (e.type === 'done') result = { conversation: e.conversation, goalProposal: e.goalProposal };
      else if (e.type === 'error') failure = new ApiError(503, e.code, e.message);
    });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }));
      }
      parser.end();
    } catch {
      if (!result && !failure) throw new ApiError(0, 'network', 'The connection was interrupted. Your message was kept — try again.');
    }
    if (failure) throw failure;
    if (!result) throw new ApiError(0, 'network', 'The connection was interrupted. Your message was kept — try again.');
    return result;
  } finally {
    clearTimeout(timer);
  }
}
