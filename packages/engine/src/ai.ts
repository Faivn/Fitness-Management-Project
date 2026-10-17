import { z, type ZodType } from 'zod';

/**
 * The AI boundary used by the domain engine. A real provider (Groq on the
 * server) and the offline demo AI both implement `AiClient`; every result is
 * validated with Zod by the caller or the client, never trusted as-is.
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

export function jsonSchemaFor(schema: ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
}

/** Models sometimes wrap JSON in a code fence or add a stray sentence; take the outermost object. */
export function extractJsonObject(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
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
