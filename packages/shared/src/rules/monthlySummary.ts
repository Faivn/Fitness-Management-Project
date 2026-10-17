import type { ActivityType, RecordSource, ScheduleChangeType, SessionStatus } from '../enums.js';

/**
 * WF-15 monthly review aggregation. Pure and deterministic: the summary is
 * computed ONLY from persisted records passed in, never from conversation.
 * Source logs are read, never modified.
 */

export interface SessionForSummary {
  id: string;
  title: string;
  activityType: ActivityType;
  source: RecordSource;
  status: SessionStatus;
  /** Immutable date the session was first planned for; null for unplanned activity. */
  originalPlannedDate: string | null;
  /** Current planned date (after any moves); null for unplanned activity. */
  plannedDate: string | null;
  /** Local date the activity actually happened, when recorded. */
  actualDate: string | null;
  actualEndAt: string | null;
  setLogCount: number;
}

export interface ScheduleChangeForSummary {
  sessionId: string;
  changeType: ScheduleChangeType;
  createdAt: string;
}

export interface PeriodSummaryInput {
  periodStart: string;
  periodEnd: string;
  /** Today's local date — used to tell "upcoming" from "not recorded". */
  today: string;
  sessions: SessionForSummary[];
  scheduleChanges: ScheduleChangeForSummary[];
}

export type SummaryOutcome =
  | 'completed'
  | 'incomplete'
  | 'missed'
  | 'cancelled'
  | 'not_recorded'
  | 'upcoming'
  | 'spontaneous'
  | 'historical_entry';

export interface SummaryItem {
  sessionId: string;
  title: string;
  activityType: ActivityType;
  outcome: SummaryOutcome;
  originalPlannedDate: string | null;
  plannedDate: string | null;
  actualDate: string | null;
  wasRescheduled: boolean;
  timesMoved: number;
  hasSetLogs: boolean;
}

export interface PeriodSummary {
  periodStart: string;
  periodEnd: string;
  counts: {
    /** Sessions originally planned for this period. */
    planned: number;
    completed: number;
    completedAsPlanned: number;
    completedAfterReschedule: number;
    incomplete: number;
    missed: number;
    cancelled: number;
    /** Past planned sessions with no outcome recorded — missing data, not "no activity". */
    notRecorded: number;
    upcoming: number;
    rescheduled: number;
    spontaneous: number;
    historicalEntries: number;
  };
  byActivityType: Partial<Record<ActivityType, { planned: number; completed: number; unplanned: number }>>;
  items: SummaryItem[];
  sourceRecordIds: string[];
  /** True when the period has no records at all (distinct from records showing no activity). */
  isEmpty: boolean;
}

function inPeriod(date: string | null, start: string, end: string): boolean {
  return date !== null && date >= start && date <= end;
}

function outcomeOf(s: SessionForSummary, today: string): SummaryOutcome {
  if (s.originalPlannedDate === null) {
    return s.source === 'historical_entry' ? 'historical_entry' : 'spontaneous';
  }
  switch (s.status) {
    case 'completed':
      // Completion requires evidence (the actual date); otherwise it is treated as unrecorded.
      return s.actualDate ? 'completed' : 'not_recorded';
    case 'incomplete':
      return 'incomplete';
    case 'missed':
      return 'missed';
    case 'cancelled':
      return 'cancelled';
    case 'scheduled':
    case 'in_progress':
      return s.plannedDate !== null && s.plannedDate >= today ? 'upcoming' : 'not_recorded';
  }
}

export function summarisePeriod(input: PeriodSummaryInput): PeriodSummary {
  const { periodStart: start, periodEnd: end, today } = input;

  const moves = new Map<string, number>();
  for (const c of input.scheduleChanges) {
    if (c.changeType === 'rescheduled') moves.set(c.sessionId, (moves.get(c.sessionId) ?? 0) + 1);
  }

  const relevant = input.sessions.filter(
    (s) =>
      inPeriod(s.originalPlannedDate, start, end) ||
      inPeriod(s.plannedDate, start, end) ||
      inPeriod(s.actualDate, start, end),
  );

  const counts: PeriodSummary['counts'] = {
    planned: 0,
    completed: 0,
    completedAsPlanned: 0,
    completedAfterReschedule: 0,
    incomplete: 0,
    missed: 0,
    cancelled: 0,
    notRecorded: 0,
    upcoming: 0,
    rescheduled: 0,
    spontaneous: 0,
    historicalEntries: 0,
  };
  const byActivityType: PeriodSummary['byActivityType'] = {};
  const items: SummaryItem[] = [];

  for (const s of relevant) {
    const outcome = outcomeOf(s, today);
    const timesMoved = moves.get(s.id) ?? 0;
    const bucket = (byActivityType[s.activityType] ??= { planned: 0, completed: 0, unplanned: 0 });

    if (inPeriod(s.originalPlannedDate, start, end)) {
      counts.planned++;
      bucket.planned++;
    }
    if (timesMoved > 0) counts.rescheduled++;

    switch (outcome) {
      case 'completed':
        counts.completed++;
        bucket.completed++;
        if (timesMoved > 0) counts.completedAfterReschedule++;
        else counts.completedAsPlanned++;
        break;
      case 'incomplete':
        counts.incomplete++;
        break;
      case 'missed':
        counts.missed++;
        break;
      case 'cancelled':
        counts.cancelled++;
        break;
      case 'not_recorded':
        counts.notRecorded++;
        break;
      case 'upcoming':
        counts.upcoming++;
        break;
      case 'spontaneous':
        counts.spontaneous++;
        counts.completed++;
        bucket.unplanned++;
        bucket.completed++;
        break;
      case 'historical_entry':
        counts.historicalEntries++;
        counts.completed++;
        bucket.unplanned++;
        bucket.completed++;
        break;
    }

    items.push({
      sessionId: s.id,
      title: s.title,
      activityType: s.activityType,
      outcome,
      originalPlannedDate: s.originalPlannedDate,
      plannedDate: s.plannedDate,
      actualDate: s.actualDate,
      wasRescheduled: timesMoved > 0,
      timesMoved,
      hasSetLogs: s.setLogCount > 0,
    });
  }

  items.sort((a, b) => {
    const da = a.actualDate ?? a.plannedDate ?? a.originalPlannedDate ?? '';
    const db = b.actualDate ?? b.plannedDate ?? b.originalPlannedDate ?? '';
    return da.localeCompare(db) || a.title.localeCompare(b.title);
  });

  return {
    periodStart: start,
    periodEnd: end,
    counts,
    byActivityType,
    items,
    sourceRecordIds: items.map((i) => i.sessionId),
    isEmpty: items.length === 0,
  };
}

/** Plain-language, non-judgmental fallback text when the AI is unavailable. */
export function describeSummary(s: PeriodSummary): string {
  if (s.isEmpty) return `No activity was recorded between ${s.periodStart} and ${s.periodEnd}.`;
  const c = s.counts;
  const parts = [
    `${c.planned} planned`,
    `${c.completed} completed`,
    c.completedAfterReschedule ? `${c.completedAfterReschedule} of those after moving` : null,
    c.rescheduled ? `${c.rescheduled} rescheduled` : null,
    c.missed ? `${c.missed} missed` : null,
    c.cancelled ? `${c.cancelled} cancelled` : null,
    c.incomplete ? `${c.incomplete} left incomplete` : null,
    c.spontaneous ? `${c.spontaneous} spontaneous` : null,
    c.historicalEntries ? `${c.historicalEntries} added afterwards` : null,
    c.notRecorded ? `${c.notRecorded} with no outcome recorded` : null,
  ].filter(Boolean);
  return `Between ${s.periodStart} and ${s.periodEnd}: ${parts.join(', ')}.`;
}
