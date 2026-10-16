import OpenAI from 'openai';
import { z, type ZodType } from 'zod';
import type { Env } from '../config/env.js';

/**
 * Server-side OpenAI client (spec §8.0.4): official SDK, Responses API,
 * Structured Outputs.
 *
 * - The API key lives only in server env; it is never logged or returned.
 * - Requests ask for `json_schema` output and the reply is ALWAYS
 *   re-validated with Zod: model output is untrusted (§7.4).
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

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export function jsonSchemaFor(schema: ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
}

function mapError(e: unknown): AiUnavailableError {
  if (e instanceof OpenAI.APIConnectionTimeoutError) return new AiUnavailableError('AI request timed out', 'timeout');
  if (e instanceof OpenAI.RateLimitError) return new AiUnavailableError('AI provider rate limit reached', 'rate_limited');
  if (e instanceof OpenAI.BadRequestError) return new AiUnavailableError('AI provider rejected the request', 'invalid_output');
  return new AiUnavailableError('AI provider unavailable', 'provider_error');
}

export function createOpenAiClient(env: Env, fetchImpl?: FetchLike): AiClient {
  const apiKey = env.OPENAI_API_KEY;
  const client = apiKey
    ? new OpenAI({ apiKey, timeout: env.OPENAI_TIMEOUT_MS, maxRetries: 1, ...(fetchImpl ? { fetch: fetchImpl } : {}) })
    : null;

  return {
    configured: Boolean(client),
    async structured({ name, schema, messages, temperature }) {
      if (!client) throw new AiUnavailableError('AI is not configured on the server', 'not_configured');
      const format = { type: 'json_schema' as const, name, schema: jsonSchemaFor(schema), strict: false };
      let input = messages;
      for (let attempt = 0; attempt < 2; attempt++) {
        let raw: string;
        try {
          const response = await client.responses.create({
            model: env.OPENAI_MODEL,
            input,
            text: { format },
            ...(temperature !== undefined && env.OPENAI_SUPPORTS_TEMPERATURE ? { temperature } : {}),
          });
          raw = response.output_text ?? '';
        } catch (e) {
          throw mapError(e);
        }
        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(raw);
        } catch {
          parsedJson = undefined;
        }
        const result = schema.safeParse(parsedJson);
        if (result.success) return result.data;
        input = [
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
