import type { ApiErrorBody } from '@mova/shared';
import { randomUUID } from 'expo-crypto';
import { SampleWriteError, sampleApi } from '@/sample/sampleApi';
import { config, sampleMode } from './config';
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

/** AI-backed endpoints can legitimately take longer than ordinary reads and writes. */
function timeoutFor(path: string): number {
  return /^(ai\/|routine-proposals|meal-plan-proposals|monthly-reviews\/generate)/.test(path) ? 70_000 : 25_000;
}

export async function api<T>(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  if (sampleMode) {
    try {
      return await sampleApi<T>(method, path);
    } catch (e) {
      if (e instanceof SampleWriteError) {
        throw new ApiError(
          403,
          'sample_preview',
          "This is a read-only preview with sample data, so changes aren't saved and the AI isn't connected. Everything you can see works the same way once Mova is connected to its backend.",
        );
      }
      throw new ApiError(404, 'not_found', "This part of the sample preview doesn't have sample data.");
    }
  }
  const t = await token();
  if (!t) throw new ApiError(401, 'unauthorized', 'Sign in to continue.');
  let res: Response;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutFor(path));
  try {
    res = await fetch(`${config.apiUrl}/api/v1/${path}`, {
      method,
      signal: controller.signal,
      headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json', accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new ApiError(0, 'timeout', 'Mova took too long to respond. Nothing you entered has been lost — try again.');
    }
    throw new ApiError(0, 'network', "Couldn't reach Mova. Check your connection — nothing you entered has been lost.");
  } finally {
    clearTimeout(timer);
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
