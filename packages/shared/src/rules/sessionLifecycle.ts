import type { SessionStatus } from '../enums.js';

/**
 * Allowed workout-session transitions (WF-06, WF-07, spec §9 rule 4).
 *
 * - A session is never completed just because it was opened or planned.
 * - A missed session stays missed until the user explicitly reschedules it.
 * - Completed sessions are terminal; corrections edit logs, not status.
 */
const TRANSITIONS: Record<SessionStatus, readonly SessionStatus[]> = {
  scheduled: ['in_progress', 'missed', 'cancelled', 'completed'],
  in_progress: ['completed', 'incomplete'],
  incomplete: ['in_progress', 'completed'],
  missed: ['scheduled', 'cancelled', 'completed'],
  cancelled: [],
  completed: [],
};

export function canTransition(from: SessionStatus, to: SessionStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: SessionStatus,
    readonly to: SessionStatus,
  ) {
    super(`A ${from} session cannot become ${to}.`);
    this.name = 'InvalidTransitionError';
  }
}

export function assertTransition(from: SessionStatus, to: SessionStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

/** WF-07: only sessions that have not happened yet (or were missed) can be moved. */
export function canReschedule(status: SessionStatus): boolean {
  return status === 'scheduled' || status === 'missed';
}

/**
 * A session counts as completed only with completion evidence: status
 * `completed` plus the local date it actually happened (WF-15). The exact
 * time may legitimately be unknown for historical entries.
 */
export function hasCompletionEvidence(session: {
  status: SessionStatus;
  actualDate: string | null;
}): boolean {
  return session.status === 'completed' && session.actualDate !== null;
}
