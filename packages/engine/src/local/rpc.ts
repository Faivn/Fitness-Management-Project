import { DbError, type LocalCore, type LocalDatabase } from './localDb.js';
import type { Row } from './tables.js';

/**
 * Stored procedures: TypeScript ports of supabase/migrations/*_domain_functions.sql.
 * Each call runs as one transaction (the database rolls back if it throws) and
 * keeps the same rules: idempotent retries, insert-only history, a proposal is
 * applied only from `draft` at the version that was reviewed.
 */

const notFound = (what: string) => new DbError('P0002', what);
const invalid = (msg: string) => new DbError('P0001', msg);
const emptyToNull = (v: unknown) => (v === '' || v === undefined ? null : v);

export function registerProcedures(database: LocalDatabase): void {
  const core = database.core;
  const user = core.userId;
  const nowIso = () => core.now().toISOString();

  const idemGet = (key: unknown) => (key ? core.rows('idempotency_keys').find((r) => r.user_id === user && r.key === key)?.response ?? null : null);
  const idemPut = (key: unknown, operation: string, response: unknown) => {
    if (key) core.insert('idempotency_keys', { user_id: user, key, operation, response });
  };

  const mine = (table: string, id: unknown): Row | undefined => core.rows(table).find((r) => r.id === id && r.user_id === user);

  function createSessionsForVersion(routineId: string, versionId: string, plan: Row, occurrences: Row[], timezone: string, source: string): number {
    let created = 0;
    for (const occ of occurrences ?? []) {
      const exists = core
        .rows('workout_sessions')
        .some((s) => s.routine_version_id === versionId && s.session_index === Number(occ.sessionIndex) && s.original_planned_date === occ.plannedDate);
      if (exists) continue;
      const session = core.insert('workout_sessions', {
        user_id: user,
        routine_id: routineId,
        routine_version_id: versionId,
        session_index: Number(occ.sessionIndex),
        title: occ.title,
        activity_type: occ.activityType ?? 'strength',
        source,
        status: 'scheduled',
        original_planned_date: occ.plannedDate,
        planned_date: occ.plannedDate,
        planned_time: emptyToNull(occ.plannedTime),
        planned_duration_minutes: emptyToNull(occ.durationMinutes),
        planned_timezone: timezone,
      });
      created += 1;
      const exercises: Row[] = plan?.sessions?.[Number(occ.sessionIndex)]?.exercises ?? [];
      exercises.forEach((ex, order) => {
        core.insert('session_exercises', {
          session_id: session.id,
          user_id: user,
          exercise_id: emptyToNull(ex.exerciseId),
          display_name: ex.name,
          sort_order: order,
          target_sets: ex.targetSets,
          target_reps_min: emptyToNull(ex.repsMin),
          target_reps_max: emptyToNull(ex.repsMax),
          target_weight: emptyToNull(ex.targetWeight),
          weight_unit: emptyToNull(ex.weightUnit),
          rest_seconds: emptyToNull(ex.restSeconds),
          instructions: emptyToNull(ex.instructions),
        });
      });
    }
    return created;
  }

  /** Cancels FUTURE scheduled sessions of a routine and records each change. */
  function retireFutureSessions(routineId: string, fromDate: string, reason: string): number {
    const targets = core.rows('workout_sessions').filter((s) => s.routine_id === routineId && s.user_id === user && s.status === 'scheduled' && s.planned_date >= fromDate);
    for (const s of targets) {
      core.insert('schedule_changes', {
        user_id: user, session_id: s.id, change_type: 'cancelled', old_date: s.planned_date, old_time: s.planned_time,
        previous_status: s.status, reason, actor: 'system',
      });
      core.update('workout_sessions', (r) => r.id === s.id, { status: 'cancelled' });
    }
    return targets.length;
  }

  const goalsOf = (plan: Row): Row[] => {
    const ids: string[] = plan?.goalIds ?? [];
    return core.rows('fitness_goals').filter((g) => g.user_id === user && ids.includes(g.id));
  };
  function linkGoals(routineId: string, plan: Row) {
    for (const g of goalsOf(plan)) {
      if (!core.rows('routine_goals').some((r) => r.routine_id === routineId && r.goal_id === g.id)) {
        core.insert('routine_goals', { routine_id: routineId, goal_id: g.id, user_id: user });
      }
    }
  }
  const nextVersionNumber = (routineId: string) => Math.max(0, ...core.rows('workout_routine_versions').filter((v) => v.routine_id === routineId).map((v) => v.version_number)) + 1;

  database.procedures = {
    apply_routine_proposal(a) {
      const existing = idemGet(a.p_idempotency_key);
      if (existing) return existing;
      const p = mine('routine_proposals', a.p_proposal_id);
      if (!p) throw notFound('proposal not found');
      if (p.status === 'applied') return { routineId: p.applied_routine_id, sessionsCreated: 0, alreadyApplied: true };
      if (p.status !== 'draft') throw invalid(`proposal is ${p.status}`);
      if (p.version !== a.p_version) throw new DbError('40001', `proposal changed since it was reviewed (now version ${p.version})`);
      if (!p.plan) throw invalid('proposal has no plan to apply');

      const goalSnapshot = goalsOf(p.plan).map(({ user_id: _u, ...g }) => g);
      let routineId: string;
      let versionNumber: number;
      let retired = 0;
      if ((p.mode === 'adjust' || p.mode === 'replace') && p.target_routine_id) {
        const target = mine('workout_routines', p.target_routine_id);
        if (!target) throw notFound('target routine not found');
        routineId = target.id;
        versionNumber = nextVersionNumber(routineId);
        retired = retireFutureSessions(routineId, String(a.p_today), `Replaced by routine version ${versionNumber}`);
        core.update('workout_routines', (r) => r.id === routineId, { current_version: versionNumber, title: p.plan.title, status: 'active' });
      } else {
        routineId = core.insert('workout_routines', { user_id: user, title: p.plan.title, status: 'active', current_version: 1, source: 'ai' }).id;
        versionNumber = 1;
      }
      const version = core.insert('workout_routine_versions', {
        routine_id: routineId, user_id: user, version_number: versionNumber, goal_snapshot: goalSnapshot, plan_data: p.plan,
        change_reason: p.request_text ?? 'AI proposal approved',
      });
      linkGoals(routineId, p.plan);
      const created = createSessionsForVersion(routineId, version.id, p.plan, a.p_occurrences as Row[], String(a.p_timezone), 'ai');
      core.update('routine_proposals', (r) => r.id === p.id, {
        status: 'applied', approved_version: a.p_version, approved_at: nowIso(), applied_at: nowIso(), applied_routine_id: routineId,
      });
      const result = { routineId, versionId: version.id, versionNumber, sessionsCreated: created, sessionsRetired: retired };
      idemPut(a.p_idempotency_key, 'apply_routine_proposal', result);
      return result;
    },

    create_manual_routine(a) {
      const existing = idemGet(a.p_idempotency_key);
      if (existing) return existing;
      const plan = a.p_plan as Row;
      const routine = core.insert('workout_routines', { user_id: user, title: plan.title, status: a.p_activate ? 'active' : 'draft', current_version: 1, source: 'manual' });
      const version = core.insert('workout_routine_versions', { routine_id: routine.id, user_id: user, version_number: 1, plan_data: plan, change_reason: 'Created manually' });
      linkGoals(routine.id, plan);
      const created = a.p_activate ? createSessionsForVersion(routine.id, version.id, plan, a.p_occurrences as Row[], String(a.p_timezone), 'manual') : 0;
      const result = { routineId: routine.id, versionId: version.id, versionNumber: 1, sessionsCreated: created };
      idemPut(a.p_idempotency_key, 'create_manual_routine', result);
      return result;
    },

    save_routine_version(a) {
      const existing = idemGet(a.p_idempotency_key);
      if (existing) return existing;
      const r = mine('workout_routines', a.p_routine_id);
      if (!r) throw notFound('routine not found');
      const plan = a.p_plan as Row;
      const wasActive = r.status === 'active'; // read before the update below, which may mutate the row
      const versionNumber = nextVersionNumber(r.id);
      const version = core.insert('workout_routine_versions', { routine_id: r.id, user_id: user, version_number: versionNumber, plan_data: plan, change_reason: a.p_change_reason ?? null });
      core.update('workout_routines', (x) => x.id === r.id, { current_version: versionNumber, title: plan.title, status: a.p_activate ? 'active' : r.status });
      linkGoals(r.id, plan);
      let retired = 0;
      let created = 0;
      if (a.p_reschedule_future) retired = retireFutureSessions(r.id, String(a.p_today), `Replaced by routine version ${versionNumber}`);
      if (a.p_reschedule_future || (a.p_activate && !wasActive)) {
        created = createSessionsForVersion(r.id, version.id, plan, a.p_occurrences as Row[], String(a.p_timezone), r.source);
      }
      const result = { routineId: r.id, versionId: version.id, versionNumber, sessionsCreated: created, sessionsRetired: retired };
      idemPut(a.p_idempotency_key, 'save_routine_version', result);
      return result;
    },

    deactivate_routine(a) {
      const r = mine('workout_routines', a.p_routine_id);
      if (!r) throw notFound('routine not found');
      const retired = retireFutureSessions(r.id, String(a.p_today), 'Replaced by another routine');
      core.update('workout_routines', (x) => x.id === r.id, { status: 'draft' });
      return { sessionsRetired: retired };
    },

    reschedule_session(a) {
      const existing = idemGet(a.p_idempotency_key);
      if (existing) return existing;
      const s = mine('workout_sessions', a.p_session_id);
      if (!s) throw notFound('session not found');
      if (s.planned_date === null) throw invalid('an unplanned activity cannot be rescheduled');
      if (!['scheduled', 'missed'].includes(s.status)) throw invalid(`a ${s.status} session cannot be moved`);
      const change = core.insert('schedule_changes', {
        user_id: user, session_id: s.id, change_type: 'rescheduled', old_date: s.planned_date, old_time: s.planned_time,
        new_date: a.p_new_date, new_time: emptyToNull(a.p_new_time), previous_status: s.status, reason: emptyToNull(a.p_reason), actor: 'user',
        idempotency_key: a.p_idempotency_key ?? null,
      });
      // Moving is not completion: the session goes back to (or stays) scheduled.
      core.update('workout_sessions', (r) => r.id === s.id, { planned_date: a.p_new_date, planned_time: emptyToNull(a.p_new_time), status: 'scheduled' });
      const result = { sessionId: s.id, changeId: change.id };
      idemPut(a.p_idempotency_key, 'reschedule_session', result);
      return result;
    },

    set_session_outcome(a) {
      const existing = idemGet(a.p_idempotency_key);
      if (existing) return existing;
      if (!['missed', 'cancelled'].includes(String(a.p_outcome))) throw new DbError('22023', `unsupported outcome ${a.p_outcome}`);
      const s = mine('workout_sessions', a.p_session_id);
      if (!s) throw notFound('session not found');
      if (a.p_outcome === 'missed' && s.status !== 'scheduled') throw invalid(`only a scheduled session can be marked missed (it is ${s.status})`);
      if (a.p_outcome === 'cancelled' && !['scheduled', 'missed'].includes(s.status)) throw invalid(`a ${s.status} session cannot be cancelled`);
      core.insert('schedule_changes', {
        user_id: user, session_id: s.id, change_type: a.p_outcome === 'missed' ? 'marked_missed' : 'cancelled', old_date: s.planned_date, old_time: s.planned_time,
        previous_status: s.status, reason: emptyToNull(a.p_reason), actor: 'user', idempotency_key: a.p_idempotency_key ?? null,
      });
      core.update('workout_sessions', (r) => r.id === s.id, { status: a.p_outcome });
      const result = { sessionId: s.id, status: a.p_outcome };
      idemPut(a.p_idempotency_key, 'set_session_outcome', result);
      return result;
    },

    approve_meal_plan_proposal(a) {
      const existing = idemGet(a.p_idempotency_key);
      if (existing) return existing;
      const p = mine('meal_plan_proposals', a.p_proposal_id);
      if (!p) throw notFound('proposal not found');
      if (p.status === 'applied') return { mealPlanId: p.applied_meal_plan_id, alreadyApplied: true };
      if (p.status !== 'draft') throw invalid(`proposal is ${p.status}`);
      if (p.version !== a.p_version) throw new DbError('40001', `proposal changed since it was reviewed (now version ${p.version})`);
      if (!p.plan) throw invalid('proposal has no plan to approve');
      const plan = p.plan as Row;
      // Older overlapping plans are archived, never deleted.
      const archived = core.update('meal_plans', (m) => m.user_id === user && m.status === 'active' && m.start_date <= plan.endDate && m.end_date >= plan.startDate, { status: 'archived' });
      const mealPlan = core.insert('meal_plans', {
        user_id: user, proposal_id: p.id, title: plan.title, goal_context: plan.goalContext ?? null, start_date: plan.startDate, end_date: plan.endDate,
        status: 'active', version: p.version, source: 'ai', slots: plan.slots ?? [], approved_at: nowIso(),
      });
      const entryIds: string[] = [];
      for (const e of (plan.entries ?? []) as Row[]) {
        const row = core.insert('meal_plan_entries', {
          meal_plan_id: mealPlan.id, user_id: user, entry_date: e.date, meal_slot: e.slot, sort_order: e.sortOrder ?? 0, meal_name: e.mealName,
          description: e.description ?? null, ingredients: e.ingredients ?? [], is_smoothie: e.isSmoothie ?? false, notes: e.notes ?? null,
        });
        entryIds.push(row.id);
      }
      for (const item of (a.p_shopping ?? []) as Row[]) {
        core.insert('shopping_list_items', {
          meal_plan_id: mealPlan.id, user_id: user, name: item.name, quantity: emptyToNull(item.quantity), unit: emptyToNull(item.unit), category: emptyToNull(item.category),
          source_meal_entry_ids: ((item.sourceEntryIndexes ?? []) as number[]).map((i) => entryIds[i]).filter(Boolean),
        });
      }
      core.update('meal_plan_proposals', (r) => r.id === p.id, { status: 'applied', approved_at: nowIso(), applied_meal_plan_id: mealPlan.id });
      const result = { mealPlanId: mealPlan.id, archivedPlans: archived.length };
      idemPut(a.p_idempotency_key, 'approve_meal_plan_proposal', result);
      return result;
    },

    correct_exercise_log(a) {
      const l = mine('exercise_logs', a.p_log_id);
      if (!l) throw notFound('log not found');
      core.insert('exercise_log_corrections', {
        log_id: l.id, user_id: user,
        previous_values: { actual_reps: l.actual_reps, actual_weight: l.actual_weight, weight_unit: l.weight_unit, status: l.status },
        new_values: { actual_reps: a.p_actual_reps ?? null, actual_weight: a.p_actual_weight ?? null, weight_unit: a.p_weight_unit ?? null, status: a.p_status ?? l.status },
        reason: emptyToNull(a.p_reason),
      });
      core.update('exercise_logs', (r) => r.id === l.id, {
        actual_reps: a.p_actual_reps ?? null, actual_weight: a.p_actual_weight ?? null, weight_unit: a.p_weight_unit ?? null, status: a.p_status ?? l.status, corrected_at: nowIso(),
      });
      return { logId: l.id };
    },
  };
}

export type { LocalCore };
