import {
  describeSummary,
  monthlySummaryOutputSchema,
  summarisePeriod,
  todayIn,
  type MonthlyReview,
  type MonthlyReviewDraft,
  type PeriodSummary,
} from '@mova/shared';
import type { AppContext } from '../context.js';
import { must, mustOne } from '../db/helpers.js';
import { unprocessable } from '../http/errors.js';
import { AiUnavailableError } from '../lib/ai.js';
import { loadPeriodRecords } from './history.js';
import { userTimezone } from './profile.js';
import { monthlySummarySystemPrompt } from './prompts.js';

function toReview(r: any): MonthlyReview {
  return {
    id: r.id,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    summaryText: r.summary_text,
    reflection: r.reflection,
    stats: r.stats as PeriodSummary,
    version: r.version,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * WF-15: build a summary ONLY from persisted records. Source logs are read,
 * never modified. The AI writes the narrative from the computed stats; if it
 * is unavailable, a plain factual summary is used instead.
 */
export async function generateMonthlyReview(
  ctx: AppContext,
  input: { periodStart: string; periodEnd: string; reflection?: string },
): Promise<MonthlyReviewDraft> {
  const tz = await userTimezone(ctx);
  const records = await loadPeriodRecords(ctx, input.periodStart, input.periodEnd);
  const summary = summarisePeriod({
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    today: todayIn(tz, ctx.now()),
    sessions: records.sessions,
    scheduleChanges: records.scheduleChanges,
  });

  let narrative = describeSummary(summary);
  let observations: string[] = [];
  let aiAvailable = false;
  if (ctx.ai.configured && !summary.isEmpty) {
    try {
      const out = await ctx.ai.structured({
        name: 'monthly_summary',
        schema: monthlySummaryOutputSchema,
        temperature: 0.3,
        messages: [
          { role: 'system', content: monthlySummarySystemPrompt() },
          {
            role: 'user',
            content: `STATS:\n${JSON.stringify({ period: [summary.periodStart, summary.periodEnd], counts: summary.counts, byActivityType: summary.byActivityType, items: summary.items.slice(0, 60) })}${
              input.reflection ? `\nUser reflection: ${input.reflection}` : ''
            }`,
          },
        ],
      });
      narrative = out.summaryText;
      observations = out.observations;
      aiAvailable = true;
    } catch (e) {
      if (!(e instanceof AiUnavailableError)) throw e;
    }
  }

  const row = await mustOne(
    ctx.db
      .from('monthly_summaries')
      .insert({
        user_id: ctx.user.id,
        status: 'draft',
        period_start: input.periodStart,
        period_end: input.periodEnd,
        summary_text: narrative,
        observations,
        reflection: input.reflection ?? null,
        stats: summary,
        source_record_ids: summary.sourceRecordIds,
      })
      .select('id')
      .maybeSingle(),
    'Review draft',
  );
  return { draftId: row.id, periodStart: input.periodStart, periodEnd: input.periodEnd, summary, narrative, observations, aiAvailable };
}

/**
 * Save a reviewed draft. At most one saved review per period: saving again
 * updates it to a new version (no duplicates), and source records are untouched.
 */
export async function saveMonthlyReview(
  ctx: AppContext,
  input: { draftId: string; summaryText: string; reflection?: string },
): Promise<MonthlyReview> {
  const draft = await mustOne(ctx.db.from('monthly_summaries').select('*').eq('id', input.draftId).maybeSingle(), 'Review draft');
  if (draft.status !== 'draft') return toReview(draft);

  const saved = await must(
    ctx.db
      .from('monthly_summaries')
      .select('*')
      .eq('status', 'saved')
      .eq('period_start', draft.period_start)
      .eq('period_end', draft.period_end)
      .limit(1),
  );
  const values = {
    summary_text: input.summaryText,
    reflection: input.reflection ?? draft.reflection,
    stats: draft.stats,
    observations: draft.observations,
    source_record_ids: draft.source_record_ids,
  };
  if (saved[0]) {
    const rows = await must(
      ctx.db.from('monthly_summaries').update({ ...values, version: saved[0].version + 1 }).eq('id', saved[0].id).select('*'),
    );
    return toReview(rows[0]);
  }
  const rows = await must(ctx.db.from('monthly_summaries').update({ ...values, status: 'saved' }).eq('id', draft.id).eq('status', 'draft').select('*'));
  if (!rows[0]) throw unprocessable('This draft was already saved.');
  return toReview(rows[0]);
}

export async function listMonthlyReviews(ctx: AppContext): Promise<MonthlyReview[]> {
  const rows = await must(ctx.db.from('monthly_summaries').select('*').eq('status', 'saved').order('period_start', { ascending: false }));
  return rows.map(toReview);
}

export async function getMonthlyReview(ctx: AppContext, id: string): Promise<MonthlyReview> {
  return toReview(await mustOne(ctx.db.from('monthly_summaries').select('*').eq('id', id).maybeSingle(), 'Review'));
}
