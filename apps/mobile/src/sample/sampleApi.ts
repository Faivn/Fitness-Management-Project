import { summarisePeriod, type MealPlanEntryDto, type WorkoutSession, type WorkoutSessionDetail } from '@mova/shared';
import snapshot from './snapshot.json';

/**
 * Read-only sample preview. Serves the API responses recorded in
 * snapshot.json (generated from the real API by
 * apps/api/src/dev/generateSampleSnapshot.ts). Range queries are answered by
 * filtering the recorded sessions with the same shared rules the API uses.
 * Writes are refused with a clear message — nothing is saved.
 */

export const SAMPLE_TODAY: string = snapshot.today;

const responses = snapshot.responses as Record<string, unknown>;
const sessions = snapshot.sessions as unknown as WorkoutSession[];
const meals = snapshot.meals as unknown as MealPlanEntryDto[];

export class SampleWriteError extends Error {}

function inRange(d: string | null, from: string, to: string) {
  return d !== null && d >= from && d <= to;
}

function sessionsIn(from: string, to: string) {
  return sessions.filter((s) => inRange(s.plannedDate, from, to) || (s.plannedDate === null && inRange(s.actualDate, from, to)));
}

function history(from: string, to: string) {
  const relevant = sessions.filter(
    (s) => inRange(s.originalPlannedDate, from, to) || inRange(s.plannedDate, from, to) || inRange(s.actualDate, from, to),
  );
  const details = relevant.map((s) => responses[`workout-sessions/${s.id}`] as WorkoutSessionDetail | undefined);
  return {
    summary: summarisePeriod({
      periodStart: from,
      periodEnd: to,
      today: SAMPLE_TODAY,
      sessions: relevant.map((s, i) => ({ ...s, setLogCount: details[i]?.setLogs.length ?? 0 })),
      scheduleChanges: details.flatMap((d) => d?.scheduleChanges.map((c) => ({ sessionId: c.sessionId, changeType: c.changeType, createdAt: c.createdAt })) ?? []),
    }),
    sessions: relevant,
  };
}

export async function sampleApi<T>(method: string, path: string): Promise<T> {
  if (method !== 'GET') throw new SampleWriteError('write');
  if (path in responses) return responses[path] as T;

  const [route, query = ''] = path.split('?');
  const q = new URLSearchParams(query);
  const from = q.get('from') ?? '';
  const to = q.get('to') ?? '';
  switch (route) {
    case 'workout-sessions':
      return sessionsIn(from, to) as T;
    case 'schedule':
      return { from, to, sessions: sessionsIn(from, to), meals: meals.filter((m) => inRange(m.date, from, to)) } as T;
    case 'history':
      return history(from, to) as T;
    case 'overview':
      return responses.overview as T;
    default:
      throw new Error('not_in_sample');
  }
}
