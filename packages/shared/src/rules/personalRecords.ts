import type { SetLogStatus, WeightUnit } from '../enums.js';
import { toKg } from './units.js';

/**
 * Personal-record rules (WF-09; spec §13 item 5 — decision proposed in ADR-007).
 *
 * Method `pr-v1`, recalculable from source set logs:
 * - Only `completed` sets with a recorded reps value ≥ 1 count.
 * - Exercises are grouped by canonical exercise id when present, otherwise by
 *   an exact normalised name. Similar-but-different names are NOT merged.
 * - `heaviest_weight`: highest weight lifted for ≥ 1 rep (compared in kg,
 *   reported in the unit it was logged in).
 * - `most_reps`: most reps in a single set at any weight (or bodyweight).
 * - `best_set_volume`: highest weight × reps in one set.
 * No estimated values (e.g. e1RM) are produced, so every record is a
 * recorded value, never a calculated estimate.
 */
export const PR_METHOD_VERSION = 'pr-v1';

export type PersonalRecordType = 'heaviest_weight' | 'most_reps' | 'best_set_volume';

export interface SetLogForRecords {
  id: string;
  exerciseId: string | null;
  exerciseName: string;
  actualReps: number | null;
  actualWeight: number | null;
  weightUnit: WeightUnit | null;
  status: SetLogStatus;
  /** Local date the set was performed. */
  activityDate: string;
}

export interface PersonalRecord {
  exerciseKey: string;
  exerciseName: string;
  type: PersonalRecordType;
  value: number;
  unit: WeightUnit | 'reps' | null;
  reps: number | null;
  achievedOn: string;
  sourceSetLogId: string;
  method: typeof PR_METHOD_VERSION;
}

export function normaliseExerciseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function exerciseKey(log: Pick<SetLogForRecords, 'exerciseId' | 'exerciseName'>): string {
  return log.exerciseId ? `id:${log.exerciseId}` : `name:${normaliseExerciseName(log.exerciseName)}`;
}

function better(candidate: number, current: number | undefined, candidateDate: string, currentDate?: string) {
  if (current === undefined) return true;
  if (candidate > current) return true;
  // Ties keep the earliest achievement.
  return candidate === current && currentDate !== undefined && candidateDate < currentDate;
}

export function calculatePersonalRecords(logs: SetLogForRecords[]): PersonalRecord[] {
  const best = new Map<string, PersonalRecord & { compare: number }>();

  const consider = (key: string, rec: PersonalRecord, compare: number) => {
    const id = `${key}|${rec.type}`;
    const cur = best.get(id);
    if (better(compare, cur?.compare, rec.achievedOn, cur?.achievedOn)) best.set(id, { ...rec, compare });
  };

  for (const log of logs) {
    if (log.status !== 'completed' || log.actualReps === null || log.actualReps < 1) continue;
    const key = exerciseKey(log);
    const base = {
      exerciseKey: key,
      exerciseName: log.exerciseName,
      achievedOn: log.activityDate,
      sourceSetLogId: log.id,
      method: PR_METHOD_VERSION,
    } as const;

    consider(key, { ...base, type: 'most_reps', value: log.actualReps, unit: 'reps', reps: log.actualReps }, log.actualReps);

    if (log.actualWeight !== null && log.actualWeight > 0 && log.weightUnit) {
      const kg = toKg(log.actualWeight, log.weightUnit);
      consider(
        key,
        { ...base, type: 'heaviest_weight', value: log.actualWeight, unit: log.weightUnit, reps: log.actualReps },
        kg,
      );
      consider(
        key,
        {
          ...base,
          type: 'best_set_volume',
          value: log.actualWeight * log.actualReps,
          unit: log.weightUnit,
          reps: log.actualReps,
        },
        kg * log.actualReps,
      );
    }
  }

  return [...best.values()]
    .map(({ compare: _compare, ...rec }) => rec)
    .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName) || a.type.localeCompare(b.type));
}
