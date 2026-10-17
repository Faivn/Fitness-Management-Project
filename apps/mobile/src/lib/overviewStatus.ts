import type { OverviewDay } from '@mova/shared';

/**
 * The Overview's headline state, derived only from the person's real data:
 * - attention: past planned sessions still waiting for an outcome
 * - upToDate: an active routine and nothing outstanding
 * - unconfigured: no active routine yet (never reported as "up to date")
 */
export type OverviewStatus = { kind: 'attention'; count: number } | { kind: 'upToDate' } | { kind: 'unconfigured' };

export function overviewStatus(o: Pick<OverviewDay, 'hasActiveRoutine' | 'needsAttention'>): OverviewStatus {
  if (o.needsAttention.length > 0) return { kind: 'attention', count: o.needsAttention.length };
  if (!o.hasActiveRoutine) return { kind: 'unconfigured' };
  return { kind: 'upToDate' };
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** Warm, no-blame copy for each state. Gender-neutral; the count comes from real data. */
export function statusCopy(s: OverviewStatus): { headline: string; body: string; action?: string } {
  switch (s.kind) {
    case 'attention': {
      const n = WORDS[s.count] ?? String(s.count);
      const what = s.count === 1 ? 'one workout' : `${n} workouts`;
      return {
        headline: "Oops, what's going on?",
        body: `${s.count === 1 ? 'There is' : 'There are'} ${what} still waiting for an update. Everything okay? Let's figure it out together.`,
        action: "Let's catch up",
      };
    }
    case 'upToDate':
      return { headline: 'Look at you!', body: "You're showing up for yourself, and we love to see it. Keep going, one day at a time." };
    default:
      return { headline: "Let's get you started", body: 'Add a routine, or let Mova build one with you. Your day will fill in here at your pace.' };
  }
}
