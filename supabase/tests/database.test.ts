/**
 * Runs the real migrations in an embedded Postgres (PGlite) and checks the
 * history-integrity, RLS and idempotency guarantees from the specification.
 * Run with: npm run test:db
 */
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { generateOccurrences, type RoutinePlan } from '@mova/shared';

const ROOT = join(__dirname, '..');
const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';

let db: PGlite;

async function asUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

async function rpc<T = Record<string, unknown>>(fn: string, args: Record<string, unknown>): Promise<T> {
  const names = Object.keys(args);
  const sql = `select public.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as result`;
  const rows = await q<{ result: T }>(sql, names.map((n) => args[n]));
  return rows[0]!.result;
}

const plan: RoutinePlan = {
  title: 'Upper / lower',
  goalIds: [],
  assumptions: [],
  warnings: [],
  sessions: [
    {
      title: 'Upper body',
      activityType: 'strength',
      dayOfWeek: 1,
      startTime: '07:00',
      durationMinutes: 60,
      exercises: [
        { name: 'Bench press', targetSets: 3, repsMin: 8, repsMax: 10, targetWeight: 60, weightUnit: 'kg' },
        { name: 'Row', targetSets: 3, repsMin: 10, repsMax: 12 },
      ],
    },
    { title: 'Easy run', activityType: 'running', dayOfWeek: 3, exercises: [] },
  ],
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync(join(ROOT, 'tests/supabase-stubs.sql'), 'utf8'));
  const migrations = readdirSync(join(ROOT, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
  for (const m of migrations) await db.exec(readFileSync(join(ROOT, 'migrations', m), 'utf8'));
  await db.exec(`insert into auth.users (id, email) values ('${U1}', 'one@example.test'), ('${U2}', 'two@example.test');`);
}, 60_000);

async function createProposal(userId: string, overrides: Partial<{ mode: string; target: string | null }> = {}) {
  return asUser(userId, async () => {
    const rows = await q<{ id: string }>(
      `insert into public.routine_proposals (user_id, status, version, mode, target_routine_id, plan)
       values ($1, 'draft', 1, $2, $3, $4) returning id`,
      [userId, overrides.mode ?? 'new', overrides.target ?? null, JSON.stringify(plan)],
    );
    return rows[0]!.id;
  });
}

describe('profiles', () => {
  it('creates a profile for each new auth user', async () => {
    const rows = await q(`select id from public.profiles order by id`);
    expect(rows).toHaveLength(2);
  });
});

describe('WF-03 apply routine proposal', () => {
  it('creates routine, version, sessions and exercise targets in one transaction', async () => {
    const proposalId = await createProposal(U1);
    const occurrences = generateOccurrences(plan, { startDate: '2026-10-12', weeks: 2 });
    const result = await asUser(U1, () =>
      rpc<{ routineId: string; sessionsCreated: number }>('apply_routine_proposal', {
        p_proposal_id: proposalId,
        p_version: 1,
        p_occurrences: JSON.stringify(occurrences),
        p_timezone: 'Africa/Lagos',
        p_today: '2026-10-12',
        p_idempotency_key: 'apply-key-0001',
      }),
    );
    expect(result.sessionsCreated).toBe(4);

    const sessions = await asUser(U1, () =>
      q<{ status: string; original_planned_date: string }>(`select status, original_planned_date::text from public.workout_sessions where routine_id = $1`, [result.routineId]),
    );
    expect(sessions).toHaveLength(4);
    expect(sessions.every((s) => s.status === 'scheduled')).toBe(true);

    const ex = await asUser(U1, () => q(`select * from public.session_exercises se join public.workout_sessions s on s.id = se.session_id where s.routine_id = $1`, [result.routineId]));
    expect(ex).toHaveLength(4); // 2 exercises x 2 upper-body sessions; runs have none

    const proposal = await asUser(U1, () => q<{ status: string }>(`select status from public.routine_proposals where id = $1`, [proposalId]));
    expect(proposal[0]!.status).toBe('applied');
  });

  it('returns the original result on retry and never duplicates sessions', async () => {
    const before = await asUser(U1, () => q(`select id from public.workout_sessions`));
    const again = await asUser(U1, () =>
      rpc<{ sessionsCreated: number }>('apply_routine_proposal', {
        p_proposal_id: '00000000-0000-4000-8000-000000000000',
        p_version: 1,
        p_occurrences: '[]',
        p_timezone: 'UTC',
        p_today: '2026-10-12',
        p_idempotency_key: 'apply-key-0001',
      }),
    );
    expect(again.sessionsCreated).toBe(4);
    const after = await asUser(U1, () => q(`select id from public.workout_sessions`));
    expect(after).toHaveLength(before.length);
  });

  it('refuses to apply a stale version', async () => {
    const proposalId = await createProposal(U1);
    await expect(
      asUser(U1, () =>
        rpc('apply_routine_proposal', {
          p_proposal_id: proposalId,
          p_version: 2,
          p_occurrences: '[]',
          p_timezone: 'UTC',
          p_today: '2026-10-12',
          p_idempotency_key: 'apply-key-stale',
        }),
      ),
    ).rejects.toThrow(/changed since it was reviewed/);
  });
});

describe('history integrity', () => {
  let routineId: string;
  let completedId: string;
  let futureId: string;

  beforeAll(async () => {
    const r = await asUser(U1, () => q<{ id: string }>(`select id from public.workout_routines where user_id = $1 limit 1`, [U1]));
    routineId = r[0]!.id;
    const s = await asUser(U1, () =>
      q<{ id: string; planned_date: string }>(`select id, planned_date::text from public.workout_sessions where routine_id = $1 order by planned_date`, [routineId]),
    );
    completedId = s[0]!.id;
    futureId = s[s.length - 1]!.id;
    await asUser(U1, async () => {
      await q(
        `insert into public.exercise_logs (user_id, session_id, exercise_name_snapshot, set_number, actual_reps, actual_weight, weight_unit, client_id)
         values ($1, $2, 'Bench press', 1, 8, 62.5, 'kg', 'log-client-1')`,
        [U1, completedId],
      );
      await q(`update public.workout_sessions set status = 'completed', actual_date = planned_date, actual_end_at = now() where id = $1`, [completedId]);
    });
  });

  it('rejects completing a session without evidence', async () => {
    await expect(asUser(U1, () => q(`update public.workout_sessions set status = 'completed' where id = $1`, [futureId]))).rejects.toThrow(
      /completed_has_evidence/,
    );
  });

  it('never lets the original planned date change', async () => {
    await expect(
      asUser(U1, () => q(`update public.workout_sessions set original_planned_date = '2030-01-01' where id = $1`, [futureId])),
    ).rejects.toThrow(/immutable/);
  });

  it('records reschedules in history and keeps the session scheduled', async () => {
    const res = await asUser(U1, () =>
      rpc<{ changeId: string }>('reschedule_session', {
        p_session_id: futureId,
        p_new_date: '2026-10-25',
        p_new_time: '18:00',
        p_reason: 'Travelling',
        p_idempotency_key: 'resched-0001',
      }),
    );
    expect(res.changeId).toBeTruthy();
    const s = await asUser(U1, () =>
      q<{ status: string; planned_date: string; original_planned_date: string }>(
        `select status, planned_date::text, original_planned_date::text from public.workout_sessions where id = $1`,
        [futureId],
      ),
    );
    expect(s[0]).toMatchObject({ status: 'scheduled', planned_date: '2026-10-25', original_planned_date: '2026-10-21' });

    // Retry does not add a second history row.
    await asUser(U1, () =>
      rpc('reschedule_session', { p_session_id: futureId, p_new_date: '2026-10-25', p_new_time: '18:00', p_reason: 'Travelling', p_idempotency_key: 'resched-0001' }),
    );
    const changes = await asUser(U1, () => q(`select * from public.schedule_changes where session_id = $1`, [futureId]));
    expect(changes).toHaveLength(1);
  });

  it('refuses to move a completed session', async () => {
    await expect(
      asUser(U1, () =>
        rpc('reschedule_session', { p_session_id: completedId, p_new_date: '2026-10-30', p_new_time: null, p_reason: null, p_idempotency_key: 'resched-0002' }),
      ),
    ).rejects.toThrow(/cannot be moved/);
  });

  it('does not let users delete schedule history', async () => {
    await asUser(U1, () => q(`delete from public.schedule_changes`));
    const left = await asUser(U1, () => q(`select * from public.schedule_changes`));
    expect(left.length).toBeGreaterThan(0);
  });

  it('keeps completed sessions and their logs when the routine is replaced', async () => {
    const proposalId = await createProposal(U1, { mode: 'replace', target: routineId });
    const occ = generateOccurrences({ ...plan, title: 'Upper / lower v2' }, { startDate: '2026-10-19', weeks: 1 });
    const res = await asUser(U1, () =>
      rpc<{ versionNumber: number; sessionsRetired: number }>('apply_routine_proposal', {
        p_proposal_id: proposalId,
        p_version: 1,
        p_occurrences: JSON.stringify(occ),
        p_timezone: 'UTC',
        p_today: '2026-10-19',
        p_idempotency_key: 'apply-replace-1',
      }),
    );
    expect(res.versionNumber).toBe(2);
    expect(res.sessionsRetired).toBeGreaterThan(0);

    const completed = await asUser(U1, () => q<{ status: string }>(`select status from public.workout_sessions where id = $1`, [completedId]));
    expect(completed[0]!.status).toBe('completed');
    const logs = await asUser(U1, () => q(`select * from public.exercise_logs where session_id = $1`, [completedId]));
    expect(logs).toHaveLength(1);
    const versions = await asUser(U1, () => q(`select version_number from public.workout_routine_versions where routine_id = $1`, [routineId]));
    expect(versions).toHaveLength(2);
    const cancelled = await asUser(U1, () =>
      q(`select * from public.schedule_changes where change_type = 'cancelled' and actor = 'system'`),
    );
    expect(cancelled.length).toBe(res.sessionsRetired);
  });

  it('audits set-log corrections', async () => {
    const log = await asUser(U1, () => q<{ id: string }>(`select id from public.exercise_logs where client_id = 'log-client-1'`));
    await asUser(U1, () =>
      rpc('correct_exercise_log', { p_log_id: log[0]!.id, p_actual_reps: 8, p_actual_weight: 60, p_weight_unit: 'kg', p_status: null, p_reason: 'Typo' }),
    );
    const audit = await asUser(U1, () => q<{ previous_values: { actual_weight: number } }>(`select previous_values from public.exercise_log_corrections`));
    expect(Number(audit[0]!.previous_values.actual_weight)).toBe(62.5);
  });
});

describe('row level security', () => {
  it('hides one user\'s records from another', async () => {
    const theirs = await asUser(U2, () => q(`select * from public.workout_sessions`));
    expect(theirs).toHaveLength(0);
    const routines = await asUser(U2, () => q(`select * from public.workout_routines`));
    expect(routines).toHaveLength(0);
  });

  it('blocks writing rows for someone else', async () => {
    await expect(
      asUser(U2, () =>
        q(`insert into public.fitness_goals (user_id, title) values ($1, 'Not mine')`, [U1]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('blocks attaching logs to another user\'s session', async () => {
    const s = await asUser(U1, () => q<{ id: string }>(`select id from public.workout_sessions limit 1`));
    await expect(
      asUser(U2, () =>
        q(
          `insert into public.exercise_logs (user_id, session_id, exercise_name_snapshot, set_number, client_id) values ($1, $2, 'Hack', 1, 'x-client-1')`,
          [U2, s[0]!.id],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('refuses anonymous calls to domain functions', async () => {
    await db.exec(`set role anon;`);
    try {
      await expect(q(`select public.reschedule_session(null, null, null, null, 'k-anon-1')`)).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec(`reset role;`);
    }
  });
});

describe('WF-10 meal plan approval', () => {
  const mealPlan = (start: string, end: string) => ({
    title: 'Cutting week',
    goalContext: 'Cutting phase, Nigerian food',
    startDate: start,
    endDate: end,
    slots: ['Breakfast', 'Lunch'],
    entries: [
      { date: start, slot: 'Breakfast', sortOrder: 0, mealName: 'Akara and pap', ingredients: [{ name: 'Beans', quantity: 200, unit: 'g' }] },
      { date: start, slot: 'Lunch', sortOrder: 1, mealName: 'Beans porridge', ingredients: [{ name: 'Beans', quantity: 150, unit: 'g' }] },
    ],
    shoppingList: [],
    assumptions: [],
  });

  async function approve(start: string, end: string, key: string) {
    const id = await asUser(U1, async () => {
      const rows = await q<{ id: string }>(
        `insert into public.meal_plan_proposals (user_id, status, version, plan) values ($1, 'draft', 1, $2) returning id`,
        [U1, JSON.stringify(mealPlan(start, end))],
      );
      return rows[0]!.id;
    });
    return asUser(U1, () =>
      rpc<{ mealPlanId: string; archivedPlans: number }>('approve_meal_plan_proposal', {
        p_proposal_id: id,
        p_version: 1,
        p_shopping: JSON.stringify([{ name: 'Beans', quantity: 350, unit: 'g', category: 'Pantry', sourceEntryIndexes: [0, 1] }]),
        p_idempotency_key: key,
      }),
    );
  }

  it('creates the timetable and a shopping list linked to its meals', async () => {
    const res = await approve('2026-10-19', '2026-10-25', 'meal-approve-1');
    const items = await asUser(U1, () =>
      q<{ source_meal_entry_ids: string[] }>(`select source_meal_entry_ids from public.shopping_list_items where meal_plan_id = $1`, [res.mealPlanId]),
    );
    expect(items[0]!.source_meal_entry_ids).toHaveLength(2);
    const entries = await asUser(U1, () => q(`select * from public.meal_plan_entries where meal_plan_id = $1`, [res.mealPlanId]));
    expect(entries).toHaveLength(2);
  });

  it('archives (never deletes) an older overlapping plan', async () => {
    const res = await approve('2026-10-22', '2026-10-28', 'meal-approve-2');
    expect(res.archivedPlans).toBe(1);
    const plans = await asUser(U1, () => q<{ status: string }>(`select status from public.meal_plans order by created_at`));
    expect(plans.map((p) => p.status)).toEqual(['archived', 'active']);
  });

  it('has no calorie or macro columns anywhere', async () => {
    const cols = await q<{ column_name: string }>(
      `select column_name from information_schema.columns where table_schema = 'public' and (column_name ilike '%calor%' or column_name ilike '%macro%' or column_name ilike '%protein%')`,
    );
    expect(cols).toHaveLength(0);
  });
});
