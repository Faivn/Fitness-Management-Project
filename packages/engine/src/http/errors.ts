import type { ZodError } from 'zod';

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
}

export const unauthorized = (msg = 'Sign in to continue.') => new ApiError(401, 'unauthorized', msg);
export const notFound = (what = 'Record') => new ApiError(404, 'not_found', `${what} not found.`);
export const conflict = (msg: string, details?: unknown) => new ApiError(409, 'conflict', msg, details);
export const badRequest = (msg: string, details?: unknown) => new ApiError(400, 'bad_request', msg, details);
export const unprocessable = (msg: string, details?: unknown) => new ApiError(422, 'invalid_state', msg, details);
export const aiUnavailable = (msg = 'The AI companion is unavailable right now. Your input has been kept — try again shortly.') =>
  new ApiError(503, 'ai_unavailable', msg);

export function validationError(error: ZodError): ApiError {
  return new ApiError(
    400,
    'validation_failed',
    'Some fields need attention.',
    error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  );
}

/**
 * Map Postgres / PostgREST errors raised by RPCs and constraints to safe API
 * errors. Raw database messages are only passed through for our own,
 * user-facing RAISE EXCEPTION texts.
 */
export function fromDbError(err: { code?: string; message?: string } | null | undefined): ApiError {
  const code = err?.code ?? '';
  const message = err?.message ?? 'Database error';
  switch (code) {
    case 'P0002':
      return new ApiError(404, 'not_found', capitalise(message));
    case 'P0001':
      return unprocessable(capitalise(message));
    case '40001':
      return conflict(capitalise(message));
    case '23505':
      return conflict('This record already exists.');
    case '23514':
      return unprocessable('That change would break a data rule.', { constraint: message });
    case '42501':
      return new ApiError(403, 'forbidden', 'You do not have access to this record.');
    case '28000':
    case 'PGRST301':
      return unauthorized();
    default:
      return new ApiError(500, 'server_error', 'Something went wrong while saving. Nothing was changed.');
  }
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1) + (s.endsWith('.') ? '' : '.');
}
