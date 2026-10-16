import type { ApiErrorBody } from '@mova/shared';
import { randomUUID } from 'expo-crypto';
import { config } from './config';
import { supabase } from './supabase';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field-level validation messages keyed by path. */
  get fieldErrors(): Record<string, string> {
    if (this.code !== 'validation_failed' || !Array.isArray(this.details)) return {};
    return Object.fromEntries((this.details as Array<{ path: string; message: string }>).map((d) => [d.path, d.message]));
  }
}

/** One key per user intent; reuse it when retrying the same action. */
export function newIdempotencyKey(): string {
  return randomUUID();
}

async function token(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function api<T>(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const t = await token();
  if (!t) throw new ApiError(401, 'unauthorized', 'Sign in to continue.');
  let res: Response;
  try {
    res = await fetch(`${config.apiUrl}/api/v1/${path}`, {
      method,
      headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json', accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network', "Couldn't reach Mova. Check your connection — nothing you entered has been lost.");
  }
  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const err = (json as ApiErrorBody | null)?.error;
    if (res.status === 401) await supabase.auth.refreshSession().catch(() => undefined);
    throw new ApiError(res.status, err?.code ?? 'server_error', err?.message ?? 'Something went wrong.', err?.details);
  }
  return json as T;
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong.';
}
