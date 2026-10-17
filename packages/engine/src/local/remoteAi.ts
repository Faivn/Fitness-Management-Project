import type { ZodType } from 'zod';
import { AiUnavailableError, extractJsonObject, jsonSchemaFor, type AiClient, type ChatMessage } from '../ai.js';

/**
 * A live model reached through the app's own server endpoint (`api/ai.mjs`), so the provider key never
 * ships to the browser. The reply is parsed and validated with the same Zod schema as any other AI output.
 */
export function createRemoteAi(opts: { url: string; fetch?: typeof fetch; timeoutMs?: number }): AiClient {
  const doFetch = opts.fetch ?? fetch;
  const self: AiClient & { structured<T>(o: { name: string; schema: ZodType<T>; messages: ChatMessage[]; temperature?: number; onText?: (soFar: string) => void; retried?: boolean }): Promise<T> } = {
    configured: true,
    async structured<T>({ name, schema, messages, temperature, onText, retried }: { name: string; schema: ZodType<T>; messages: ChatMessage[]; temperature?: number; onText?: (soFar: string) => void; retried?: boolean }): Promise<T> {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 45_000);
      let res: Response;
      try {
        res = await doFetch(opts.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, messages, temperature, schema: jsonSchemaFor(schema) }),
          signal: ctrl.signal,
        });
      } catch (e) {
        throw new AiUnavailableError(e instanceof Error ? e.message : 'AI request failed', ctrl.signal.aborted ? 'timeout' : 'provider_error');
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) {
        const reason = res.status === 503 || res.status === 404 ? 'not_configured' : res.status === 429 ? 'rate_limited' : res.status === 401 ? 'auth_failed' : 'provider_error';
        throw new AiUnavailableError(`AI endpoint returned ${res.status}`, reason);
      }
      const { text } = (await res.json()) as { text?: string };
      if (typeof text !== 'string') throw new AiUnavailableError('AI endpoint returned no text', 'invalid_output');
      onText?.(text);
      try {
        return schema.parse(JSON.parse(extractJsonObject(text)));
      } catch {
        if (!retried) {
          // One repair attempt: show the model its own reply and ask for corrected JSON.
          return self.structured({
            name,
            schema,
            temperature,
            messages: [...messages, { role: 'assistant', content: text.slice(0, 8000) }, { role: 'user', content: 'That did not match the required JSON schema. Reply again with ONLY corrected JSON.' }],
            ...(onText ? { onText } : {}),
            retried: true,
          } as never);
        }
        throw new AiUnavailableError('The AI reply did not match the expected format', 'invalid_output');
      }
    },
  };
  return self;
}

/** Use the live model when it answers; otherwise fall back so the app never breaks. */
export function withFallback(primary: AiClient, fallback: AiClient, onFallback?: (e: unknown) => void): AiClient {
  return {
    configured: true,
    async structured(opts) {
      try {
        return await primary.structured(opts);
      } catch (e) {
        onFallback?.(e);
        return fallback.structured(opts);
      }
    },
  };
}
