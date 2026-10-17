import type { ZodType } from 'zod';
import { ApiError } from './api';

/** Validate locally with the shared schema; returns errors keyed by field path. */
export function validate<T>(schema: ZodType<T>, value: unknown): { ok: true; data: T } | { ok: false; errors: Record<string, string> } {
  const r = schema.safeParse(value);
  if (r.success) return { ok: true, data: r.data };
  const errors: Record<string, string> = {};
  for (const i of r.error.issues) {
    const k = i.path.join('.');
    if (!errors[k]) errors[k] = i.message;
  }
  return { ok: false, errors };
}

export function serverFieldErrors(e: unknown, prefix = ''): Record<string, string> {
  if (!(e instanceof ApiError)) return {};
  return Object.fromEntries(Object.entries(e.fieldErrors).map(([k, v]) => [k.startsWith(prefix) ? k.slice(prefix.length) : k, v]));
}
