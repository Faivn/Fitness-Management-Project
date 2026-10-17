import { fromDbError, notFound } from '../http/errors.js';

interface DbResult {
  data: unknown;
  error: { code?: string; message?: string } | null;
}

/**
 * Rows are untyped until generated Supabase types are added (see
 * docs/ARCHITECTURE_DECISIONS.md); mappers convert them to typed DTOs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbRow = any;

/** Unwrap a Supabase result or throw a safe ApiError. */
export async function must(query: PromiseLike<DbResult>): Promise<DbRow> {
  const { data, error } = await query;
  if (error) throw fromDbError(error);
  return data;
}

/** Unwrap a single-row result; throws 404 when missing. */
export async function mustOne(query: PromiseLike<DbResult>, what: string): Promise<DbRow> {
  const { data, error } = await query;
  if (error) throw fromDbError(error);
  if (data === null || data === undefined) throw notFound(what);
  return data;
}

export function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Postgres `time` → "HH:MM". */
export function hhmm(v: unknown): string | null {
  if (typeof v !== 'string' || v.length < 5) return null;
  return v.slice(0, 5);
}
