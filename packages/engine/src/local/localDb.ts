import type { Db } from '../context.js';
import { TABLES, type Row, type TableDef } from './tables.js';

/** Where the browser database is persisted (localStorage in the app, memory in tests). */
export interface StorageAdapter {
  load(): string | null;
  save(value: string): void;
  clear(): void;
}

export function memoryStorage(initial: string | null = null): StorageAdapter {
  let value = initial;
  return { load: () => value, save: (v) => void (value = v), clear: () => void (value = null) };
}

/** Bump when the stored shape changes; older data is replaced by fresh demo data. */
export const STORAGE_VERSION = 2; // 2: new people start with an empty workspace, so older sample-seeded data is dropped

export const LOCAL_USER_ID = '00000000-0000-4000-8000-000000000001';

export class DbError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type Tables = Record<string, Row[]>;
interface Persisted {
  version: number;
  tables: Tables;
}

export function uid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/[x]/g, () => Math.floor(Math.random() * 16).toString(16));
}

const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

/** Reads persisted data defensively: anything missing, corrupt or outdated yields null (→ fresh demo data). */
export function readPersisted(raw: string | null): Tables | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    if (parsed.version !== STORAGE_VERSION || !parsed.tables || typeof parsed.tables !== 'object') return null;
    const tables: Tables = {};
    for (const name of Object.keys(TABLES)) {
      const rows = parsed.tables[name];
      if (rows !== undefined && !Array.isArray(rows)) return null;
      tables[name] = (rows ?? []).filter((r) => r && typeof r === 'object');
    }
    return tables;
  } catch {
    return null;
  }
}

/** Low-level table access shared by the query builder and the stored procedures. */
export interface LocalCore {
  now(): Date;
  userId: string;
  rows(table: string): Row[];
  insert(table: string, values: Row): Row;
  update(table: string, match: (r: Row) => boolean, patch: Row): Row[];
  remove(table: string, match: (r: Row) => boolean): Row[];
}

export interface LocalDatabase {
  db: Db;
  core: LocalCore;
  /** Stored procedures (rpc.ts registers them). */
  procedures: Record<string, (args: Row) => unknown>;
  /** True when this database was created empty (nothing valid was stored). */
  fresh: boolean;
  setClock(now: () => Date): void;
  /** Writes pending changes to storage now. */
  flush(): void;
  /** Deletes everything, including the stored copy. */
  wipe(): void;
}

export function createLocalDatabase(opts: { storage: StorageAdapter; now?: () => Date; userId?: string }): LocalDatabase {
  const userId = opts.userId ?? LOCAL_USER_ID;
  let clock = opts.now ?? (() => new Date());
  const stored = readPersisted(opts.storage.load());
  const tables: Tables = stored ?? Object.fromEntries(Object.keys(TABLES).map((t) => [t, [] as Row[]]));
  let dirty = false;
  let scheduled = false;

  function flush() {
    scheduled = false;
    if (!dirty) return;
    dirty = false;
    try {
      opts.storage.save(JSON.stringify({ version: STORAGE_VERSION, tables } satisfies Persisted));
    } catch {
      // Storage may be full or blocked (private mode): the session keeps working in memory.
    }
  }
  function changed() {
    dirty = true;
    if (!scheduled) {
      scheduled = true;
      void Promise.resolve().then(flush);
    }
  }

  const def = (table: string): TableDef => {
    const d = TABLES[table];
    if (!d) throw new DbError('42P01', `relation "${table}" does not exist`);
    return d;
  };
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

  // Rows written in the same millisecond must still sort in the order they were written
  // (a conversation's user message and its reply, for instance).
  let lastMs = 0;
  function stamp(): string {
    let t = clock().getTime();
    if (t <= lastMs && lastMs - t < 60_000) t = lastMs + 1; // a larger step back is deliberate time travel (seeding)
    lastMs = t;
    return new Date(t).toISOString();
  }

  function checkUnique(table: string, d: TableDef, candidate: Row, ignore?: Row) {
    const others = tables[table]!.filter((r) => r !== ignore);
    for (const cols of d.unique ?? []) {
      if (cols.some((c) => candidate[c] === null || candidate[c] === undefined)) continue;
      if (others.some((r) => cols.every((c) => same(r[c], candidate[c])))) throw new DbError('23505', `duplicate key value violates unique constraint on (${cols.join(', ')})`);
    }
    for (const u of d.uniqueWhere ?? []) {
      if (!u.where(candidate)) continue;
      if (others.some((r) => u.where(r) && u.cols.every((c) => same(r[c], candidate[c])))) throw new DbError('23505', `duplicate key value violates unique index on (${u.cols.join(', ')})`);
    }
    if (d.pk) {
      if (others.some((r) => d.pk!.every((c) => same(r[c], candidate[c])))) throw new DbError('23505', 'duplicate primary key');
    }
  }

  /** Rules the database enforces with check constraints and triggers. */
  function checkRules(table: string, next: Row, prev?: Row) {
    if (table === 'workout_sessions') {
      if ((next.original_planned_date === null) !== (next.planned_date === null)) throw new DbError('23514', 'planned_dates_consistent');
      if (next.planned_date === null && !['spontaneous', 'historical_entry'].includes(next.source)) throw new DbError('23514', 'unplanned_is_actual');
      if (next.status === 'completed' && !next.actual_date) throw new DbError('23514', 'completed_has_evidence');
      if (next.actual_distance_value !== null && next.actual_distance_value !== undefined && !next.actual_distance_unit) throw new DbError('23514', 'distance_has_unit');
      if (prev) {
        if (prev.original_planned_date !== next.original_planned_date) throw new DbError('23514', 'original_planned_date is immutable');
        if (prev.status === 'completed' && next.status !== 'completed') throw new DbError('23514', 'a completed session cannot change status');
      }
    }
    if (table === 'exercise_logs' && next.actual_weight !== null && next.actual_weight !== undefined && !next.weight_unit) throw new DbError('23514', 'weight_has_unit');
    if (table === 'fasting_sessions' && next.ended_at && next.ended_at <= next.started_at) throw new DbError('23514', 'ended_at must be after started_at');
  }

  const core: LocalCore = {
    now: () => clock(),
    userId,
    rows: (table) => tables[table] ?? (def(table), []),
    insert(table, values) {
      const d = def(table);
      const at = stamp();
      const row: Row = {};
      if (!d.pk) row.id = uid();
      Object.assign(row, clone(d.defaults ?? {}));
      for (const c of d.timestamps ?? []) row[c] = at;
      Object.assign(row, clone(values));
      for (const k of Object.keys(row)) if (row[k] === undefined) row[k] = null;
      checkRules(table, row);
      checkUnique(table, d, row);
      tables[table]!.push(row);
      changed();
      return clone(row);
    },
    update(table, match, patch) {
      const d = def(table);
      const targets = tables[table]!.filter(match);
      const updated: Row[] = [];
      const staged = targets.map((row) => {
        const next = { ...row, ...clone(patch) };
        if (d.touch) next[d.touch] = stamp();
        for (const k of Object.keys(next)) if (next[k] === undefined) next[k] = null;
        checkRules(table, next, row);
        checkUnique(table, d, next, row);
        return { row, next };
      });
      for (const { row, next } of staged) {
        Object.assign(row, next);
        updated.push(clone(row));
      }
      if (updated.length) changed();
      return updated;
    },
    remove(table, match) {
      def(table);
      const removed = tables[table]!.filter(match);
      if (removed.length) {
        tables[table] = tables[table]!.filter((r) => !removed.includes(r));
        changed();
      }
      return removed.map(clone);
    },
  };

  const database: LocalDatabase = {
    db: undefined as unknown as Db,
    core,
    procedures: {},
    fresh: stored === null,
    setClock(now) {
      clock = now;
    },
    flush,
    wipe() {
      for (const t of Object.keys(tables)) tables[t] = [];
      dirty = false;
      opts.storage.clear();
    },
  };

  // --- supabase-js compatible query builder -------------------------------

  type Result = { data: any; error: { code?: string; message?: string } | null }; // eslint-disable-line @typescript-eslint/no-explicit-any

  class Query implements PromiseLike<Result> {
    private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' | null = null;
    private cols = '*';
    private returning: string | null = null;
    private values: Row[] = [];
    private onConflict: string[] | null = null;
    private filters: Array<(r: Row) => boolean> = [];
    private orders: Array<{ col: string; asc: boolean }> = [];
    private limitN: number | null = null;
    private singleMode: 'single' | 'maybe' | null = null;

    constructor(private readonly table: string) {}

    select(cols = '*') {
      if (this.op === null) {
        this.op = 'select';
        this.cols = cols;
      } else this.returning = cols;
      return this;
    }
    insert(v: Row | Row[]) {
      this.op = 'insert';
      this.values = Array.isArray(v) ? v : [v];
      return this;
    }
    upsert(v: Row | Row[], o: { onConflict?: string } = {}) {
      this.op = 'upsert';
      this.values = Array.isArray(v) ? v : [v];
      this.onConflict = (o.onConflict ?? 'id').split(',').map((c) => c.trim());
      return this;
    }
    update(v: Row) {
      this.op = 'update';
      this.values = [v];
      return this;
    }
    delete() {
      this.op = 'delete';
      return this;
    }
    private f(fn: (r: Row) => boolean) {
      this.filters.push(fn);
      return this;
    }
    eq(c: string, v: unknown) {
      return this.f((r) => same(r[c] ?? null, v ?? null));
    }
    neq(c: string, v: unknown) {
      return this.f((r) => !same(r[c] ?? null, v ?? null));
    }
    gt(c: string, v: any) { return this.f((r) => r[c] != null && r[c] > v); } // eslint-disable-line @typescript-eslint/no-explicit-any
    gte(c: string, v: any) { return this.f((r) => r[c] != null && r[c] >= v); } // eslint-disable-line @typescript-eslint/no-explicit-any
    lt(c: string, v: any) { return this.f((r) => r[c] != null && r[c] < v); } // eslint-disable-line @typescript-eslint/no-explicit-any
    lte(c: string, v: any) { return this.f((r) => r[c] != null && r[c] <= v); } // eslint-disable-line @typescript-eslint/no-explicit-any
    in(c: string, vs: unknown[]) {
      return this.f((r) => vs.some((v) => same(r[c], v)));
    }
    is(c: string, v: null | boolean) {
      return this.f((r) => (v === null ? r[c] === null || r[c] === undefined : r[c] === v));
    }
    not(c: string, op: string, v: unknown) {
      if (op !== 'is' || v !== null) throw new Error('not() only supports (col, "is", null)');
      return this.f((r) => r[c] !== null && r[c] !== undefined);
    }
    order(c: string, o: { ascending?: boolean } = {}) {
      this.orders.push({ col: c, asc: o.ascending !== false });
      return this;
    }
    limit(n: number) {
      this.limitN = n;
      return this;
    }
    maybeSingle() {
      this.singleMode = 'maybe';
      return this;
    }
    single() {
      this.singleMode = 'single';
      return this;
    }

    private project(rows: Row[], cols: string): Row[] {
      if (cols.trim() === '*') return rows.map(clone);
      const names = cols.split(',').map((c) => c.trim());
      return rows.map((r) => Object.fromEntries(names.map((n) => [n, clone(r[n] ?? null)])));
    }

    private run(): Result {
      const match = (r: Row) => this.filters.every((fn) => fn(r));
      let rows: Row[];
      switch (this.op) {
        case 'select': {
          rows = core.rows(this.table).filter(match);
          for (const { col, asc } of [...this.orders].reverse()) {
            rows = [...rows].sort((a, b) => {
              const x = a[col] ?? null;
              const y = b[col] ?? null;
              if (x === y) return 0;
              if (x === null) return 1;
              if (y === null) return -1;
              return (x < y ? -1 : 1) * (asc ? 1 : -1);
            });
          }
          if (this.limitN !== null) rows = rows.slice(0, this.limitN);
          rows = this.project(rows, this.cols);
          break;
        }
        case 'insert':
          rows = this.values.map((v) => core.insert(this.table, v));
          break;
        case 'upsert': {
          const conflict = this.onConflict!;
          rows = this.values.map((v) => {
            const existing = core.rows(this.table).find((r) => conflict.every((c) => same(r[c], v[c])));
            return existing ? core.update(this.table, (r) => r === existing, v)[0]! : core.insert(this.table, v);
          });
          break;
        }
        case 'update':
          rows = core.update(this.table, match, this.values[0]!);
          break;
        case 'delete':
          rows = core.remove(this.table, match);
          break;
        default:
          throw new Error('No operation');
      }
      if (this.op !== 'select') rows = this.returning ? this.project(rows, this.returning) : [];
      if (this.singleMode) {
        if (rows.length > 1) return { data: null, error: { code: 'PGRST116', message: 'multiple rows returned' } };
        if (rows.length === 0 && this.singleMode === 'single') return { data: null, error: { code: 'PGRST116', message: 'no rows returned' } };
        return { data: rows[0] ?? null, error: null };
      }
      return { data: this.op === 'select' || this.returning ? rows : null, error: null };
    }

    execute(): Result {
      try {
        return this.run();
      } catch (e) {
        if (e instanceof DbError) return { data: null, error: { code: e.code, message: e.message } };
        throw e;
      }
    }

    then<A = Result, B = never>(
      onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
      onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
    ): PromiseLike<A | B> {
      return Promise.resolve().then(() => this.execute()).then(onfulfilled, onrejected);
    }
  }
  database.db = {
    from: (table: string) => new Query(table),
    rpc: (fn: string, args: Record<string, unknown> = {}) =>
      Promise.resolve().then<Result>(() => {
        const proc = database.procedures[fn];
        if (!proc) return { data: null, error: { code: '42883', message: `function ${fn} does not exist` } };
        // One call = one transaction: undo partial writes if anything fails.
        const snapshot = clone(tables);
        try {
          return { data: clone(proc(args)), error: null };
        } catch (e) {
          for (const t of Object.keys(snapshot)) tables[t] = snapshot[t]!;
          changed();
          if (e instanceof DbError) return { data: null, error: { code: e.code, message: e.message } };
          throw e;
        }
      }),
  };
  return database;
}
