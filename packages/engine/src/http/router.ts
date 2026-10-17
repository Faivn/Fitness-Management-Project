import type { ZodType } from 'zod';
import type { ApiErrorBody } from '@mova/shared';
import { ApiError, badRequest, validationError } from './errors.js';

export type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface RouteRequest<Ctx> {
  ctx: Ctx;
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
  /** Parse and validate the JSON body. */
  input<T>(schema: ZodType<T>): T;
  /** Parse and validate query parameters. */
  queryInput<T>(schema: ZodType<T>): T;
}

export type Handler<Ctx> = (req: RouteRequest<Ctx>) => Promise<unknown>;

interface Route<Ctx> {
  method: Method;
  parts: string[];
  handler: Handler<Ctx>;
  status: number;
}

/** Tiny path router: patterns like "routines/:id/versions". */
export class Router<Ctx> {
  private routes: Route<Ctx>[] = [];

  on(method: Method, pattern: string, handler: Handler<Ctx>, status = 200): this {
    this.routes.push({ method, parts: pattern.split('/').filter(Boolean), handler, status });
    return this;
  }

  match(method: string, path: string): { route: Route<Ctx>; params: Record<string, string> } | 'method_not_allowed' | null {
    const segs = path.split('/').filter(Boolean);
    let pathMatched = false;
    for (const route of this.routes) {
      if (route.parts.length !== segs.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < segs.length; i++) {
        const p = route.parts[i]!;
        const s = decodeURIComponent(segs[i]!);
        if (p.startsWith(':')) params[p.slice(1)] = s;
        else if (p !== s) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      pathMatched = true;
      if (route.method === method) return { route, params };
    }
    return pathMatched ? 'method_not_allowed' : null;
  }
}

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export function errorResponse(err: ApiError, headers: HeadersInit = {}): Response {
  const body: ApiErrorBody = { error: { code: err.code, message: err.message, details: err.details } };
  return json(body, err.status, headers);
}

export async function readJson(request: Request): Promise<unknown> {
  if (request.method === 'GET' || request.method === 'DELETE') return undefined;
  const text = await request.text();
  if (!text) return {};
  if (text.length > 200_000) throw new ApiError(413, 'payload_too_large', 'Request body is too large.');
  try {
    return JSON.parse(text);
  } catch {
    throw badRequest('Request body must be valid JSON.');
  }
}

export function makeRequest<Ctx>(ctx: Ctx, params: Record<string, string>, query: URLSearchParams, body: unknown): RouteRequest<Ctx> {
  return {
    ctx,
    params,
    query,
    body,
    input(schema) {
      const r = schema.safeParse(body ?? {});
      if (!r.success) throw validationError(r.error);
      return r.data;
    },
    queryInput(schema) {
      const r = schema.safeParse(Object.fromEntries(query.entries()));
      if (!r.success) throw validationError(r.error);
      return r.data;
    },
  };
}
