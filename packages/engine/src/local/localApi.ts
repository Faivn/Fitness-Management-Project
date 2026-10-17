import { ZodError } from 'zod';
import { ApiError, validationError } from '../http/errors.js';
import { makeRequest } from '../http/router.js';
import { buildRoutes } from '../routes.js';
import type { AppContext } from '../context.js';
import type { AiClient } from '../ai.js';
import { createDemoAi } from './demoAi.js';
import { createLocalDatabase, LOCAL_USER_ID, type LocalDatabase, type StorageAdapter } from './localDb.js';
import { registerProcedures } from './rpc.js';
import { seedDemoData } from './seed.js';

export interface LocalApi {
  /** Same contract as the HTTP API: resolves with the JSON body or throws ApiError. */
  call<T = unknown>(method: string, path: string, body?: unknown): Promise<T>;
  /** Deletes everything and starts again (from sample data unless the API was created with `sample: false`). */
  reset(): Promise<void>;
  /** Resolves when the database is loaded (and seeded on first use). */
  ready: Promise<void>;
  database: LocalDatabase;
}

const routes = buildRoutes();

/**
 * The demo "backend": the same use cases the server runs, executed in the
 * browser against a local-storage database, with a deterministic demo
 * assistant instead of a live AI. No network, accounts or secrets.
 */
export function createLocalApi(opts: { storage: StorageAdapter; timezone: string; now?: () => Date; aiDelayMs?: number; sample?: boolean; ai?: AiClient }): LocalApi {
  const realNow = opts.now ?? (() => new Date());
  const ai = opts.ai ?? createDemoAi({ delayMs: opts.aiDelayMs ?? 0 });
  let database = createLocalDatabase({ storage: opts.storage, now: realNow });

  const api: LocalApi = {
    get database() {
      return database;
    },
    ready: Promise.resolve(),
    async call<T>(method: string, path: string, body?: unknown): Promise<T> {
      await api.ready;
      return run<T>(database, method, path, body);
    },
    async reset() {
      database.wipe();
      database = createLocalDatabase({ storage: opts.storage, now: realNow });
      api.ready = init();
      await api.ready;
    },
  };

  async function run<T>(db: LocalDatabase, method: string, rawPath: string, body?: unknown): Promise<T> {
    const [path = '', query = ''] = rawPath.split('?');
    const match = routes.match(method, path);
    if (match === null) throw new ApiError(404, 'not_found', 'Unknown endpoint.');
    if (match === 'method_not_allowed') throw new ApiError(405, 'method_not_allowed', 'Method not allowed.');
    const ctx: AppContext = { user: { id: LOCAL_USER_ID, email: null }, db: db.db, ai, now: () => db.core.now() };
    try {
      const result = await match.route.handler(makeRequest(ctx, match.params, new URLSearchParams(query), body));
      return (result === undefined ? null : JSON.parse(JSON.stringify(result))) as T;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      if (e instanceof ZodError) throw validationError(e);
      console.error('[mova local api]', method, path, e);
      throw new ApiError(500, 'server_error', 'Something went wrong. Nothing was changed.');
    }
  }

  async function init() {
    registerProcedures(database);
    if (!database.fresh) return;
    database.core.insert('profiles', { id: LOCAL_USER_ID, timezone: opts.timezone });
    const seedDb = database;
    // `sample: false` opens an empty workspace (only the profile): nothing is fabricated for a new person.
    if (opts.sample === false) {
      seedDb.flush();
      return;
    }
    await seedDemoData((m, p, b) => run(seedDb, m, p, b), (d) => seedDb.setClock(() => d), opts.timezone, realNow());
    seedDb.setClock(realNow);
    seedDb.flush();
  }

  api.ready = init();
  return api;
}
