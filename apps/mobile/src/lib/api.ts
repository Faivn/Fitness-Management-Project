import { ApiError as EngineApiError, createLocalApi, type LocalApi } from '@mova/engine';
import { randomUUID } from 'expo-crypto';
import { deviceTimeZone } from './format';
import { openDemoStorage } from './storage';

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

/**
 * Data layer. The app talks to ONE function, `api(method, path, body)`, with the
 * same routes and JSON contracts a server would expose. Today it is served by
 * the local demo engine (browser storage, no network or accounts). To bring a
 * backend back, replace `local()` below with a `fetch` to it — no screen changes.
 */
let instance: Promise<LocalApi> | null = null;
function local(): Promise<LocalApi> {
  instance ??= openDemoStorage().then((storage) => createLocalApi({ storage, timezone: deviceTimeZone(), aiDelayMs: 700, sample: false }));
  return instance;
}

/** One key per user intent; reuse it when retrying the same action. */
export function newIdempotencyKey(): string {
  return randomUUID();
}

export async function api<T>(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const demo = await local();
  try {
    return await demo.call<T>(method, path, body);
  } catch (e) {
    if (e instanceof EngineApiError) throw new ApiError(e.status, e.code, e.message, e.details);
    throw e;
  }
}

/** Deletes everything stored on this device and starts again with an empty workspace. */
export async function resetDemo(): Promise<void> {
  const demo = await local();
  await demo.reset();
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong.';
}
