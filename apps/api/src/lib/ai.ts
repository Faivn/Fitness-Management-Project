import { z, type ZodType } from 'zod';
import type { Env } from '../config/env.js';

/**
 * Server-side AI client: Groq through its OpenAI-compatible Chat Completions
 * API (`{GROQ_BASE_URL}/chat/completions`) with Structured Outputs.
 *
 * - The API key is read only from server env, sent only in the Authorization
 *   header to the configured base URL, and never logged, returned or
 *   included in error messages.
 * - Requests ask for `json_schema` output and the reply is ALWAYS
 *   re-validated with Zod: model output is untrusted (spec §7.4).
 * - One repair attempt is made when the output does not match the schema.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type AiFailureReason =
  | 'not_configured'
  | 'timeout'
  | 'rate_limited'
  | 'auth_failed'
  | 'provider_error'
  | 'invalid_output';

export class AiUnavailableError extends Error {
  constructor(
    message: string,
    readonly reason: AiFailureReason,
  ) {
    super(message);
    this.name = 'AiUnavailableError';
  }
}

export interface AiClient {
  readonly configured: boolean;
  /**
   * `onText` makes the request stream: it receives the raw JSON text produced so
   * far. The final result is still validated with Zod, exactly as without it.
   */
  structured<T>(opts: { name: string; schema: ZodType<T>; messages: ChatMessage[]; temperature?: number; onText?: (soFar: string) => void }): Promise<T>;
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export function jsonSchemaFor(schema: ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
}

interface ChatCompletion {
  choices?: Array<{ message?: { content?: string | null }; finish_reason?: string | null }>;
}

function streamInstruction(jsonSchema: Record<string, unknown>): string {
  return `Reply with ONLY one JSON object (no markdown, no code fences, no text outside it) that matches this JSON Schema. Write the "reply" property FIRST.\n${JSON.stringify(jsonSchema)}`;
}

/** Models sometimes wrap JSON in a code fence or add a stray sentence; take the outermost object. */
export function extractJsonObject(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}

/** Reads an OpenAI-compatible chat-completion event stream, reporting the text accumulated so far. */
async function readStream(body: ReadableStream<Uint8Array>, onText: (soFar: string) => void): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const chunk = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string | null } }> };
          const piece = chunk.choices?.[0]?.delta?.content;
          if (piece) {
            text += piece;
            onText(text);
          }
        } catch {
          // Ignore a malformed keep-alive/partial line; the final text is validated anyway.
        }
      }
    }
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    throw new AiUnavailableError(aborted ? 'AI request timed out' : 'AI provider stream failed', aborted ? 'timeout' : 'provider_error');
  }
  return text;
}

export function createGroqClient(env: Env, fetchImpl: FetchLike = fetch): AiClient {
  const apiKey = env.GROQ_API_KEY;
  const endpoint = `${env.GROQ_BASE_URL.replace(/\/+$/, '')}/chat/completions`;

  async function call(messages: ChatMessage[], name: string, jsonSchema: Record<string, unknown>, temperature: number | undefined, onText?: (soFar: string) => void) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.GROQ_TIMEOUT_MS);
    try {
      let res: Response;
      try {
        res = await fetchImpl(endpoint, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: env.GROQ_MODEL,
            // Groq buffers the whole reply when a response_format is set, so token streaming
            // is only possible without one: the schema goes in the prompt and the result is
            // validated with Zod afterwards (with a schema-enforced retry if it does not match).
            messages: onText ? [...messages, { role: 'system', content: streamInstruction(jsonSchema) }] : messages,
            ...(temperature !== undefined ? { temperature } : {}),
            ...(onText ? { stream: true } : { response_format: { type: 'json_schema', json_schema: { name, strict: false, schema: jsonSchema } } }),
          }),
        });
      } catch (e) {
        const aborted = e instanceof Error && e.name === 'AbortError';
        throw new AiUnavailableError(aborted ? 'AI request timed out' : 'AI provider unreachable', aborted ? 'timeout' : 'provider_error');
      }
      if (res.status === 401 || res.status === 403) throw new AiUnavailableError('AI provider rejected the server credentials', 'auth_failed');
      if (res.status === 429) throw new AiUnavailableError('AI provider rate limit reached', 'rate_limited');
      // A 400 in best-effort mode can mean the model produced output that failed schema validation upstream.
      if (res.status === 400) throw new AiUnavailableError('AI provider rejected the request', 'invalid_output');
      if (!res.ok) throw new AiUnavailableError(`AI provider returned ${res.status}`, 'provider_error');
      if (onText && res.body) return await readStream(res.body, onText);
      let body: ChatCompletion;
      try {
        body = (await res.json()) as ChatCompletion;
      } catch {
        throw new AiUnavailableError('AI provider returned an unreadable response', 'provider_error');
      }
      return body.choices?.[0]?.message?.content ?? '';
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    configured: Boolean(apiKey),
    async structured({ name, schema, messages, temperature = 0.4, onText }) {
      if (!apiKey) throw new AiUnavailableError('AI is not configured on the server', 'not_configured');
      const jsonSchema = jsonSchemaFor(schema);
      let convo = messages;
      for (let attempt = 0; attempt < 2; attempt++) {
        let raw: string;
        try {
          raw = await call(convo, name, jsonSchema, temperature, attempt === 0 ? onText : undefined);
        } catch (e) {
          if (e instanceof AiUnavailableError && e.reason === 'invalid_output' && attempt === 0) continue;
          throw e;
        }
        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(extractJsonObject(raw));
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

/**
 * Pulls the (possibly unfinished) value of the top-level string field `key`
 * out of partially streamed JSON, decoding escapes. Returns '' until the key
 * has started. Used to show the reply while the rest of the JSON is arriving.
 */
export function partialJsonString(json: string, key: string): string {
  const m = new RegExp(`"${key}"\\s*:\\s*"`).exec(json);
  if (!m) return '';
  let out = '';
  for (let i = m.index + m[0].length; i < json.length; i++) {
    const c = json[i]!;
    if (c === '"') break;
    if (c !== '\\') {
      out += c;
      continue;
    }
    const n = json[i + 1];
    if (n === undefined) break; // escape not complete yet
    if (n === 'u') {
      const hex = json.slice(i + 2, i + 6);
      if (hex.length < 4) break;
      out += String.fromCharCode(parseInt(hex, 16));
      i += 5;
    } else {
      out += ({ n: '\n', t: '\t', r: '\r', b: '\b', f: '\f' } as Record<string, string>)[n] ?? n;
      i += 1;
    }
  }
  return out;
}
