import { z, type ZodType } from 'zod';
import type { Env } from '../config/env.js';

/**
 * Server-side Groq client (OpenAI-compatible Chat Completions API).
 *
 * - The API key lives only in server env; it is never logged or returned.
 * - Requests use Structured Outputs (`json_schema`, best-effort mode) and the
 *   reply is ALWAYS re-validated with Zod: model output is untrusted (§7.4).
 * - One repair attempt is made when the output does not match the schema.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class AiUnavailableError extends Error {
  constructor(
    message: string,
    readonly reason: 'not_configured' | 'timeout' | 'rate_limited' | 'provider_error' | 'invalid_output',
  ) {
    super(message);
    this.name = 'AiUnavailableError';
  }
}

export interface AiClient {
  readonly configured: boolean;
  structured<T>(opts: { name: string; schema: ZodType<T>; messages: ChatMessage[]; temperature?: number }): Promise<T>;
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export function jsonSchemaFor(schema: ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
}

export function createGroqClient(env: Env, fetchImpl: FetchLike = fetch): AiClient {
  const apiKey = env.GROQ_API_KEY;

  async function call(messages: ChatMessage[], name: string, jsonSchema: Record<string, unknown>, temperature: number) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.GROQ_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetchImpl(`${env.GROQ_BASE_URL}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: env.GROQ_MODEL,
          temperature,
          messages,
          response_format: { type: 'json_schema', json_schema: { name, strict: false, schema: jsonSchema } },
        }),
      });
    } catch (e) {
      const aborted = e instanceof Error && e.name === 'AbortError';
      throw new AiUnavailableError(aborted ? 'AI request timed out' : 'AI provider unreachable', aborted ? 'timeout' : 'provider_error');
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 429) throw new AiUnavailableError('AI provider rate limit reached', 'rate_limited');
    if (!res.ok) {
      // A 400 in best-effort mode can mean the model output failed schema validation upstream.
      throw new AiUnavailableError(`AI provider returned ${res.status}`, res.status === 400 ? 'invalid_output' : 'provider_error');
    }
    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
    return body.choices?.[0]?.message?.content ?? '';
  }

  return {
    configured: Boolean(apiKey),
    async structured({ name, schema, messages, temperature = 0.4 }) {
      if (!apiKey) throw new AiUnavailableError('AI is not configured on the server', 'not_configured');
      const jsonSchema = jsonSchemaFor(schema);
      let convo = messages;
      for (let attempt = 0; attempt < 2; attempt++) {
        let raw: string;
        try {
          raw = await call(convo, name, jsonSchema, temperature);
        } catch (e) {
          if (e instanceof AiUnavailableError && e.reason === 'invalid_output' && attempt === 0) continue;
          throw e;
        }
        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(raw);
        } catch {
          parsedJson = undefined;
        }
        const result = schema.safeParse(parsedJson);
        if (result.success) return result.data;
        convo = [
          ...messages,
          { role: 'assistant', content: raw.slice(0, 8000) },
          {
            role: 'user',
            content: `That response did not match the required JSON schema (${result.error.issues
              .slice(0, 5)
              .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
              .join('; ')}). Reply again with ONLY corrected JSON.`,
          },
        ];
      }
      throw new AiUnavailableError('AI returned an invalid structure', 'invalid_output');
    },
  };
}
