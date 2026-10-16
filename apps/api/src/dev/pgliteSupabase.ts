/**
 * DEVELOPMENT AND TEST ONLY — never imported by the deployed function
 * (api/router.ts). A tiny stand-in for the subset of the supabase-js query
 * builder the API uses, executed against an embedded Postgres (PGlite) that
 * has the real migrations applied. Every statement runs inside a transaction
 * as the `authenticated` role with the caller's user id, so Row Level
 * Security, triggers, constraints and RPCs behave as they do in Supabase.
 */
import { PGlite, types } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';

const IDENT = /^[a-z_][a-z0-9_]*$/;

function ident(name: string): string {
  if (!IDENT.test(name)) throw new Error(`Unsafe identifier in test client: ${name}`);
  return `"${name}"`;
}

type ColumnInfo = Map<string, { dataType: string }>;

const SUPABASE_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../supabase');

/**
 * Create an embedded Postgres with the real migrations applied. With a
 * `dataDir` the database persists on disk and migrations run only once.
 */
export async function createTestDatabase(opts: { dataDir?: string } = {}): Promise<{ db: PGlite; columns: Map<string, ColumnInfo>; fresh: boolean }> {
  const db = new PGlite({
    dataDir: opts.dataDir,
    parsers: {
      [types.DATE]: (v: string) => v,
      [types.TIMESTAMPTZ]: (v: string) => new Date(v).toISOString(),
      [types.NUMERIC]: (v: string) => Number(v),
    },
  });
  const root = SUPABASE_DIR;
  const existing = await db.query<{ exists: boolean }>(`select to_regclass('public.workout_sessions') is not null as exists`);
  const fresh = !existing.rows[0]?.exists;
  if (fresh) {
    await db.exec(readFileSync(join(root, 'tests/supabase-stubs.sql'), 'utf8'));
    for (const f of readdirSync(join(root, 'migrations')).filter((x) => x.endsWith('.sql')).sort()) {
      await db.exec(readFileSync(join(root, 'migrations', f), 'utf8'));
    }
  }
  const rows = await db.query<{ table_name: string; column_name: string; data_type: string }>(
    `select table_name, column_name, data_type from information_schema.columns where table_schema = 'public'`,
  );
  const columns = new Map<string, ColumnInfo>();
  for (const r of rows.rows) {
    const t = columns.get(r.table_name) ?? new Map();
    t.set(r.column_name, { dataType: r.data_type });
    columns.set(r.table_name, t);
  }
  return { db, columns, fresh };
}

function pgArrayLiteral(values: unknown[]): string {
  return `{${values.map((v) => (v === null ? 'NULL' : `"${String(v).replace(/(["\\])/g, '\\$1')}"`)).join(',')}}`;
}

interface Filter {
  sql: (p: (v: unknown) => string) => string;
}

class Query implements PromiseLike<{ data: any; error: any }> {
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' | null = null;
  private columnsSel = '*';
  private returning: string | null = null;
  private values: Record<string, unknown>[] = [];
  private onConflict: string | null = null;
  private filters: Filter[] = [];
  private orders: string[] = [];
  private limitN: number | null = null;
  private singleMode: 'single' | 'maybe' | null = null;

  constructor(
    private readonly client: PgTestClient,
    private readonly table: string,
  ) {}

  select(cols = '*') {
    if (this.op === null) {
      this.op = 'select';
      this.columnsSel = cols;
    } else this.returning = cols;
    return this;
  }
  insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    this.op = 'insert';
    this.values = Array.isArray(values) ? values : [values];
    return this;
  }
  upsert(values: Record<string, unknown> | Record<string, unknown>[], opts: { onConflict?: string } = {}) {
    this.op = 'upsert';
    this.values = Array.isArray(values) ? values : [values];
    this.onConflict = opts.onConflict ?? null;
    return this;
  }
  update(values: Record<string, unknown>) {
    this.op = 'update';
    this.values = [values];
    return this;
  }
  delete() {
    this.op = 'delete';
    return this;
  }
  private cmp(col: string, opSql: string, v: unknown) {
    this.filters.push({ sql: (p) => `${ident(col)} ${opSql} ${p(v)}` });
    return this;
  }
  eq(c: string, v: unknown) {
    return this.cmp(c, '=', v);
  }
  neq(c: string, v: unknown) {
    return this.cmp(c, '<>', v);
  }
  gt(c: string, v: unknown) {
    return this.cmp(c, '>', v);
  }
  gte(c: string, v: unknown) {
    return this.cmp(c, '>=', v);
  }
  lt(c: string, v: unknown) {
    return this.cmp(c, '<', v);
  }
  lte(c: string, v: unknown) {
    return this.cmp(c, '<=', v);
  }
  in(c: string, vs: unknown[]) {
    if (vs.length === 0) this.filters.push({ sql: () => 'false' });
    else this.filters.push({ sql: (p) => `${ident(c)} in (${vs.map((v) => p(v)).join(', ')})` });
    return this;
  }
  is(c: string, v: null | boolean) {
    this.filters.push({ sql: () => `${ident(c)} is ${v === null ? 'null' : v ? 'true' : 'false'}` });
    return this;
  }
  not(c: string, op: string, v: unknown) {
    if (op !== 'is' || v !== null) throw new Error('test client only supports not(col, "is", null)');
    this.filters.push({ sql: () => `${ident(c)} is not null` });
    return this;
  }
  order(c: string, opts: { ascending?: boolean } = {}) {
    this.orders.push(`${ident(c)} ${opts.ascending === false ? 'desc' : 'asc'} nulls last`);
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

  private cols(list: string): string {
    return list.trim() === '*' ? '*' : list.split(',').map((c) => ident(c.trim())).join(', ');
  }

  private build(): { sql: string; params: unknown[] } {
    const params: unknown[] = [];
    const info = this.client.columns.get(this.table);
    const p = (v: unknown, col?: string) => {
      const type = col ? info?.get(col)?.dataType : undefined;
      let value = v;
      if (type === 'jsonb' && v !== null && v !== undefined) value = JSON.stringify(v);
      else if (type === 'ARRAY' && Array.isArray(v)) value = pgArrayLiteral(v);
      params.push(value === undefined ? null : value);
      return `$${params.length}`;
    };
    const whereSql = () => (this.filters.length ? ` where ${this.filters.map((f) => f.sql((v) => p(v))).join(' and ')}` : '');
    const ret = this.returning ? ` returning ${this.cols(this.returning)}` : '';
    const t = `public.${ident(this.table)}`;
    switch (this.op) {
      case 'select': {
        const order = this.orders.length ? ` order by ${this.orders.join(', ')}` : '';
        const limit = this.limitN !== null ? ` limit ${Number(this.limitN)}` : '';
        return { sql: `select ${this.cols(this.columnsSel)} from ${t}${whereSql()}${order}${limit}`, params };
      }
      case 'insert':
      case 'upsert': {
        const keys = [...new Set(this.values.flatMap((v) => Object.keys(v)))];
        const rows = this.values.map((v) => `(${keys.map((k) => (k in v ? p(v[k], k) : 'default')).join(', ')})`);
        let sql = `insert into ${t} (${keys.map(ident).join(', ')}) values ${rows.join(', ')}`;
        if (this.op === 'upsert') {
          const conflictCols = (this.onConflict ?? 'id').split(',').map((c) => c.trim());
          const updates = keys.filter((k) => !conflictCols.includes(k)).map((k) => `${ident(k)} = excluded.${ident(k)}`);
          sql += ` on conflict (${conflictCols.map(ident).join(', ')}) do ${updates.length ? `update set ${updates.join(', ')}` : 'nothing'}`;
        }
        return { sql: sql + ret, params };
      }
      case 'update': {
        const v = this.values[0]!;
        const sets = Object.keys(v).map((k) => `${ident(k)} = ${p(v[k], k)}`);
        return { sql: `update ${t} set ${sets.join(', ')}${whereSql()}${ret}`, params };
      }
      case 'delete':
        return { sql: `delete from ${t}${whereSql()}${ret}`, params };
      default:
        throw new Error('No operation');
    }
  }

  async execute(): Promise<{ data: any; error: any }> {
    try {
      const { sql, params } = this.build();
      const rows = await this.client.run(sql, params);
      if (this.singleMode) {
        if (rows.length > 1) return { data: null, error: { code: 'PGRST116', message: 'multiple rows' } };
        if (rows.length === 0 && this.singleMode === 'single') return { data: null, error: { code: 'PGRST116', message: 'no rows' } };
        return { data: rows[0] ?? null, error: null };
      }
      return { data: this.op === 'select' || this.returning ? rows : null, error: null };
    } catch (e: any) {
      return { data: null, error: { code: e.code, message: e.message } };
    }
  }

  then<A = { data: any; error: any }, B = never>(
    onfulfilled?: ((value: { data: any; error: any }) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export class PgTestClient {
  constructor(
    readonly db: PGlite,
    readonly columns: Map<string, ColumnInfo>,
    readonly userId: string,
  ) {}

  async run(sql: string, params: unknown[]): Promise<any[]> {
    return this.db.transaction(async (tx) => {
      await tx.query(`set local role authenticated`);
      await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [this.userId]);
      const res = await tx.query(sql, params);
      return res.rows as any[];
    });
  }

  from(table: string) {
    return new Query(this, table);
  }

  async rpc(fn: string, args: Record<string, unknown>) {
    try {
      const names = Object.keys(args);
      const params = names.map((n) => {
        const v = args[n];
        return v !== null && typeof v === 'object' ? JSON.stringify(v) : v ?? null;
      });
      const sql = `select public.${ident(fn)}(${names.map((n, i) => `${ident(n)} => $${i + 1}`).join(', ')}) as result`;
      const rows = await this.run(sql, params);
      return { data: rows[0]?.result ?? null, error: null };
    } catch (e: any) {
      return { data: null, error: { code: e.code, message: e.message } };
    }
  }

  asSupabase(): SupabaseClient {
    return this as unknown as SupabaseClient;
  }
}
